// Recommends the next set of home-practice games after a set is finished, with a written reason for every pick.
// Rule-based and explainable: every reason is built from a real data point (a play score, the patient's lowest character stat, whether
// the game is new for the patient, what the game trains). If a data point is missing the reason is simply not written.
// Nothing here is a clinical goal: the objectives are drafts the therapist edits, and the therapist approves the set.
import { STAT_LABEL, STAT_OBJECTIVE, metaFor } from './gameMeta.js'

const MIN_PICK = 2
const MAX_PICK = 3 // at most 3 new games per set: too many new demands at once is a reason to hold a game back
const avg = (list) => { const v = list.filter((x) => x != null); return v.length ? Math.round(v.reduce((a, b) => a + b, 0) / v.length) : null }
const joinNames = (names) => (names.length > 1 ? `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}` : names[0] || '')

// finished: [{ gameId, name, playList: [{ accuracy }], avg }] ; stats: { intelligence, focus, ... } or null
export function describeFinished(finished) {
  return finished.map((g) => {
    const a = g.playList.map((p) => p.accuracy)
    const p1 = a[0] ?? null, p3 = a[2] ?? null
    return { ...g, p1, p3, gain: p1 != null && p3 != null ? p3 - p1 : null, mean: g.avg ?? avg(a) }
  })
}
export const lowestStat = (stats) => {
  const e = stats ? Object.entries(stats).filter(([k, v]) => STAT_LABEL[k] && Number.isFinite(v)) : []
  if (!e.length) return null
  const [key, value] = e.sort((a, b) => a[1] - b[1])[0]
  return { key, label: STAT_LABEL[key], value }
}

// Draft objectives from the data. Each links to the game tags above so changing one changes the ranking.
export function defaultObjectives({ finished, stats }) {
  const out = []
  const best = [...finished].filter((g) => g.gain != null && g.gain >= 10).sort((a, b) => b.gain - a.gain)[0]
  const m = best && metaFor(best.name)
  if (m) out.push({ id: 'o-improved', text: `Keep building ${m.skill}`, supports: m.supports, stats: m.builds, on: true })
  const low = lowestStat(stats)
  if (low && STAT_OBJECTIVE[low.key]) out.push({ id: 'o-lowest', text: STAT_OBJECTIVE[low.key].text, supports: STAT_OBJECTIVE[low.key].supports, stats: [low.key], on: true })
  out.push({ id: 'o-routines', text: 'Carry skills into everyday routines and safety', supports: ['daily routines', 'safety'], stats: [], on: true })
  return out
}

export function recommend({ finished: rawFinished, candidates, playedIds = new Set(), stats = null, first = 'The patient', objectives = null, setNumber = 1, playDays = null }) {
  const finished = describeFinished(rawFinished)
  const low = lowestStat(stats)
  const objs = (objectives && objectives.length ? objectives : defaultObjectives({ finished, stats }))
  const on = objs.filter((o) => o.on)
  const improved = finished.filter((g) => g.gain != null && g.gain >= 10).sort((a, b) => b.gain - a.gain)

  const scored = candidates.map((c) => {
    const id = String(c._id)
    const m = metaFor(c.name)
    const isNew = !playedIds.has(id)
    const matched = m ? on.filter((o) => o.supports.some((t) => m.supports.includes(t))) : []
    const statHit = Boolean(low && m && m.builds.includes(low.key))
    const score = matched.length * 3 + (statHit ? 3 : 0) + (isNew ? 2 : 0)
    const reasons = []
    if (statHit) reasons.push(`${low.label} is ${first}'s lowest stat (${low.value} / 100), and ${c.name} builds it`)
    for (const g of improved) {
      const gm = metaFor(g.name)
      if (m && gm && gm.supports.some((t) => m.supports.includes(t)) && reasons.length < 3) { reasons.push(`${g.name} gains (+${g.gain} pts) show ${gm.skill} is growing, so ${c.name} is a good next step`); break }
    }
    if (isNew) reasons.push(`New for ${first}, so no repeated practice`)
    const steady = finished.filter((g) => g.mean != null && g.mean >= 90).map((g) => g.name)
    if (steady.length >= 2 && reasons.length < 3) reasons.push(`${joinNames(steady)} are steady, so ${first} is ready for something new`)
    return {
      gameId: id, name: c.name, description: c.description || '', score, statHit, isNew, reasons: reasons.slice(0, 3),
      supports: matched.map((o) => o.text), builds: m ? m.builds.map((k) => STAT_LABEL[k]) : [],
      startAt: 'Level 1 · Warm-up', startReason: isNew ? `New for ${first}, so early plays should be easy to succeed at.` : 'Keeps early plays successful.',
      hasMeta: Boolean(m),
    }
  }).sort((a, b) => b.score - a.score || Number(b.statHit) - Number(a.statHit) || a.name.localeCompare(b.name)) // a tie goes to the game that builds the lowest stat

  const picks = []
  for (const c of scored) {
    if (picks.length >= MAX_PICK) break
    if (picks.length >= MIN_PICK && c.score < Math.max(4, (picks[0]?.score || 0) - 1)) break // a third game only when it is nearly as good as the first
    picks.push(c)
  }
  const rest = scored.filter((c) => !picks.includes(c) && c.hasMeta)
  const notPicked = rest.slice(0, 1).map((c) => ({ gameId: c.gameId, name: c.name, reason: `Not now · Set ${setNumber + 2}. Adding it now would add too many new demands at once.` }))

  // What the finished set showed: only statements the data supports.
  const insights = []
  const steadyOnes = finished.filter((g) => g.mean != null && g.mean >= 90)
  if (steadyOnes.length) insights.push({ tone: 'good', text: `${joinNames(steadyOnes.map((g) => g.name))} steady at ${avg(steadyOnes.map((g) => g.mean))}%` })
  if (improved[0]) insights.push({ tone: 'up', text: `${improved[0].name} +${improved[0].gain} pts from play 1 to play 3` })
  if (low) insights.push({ tone: 'low', text: `${low.label} is lowest (${low.value} / 100)` })
  if (playDays) insights.push({ tone: 'days', text: `Played on ${playDays} separate day${playDays === 1 ? '' : 's'}` })

  const review = finished.filter((g) => g.p1 != null && g.gain != null && ((g.p1 < 70 && g.gain >= 10) || g.gain >= 20)).sort((a, b) => b.gain - a.gain)[0]
  const reviewGame = review ? { name: review.name, reason: `${review.name} is suggested for review in clinic (play 1 was ${review.p1}%, play 3 ${review.p3}%).` } : null
  const names = finished.map((g) => g.name)
  return {
    games: picks.map(({ score, statHit, hasMeta, ...g }) => g), notPicked, insights, objectives: objs, reviewGame,
    availableText: names.length ? `${joinNames(names)} stay available to replay.` : '',
    short: picks.length < MIN_PICK ? 'Not enough new games for a full set. Pick review games or add games.' : null,
    generatedAt: new Date(), version: 1,
  }
}
