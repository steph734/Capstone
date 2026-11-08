// Patient Stats "Home practice vs therapy sessions", scoped to one home-practice SET (or all sets).
//
// A set is a row in `home_sets` (see homeSets.js). For the selected set this returns only that set's games, the home plays made
// inside the set's window (at most 3 per game) and the therapy plays of the same games around it, so a new set starts from zero
// and the finished set stays saved. Everything is computed here; the page only renders.
//   Home data     game_sessions with context 'home' for the set's games, from the set's start to its end (or now)
//   Therapy data  other plays of the same games from the start of the day the set began to the set's end (or now);
//                 for "All sets" the page's date range is used instead
// Plays of other games, or from before a game was in any set, are left out here but still count in the rest of the page.
import { ObjectId } from 'mongodb'
import { HOME_PLAYS_PER_GAME } from './homeSetConfig.js'
import { buildHomePracticeStats, summarise } from './homePracticeStats.js'
import { manilaDayKey } from './manilaWeeks.js'
import { playPercent } from './homePractice.js'
import { signedNoteOf, syncActiveSet } from './homeSets.js'

const WEEK = 7 * 86400000
const toId = (v) => { try { return v && ObjectId.isValid(String(v)) ? new ObjectId(String(v)) : null } catch { return null } }
const pct = (n) => (n == null ? null : Math.round(n))

// 7-day buckets that start on the day the set started (Wk 1, Wk 2, ...). weekOf maps a date to its bucket key.
export function weeksFrom(start, end = new Date(), max = 12) {
  const s = new Date(start).getTime()
  const n = Math.min(max, Math.max(1, Math.floor((new Date(end).getTime() - s) / WEEK) + 1))
  const weekKeys = Array.from({ length: n }, (_, i) => manilaDayKey(new Date(s + i * WEEK)))
  const weekOf = (d) => weekKeys[Math.min(n - 1, Math.max(0, Math.floor((new Date(d).getTime() - s) / WEEK)))]
  return { weekKeys, weekOf }
}

// The short descriptive line under a finished game (or a count for a game that still has plays left).
export function gameNote(name, playList, limit = HOME_PLAYS_PER_GAME) {
  const used = playList.length
  if (used === 0) return { tone: 'grey', text: 'Not played yet' }
  if (used < limit) return { tone: 'plain', text: `${used} of ${limit} plays used` }
  const [a, b, c] = playList.map((p) => p.accuracy)
  const known = playList.filter((p) => p.accuracy != null)
  const avg = known.length ? Math.round(known.reduce((s, p) => s + p.accuracy, 0) / known.length) : null
  if (a === 100 && b === 100 && c === 100) return { tone: 'good', text: '★ Finished · steady at 100%' }
  if (b === 100 && c === 100) return { tone: 'good', text: '★ Finished · 100% on the last 2 plays' }
  if (a != null && c != null && c - a >= 10) return { tone: 'good', text: `★ Finished · up +${c - a} pts from play 1 to play 3` }
  if (a != null && c != null && a - c >= 10) return { tone: 'plain', text: `★ Finished · down ${a - c} pts from play 1 to play 3` }
  return { tone: 'good', text: avg != null ? `★ Finished · steady at ${avg}%` : '★ Finished' }
}

const playRow = (s, n) => ({ n, accuracy: playPercent(s.result), mistakes: Math.max(0, (Number(s.result?.attempts) || 0) - (Number(s.result?.correct) || 0)), hints: Number(s.result?.hints_used) || 0, seconds: Number(s.result?.duration_seconds) || 0, playedAt: s.completed_at })

export async function buildSetStats(db, { patientId, setParam = 'current', days = 30 }) {
  await syncActiveSet(db, patientId) // a patient with an active home plan always has a set
  const allSets = (await db.collection('home_sets').find({ patient_id: patientId }).sort({ set_number: 1 }).toArray()).sort((a, b) => a.set_number - b.set_number)
  const patient = await db.collection('patients').findOne({ _id: patientId }, { projection: { first_name: 1, nickname: 1 } })
  const firstName = patient?.nickname || patient?.first_name || 'The patient'
  if (!allSets.length) return { sets: [], selected: null, firstName }

  const gameIdSet = new Set(allSets.flatMap((s) => s.game_ids.map(String)))
  const games = await db.collection('games').find({ _id: { $in: [...gameIdSet].map(toId) } }, { projection: { name: 1 } }).toArray()
  const nameBy = new Map(games.map((g) => [String(g._id), g.name || 'Game']))
  const gameById = new Map(games.map((g) => [String(g._id), { name: g.name }]))

  const active = allSets.find((s) => s.status === 'active') || null
  const finished = allSets.filter((s) => s.status === 'completed')
  const latestFinished = finished[finished.length - 1] || null
  const bySel = (id) => allSets.find((s) => String(s._id) === String(id))
  const isAll = setParam === 'all'
  const chosen = isAll ? null : (setParam !== 'current' && bySel(setParam)) || active || latestFinished
  const now = new Date()

  const hiddenPlans = new Set((await db.collection('home_practice_plans').find({ patient_id: patientId, save_to_progress: false }, { projection: { _id: 1 } }).toArray()).map((p) => String(p._id)))
  const all = await db.collection('game_sessions').find({ patient_id: patientId, game_id: { $in: [...gameIdSet].map(toId) }, status: 'completed' }).sort({ completed_at: 1 }).toArray()

  const homeWindow = (s) => [new Date(s.started_at), s.completed_at ? new Date(s.completed_at) : now]
  const dayStart = (d) => new Date(`${manilaDayKey(d)}T00:00:00+08:00`)
  // The home plays of one set: its games, inside its window, hidden plans left out, the first 3 per game.
  const homePlaysOf = (s) => {
    if (s.use_at_home === false) return []
    const [from, to] = homeWindow(s)
    const ids = new Set(s.game_ids.map(String))
    const seen = new Map()
    const out = []
    for (const p of all) {
      if (p.context !== 'home' || !ids.has(String(p.game_id)) || p.completed_at < from || p.completed_at > to || hiddenPlans.has(String(p.home_plan_id))) continue
      const k = String(p.game_id); const c = (seen.get(k) || 0) + 1
      if (c > HOME_PLAYS_PER_GAME) continue
      seen.set(k, c); out.push(p)
    }
    return out
  }
  const therapyPlaysOf = (s, from, to) => { const ids = new Set(s.game_ids.map(String)); return all.filter((p) => p.context !== 'home' && ids.has(String(p.game_id)) && p.completed_at >= from && p.completed_at <= to) }

  // Plays in scope for the selection.
  let sessions
  let scopeSets
  let range
  if (isAll) {
    scopeSets = allSets
    const from = new Date(now.getTime() - days * 86400000)
    const home = allSets.flatMap(homePlaysOf)
    const ids = new Set(allSets.flatMap((s) => s.game_ids.map(String)))
    const therapy = all.filter((p) => p.context !== 'home' && ids.has(String(p.game_id)) && p.completed_at >= from && p.completed_at <= now)
    sessions = [...home, ...therapy].sort((a, b) => a.completed_at - b.completed_at)
    range = { from: allSets[0].started_at, to: now }
  } else {
    scopeSets = [chosen]
    const [hFrom, hTo] = homeWindow(chosen)
    sessions = [...homePlaysOf(chosen), ...therapyPlaysOf(chosen, dayStart(chosen.started_at), hTo)].sort((a, b) => a.completed_at - b.completed_at)
    range = { from: hFrom, to: hTo }
  }
  const gameIds = [...new Set(scopeSets.flatMap((s) => s.game_ids.map(String)))]
  const { weekKeys, weekOf } = weeksFrom(range.from, range.to)
  const syntheticPlan = {
    status: !isAll && chosen.status === 'completed' ? 'completed' : 'active', created_at: range.from, starts_at: range.from, ends_at: range.to, goal_per_game_per_week: null,
    games: gameIds.map((id, i) => ({ game_id: toId(id), order: i + 1 })),
  }
  const built = buildHomePracticeStats({ sessions, plans: [syntheticPlan], gameById, weekKeys, weekOf, firstName, today: manilaDayKey(now) })

  // Per game: the 3 home plays with their accuracy, a note, and plays used.
  const homeByGame = new Map()
  for (const s of sessions.filter((x) => x.context === 'home')) { const k = String(s.game_id); homeByGame.set(k, [...(homeByGame.get(k) || []), s]) }
  const perGame = built.perGame.map((g) => {
    const list = (homeByGame.get(g.gameId) || []).map((s, i) => playRow(s, i + 1))
    const sets = isAll ? allSets.filter((s) => s.game_ids.some((x) => String(x) === g.gameId)) : [chosen]
    const limit = HOME_PLAYS_PER_GAME * Math.max(1, sets.filter((s) => s.use_at_home !== false).length)
    return { ...g, playList: list.slice(0, 3), playsUsed: Math.min(list.length, limit), playsAllowed: limit, finished: list.length >= limit, note: isAll ? null : gameNote(nameBy.get(g.gameId) || g.name, list.slice(0, 3)) }
  })

  // The selector, each set's recap and the previous finished set's average (reference line on the accuracy chart).
  const recapOf = (s) => {
    const sm = summarise(homePlaysOf(s))
    return { plays: sm.plays, allowed: s.game_ids.length * HOME_PLAYS_PER_GAME, accuracy: sm.accuracy != null ? Math.round(sm.accuracy) : null }
  }
  const signed = new Map()
  for (const s of allSets) { const n = await signedNoteOf(db, s); if (n) signed.set(String(s._id), n) }
  const setsOut = allSets.map((s) => ({
    id: String(s._id), number: s.set_number, status: s.status === 'active' ? 'current' : 'finished', startedAt: s.started_at, completedAt: s.completed_at || null,
    games: s.game_ids.map((id) => nameBy.get(String(id)) || 'Game'), soapDone: signed.has(String(s._id)), soapAt: signed.get(String(s._id))?.signed_at || null, soapNoteId: s.soap_draft_id ? String(s.soap_draft_id) : null, recap: recapOf(s),
  })).reverse() // newest first
  const sel = isAll ? null : chosen
  const prevFinished = sel ? [...finished].reverse().find((s) => s.set_number < sel.set_number) : latestFinished
  const prevRecap = prevFinished ? { ...setsOut.find((s) => s.id === String(prevFinished._id)) } : null
  const referenceAverage = sel && sel.status === 'active' && prevRecap?.recap.accuracy != null ? { label: `Set ${prevRecap.number} average ${prevRecap.recap.accuracy}%`, value: prevRecap.recap.accuracy } : null

  const used = perGame.reduce((a, g) => a + g.playsUsed, 0)
  const allowed = perGame.reduce((a, g) => a + g.playsAllowed, 0)
  const finishedNow = perGame.length > 0 && perGame.every((g) => g.finished)
  const h = built.totals.home, t = built.totals.session
  const best = perGame.map((g) => ({ name: g.name, d: (g.playList[2]?.accuracy ?? null) != null && g.playList[0]?.accuracy != null ? g.playList[2].accuracy - g.playList[0].accuracy : null })).filter((x) => x.d != null && x.d >= 10).sort((a, b) => b.d - a.d)[0]
  const label = isAll ? 'All sets' : `Set ${sel.set_number}`
  const insight = isAll ? `All sets: ${firstName} used ${h.plays} home play${h.plays === 1 ? '' : 's'} and ${t.plays} therapy play${t.plays === 1 ? '' : 's'} on these games.`
    : finishedNow ? `${label} finished. ${firstName} used all ${used} home plays at ${pct(h.accuracy) ?? '—'}% accuracy (therapy: ${t.accuracy != null ? `${pct(t.accuracy)}%` : '—'}).${best ? ` ${best.name} improved by ${best.d} points.` : ''}`
      : used === 0 ? `${label} just started. These charts switched to ${perGame.map((g) => g.name).join(' and ')} and will fill in automatically as ${firstName} plays.${prevRecap ? ` Set ${prevRecap.number} results stay saved.` : ''}`
        : `${label}: ${used} of ${allowed} home plays used so far.`

  return {
    firstName, sets: setsOut, patientId: String(patientId),
    selected: {
      id: isAll ? 'all' : String(sel._id), kind: isAll ? 'all' : sel.status === 'active' ? 'current' : 'finished', number: isAll ? null : sel.set_number,
      startedAt: range.from, endedAt: isAll ? now : sel.completed_at || null, games: perGame.map((g) => g.name), playsUsed: used, playsAllowed: allowed, finished: finishedNow,
      soapDone: isAll ? false : signed.has(String(sel._id)), soapAt: isAll ? null : signed.get(String(sel._id))?.signed_at || null, soapNoteId: isAll || !sel.soap_draft_id ? null : String(sel.soap_draft_id), draftReady: !isAll && Boolean(sel.soap_draft_id && sel.recommendation), useAtHome: isAll ? true : sel.use_at_home !== false, useInTherapy: isAll ? true : Boolean(sel.use_in_therapy),
      nextSession: isAll ? null : sel.next_session ? { date: sel.next_session.date, start: sel.next_session.start } : null,
      homePlays: h.plays, therapyPlays: t.plays, fair: h.plays >= built.minHomePlays && t.plays >= 1,
    },
    prevSet: prevRecap, referenceAverage, insight,
    data: { ...built, perGame, hasPlan: true, plan: { ...built.plan, goalPerGamePerWeek: null } },
  }
}
