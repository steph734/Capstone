// POST /api/sessions/:id/complete -> the core of the progression system.
// body: { result: { correct, attempts, hints_used, stars, detail } }
//
// Runs in one transaction: XP/level/stats, counters, badge awards, item/hair
// unlocks, the session's own `result`/`reward`, and the legacy
// game_completions upsert all land together or not at all. Idempotent — a
// retry on an already-completed session just replays its saved reward.
import mongoose from 'mongoose'
import { getMongo, getDb } from '../mongo.js'
import { Game } from '../models/game.js'
import { GameSession } from '../models/gameSession.js'
import { PaoProfile } from '../models/paoProfile.js'
import { GameCompletion } from '../models/gameCompletion.js'
import { PatientBadge } from '../models/patientBadge.js'
import { PatientUnlock } from '../models/patientUnlock.js'
import { Badge } from '../models/badge.js'
import { ActivitySession } from '../models/activitySession.js'
import { evaluateCriteria } from '../evaluateUnlock.js'
import { buildUnlockContext } from '../unlockContext.js'
import { serializePaoProfile } from '../serializePaoProfile.js'
import { serializeBadge } from '../serializeBadge.js'
import { serializePaoItem } from '../serializePaoItem.js'
import { serializePaoHair } from '../serializePaoHair.js'
import {
  computeXpEarned, applyXp, statGainsForGame, applyStatGains, isPerfectResult, manilaDayRange,
} from '../paoProgression.js'

const MIN_SESSION_MS = 15 * 1000

function themeIsActiveToday(theme) {
  if (!theme) return true // no theme_code on the item -> not theme-gated
  if (!theme.is_active) return false
  const today = new Date()
  if (theme.starts_on && today < new Date(theme.starts_on)) return false
  if (theme.ends_on && today > new Date(theme.ends_on)) return false
  return true
}

async function buildRewardNames(db, badgeCodes, unlocks) {
  const [badgeDocs, itemDocs, hairDocs] = await Promise.all([
    badgeCodes.length ? Badge.find({ code: { $in: badgeCodes } }).lean() : [],
    db.collection('clothes').find({ code: { $in: unlocks.filter((u) => u.item_type === 'item').map((u) => u.item_code) } }).toArray(),
    db.collection('pao_hair').find({ code: { $in: unlocks.filter((u) => u.item_type === 'hair').map((u) => u.item_code) } }).toArray(),
  ])
  const itemByCode = new Map(itemDocs.map((d) => [d.code, d]))
  const hairByCode = new Map(hairDocs.map((d) => [d.code, d]))

  return {
    badges: badgeDocs.map((b) => {
      const s = serializeBadge(b)
      return { code: s.code, name: s.name, emoji: s.emoji, shape: s.shape, colour: s.colour, symbol: s.symbol, description: s.description }
    }),
    unlocks: unlocks.map((u) => {
      if (u.item_type === 'item') {
        const doc = itemByCode.get(u.item_code)
        const s = doc ? serializePaoItem(doc) : null
        return { itemType: 'item', code: u.item_code, name: s?.name || u.item_code, category: s?.category || null, emoji: s?.emoji || null, design: s?.design || null }
      }
      const doc = hairByCode.get(u.item_code)
      const s = doc ? serializePaoHair(doc) : null
      return { itemType: 'hair', code: u.item_code, name: s?.name || u.item_code, category: 'Hair', emoji: s?.emoji || null, design: s?.design || null }
    }),
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { id } = req.params
  if (!mongoose.isValidObjectId(id)) {
    return res.status(400).json({ error: 'Invalid session id.' })
  }
  const result = req.body?.result || {}

  try {
    await getMongo()
    const db = await getDb()

    const existing = await GameSession.findById(id).lean()
    if (!existing) return res.status(404).json({ error: 'Session not found.' })

    // Idempotent replay — the client retried after a network blip but the
    // server had already finished the job.
    if (existing.status === 'completed') {
      const profile = await PaoProfile.findOne({ patient_id: existing.patient_id }).lean()
      const names = await buildRewardNames(db, existing.reward?.badge_codes || [], (existing.reward?.unlocks || []).map((u) => ({ item_type: u.item_type, item_code: u.item_code })))
      return res.status(200).json({
        reward: {
          xpEarned: existing.reward?.xp_earned || 0,
          levelBefore: existing.reward?.level_before,
          levelAfter: existing.reward?.level_after,
          leveledUp: (existing.reward?.level_after || 0) > (existing.reward?.level_before || 0),
          statGains: existing.reward?.stat_gains || {},
          badges: names.badges,
          unlocks: names.unlocks,
        },
        profile: serializePaoProfile(profile),
      })
    }
    if (existing.status === 'abandoned') {
      return res.status(400).json({ error: 'This session was already ended.' })
    }

    const startedAt = new Date(existing.started_at)
    if (Date.now() - startedAt.getTime() < MIN_SESSION_MS) {
      return res.status(400).json({ error: 'That finished too quickly to record — please actually play the game.' })
    }

    const game = await Game.findById(existing.game_id).lean()
    if (!game) return res.status(404).json({ error: 'Game not found.' })

    const patientId = existing.patient_id

    const session = await mongoose.startSession()
    let response
    try {
      await session.withTransaction(async () => {
        const profile = await PaoProfile.findOneAndUpdate(
          { patient_id: patientId },
          { $setOnInsert: { patient_id: patientId } },
          { new: true, upsert: true, session }
        )

        const perfect = isPerfectResult({ correct: result.correct, attempts: result.attempts, hintsUsed: result.hints_used })

        const priorCompletion = await GameCompletion.findOne({ patient_id: patientId, game_id: game._id }).session(session)
        const isFirstFinish = !priorCompletion || !priorCompletion.times_completed

        const { start, end } = manilaDayRange(new Date())
        const finishedTodayBefore = await GameSession.countDocuments({
          patient_id: patientId, game_id: game._id, status: 'completed',
          completed_at: { $gte: start, $lt: end },
        }).session(session)

        const xpEarned = computeXpEarned(game, { isFirstFinish, finishesTodayIncludingThis: finishedTodayBefore + 1 })

        const levelBefore = profile.level
        const { level, xp, levelsGained } = applyXp(profile.level, profile.xp, xpEarned)
        const gains = statGainsForGame(game)
        const { stats, gains: appliedGains } = applyStatGains(profile.stats, gains, levelsGained)

        profile.level = level
        profile.xp = xp
        profile.total_xp = (profile.total_xp || 0) + xpEarned
        profile.stats = stats
        profile.games_completed = (profile.games_completed || 0) + 1
        profile.perfect_games = (profile.perfect_games || 0) + (perfect ? 1 : 0)
        profile.games_in_a_row = (profile.games_in_a_row || 0) + 1
        profile.best_games_in_a_row = Math.max(profile.best_games_in_a_row || 0, profile.games_in_a_row)
        if (game.therapy_type && !profile.categories_completed.includes(game.therapy_type)) {
          profile.categories_completed.push(game.therapy_type)
        }
        profile.last_played_at = new Date()
        await profile.save({ session })

        // Legacy per-(patient,game) completion doc — still the thing
        // complete_specific_game / perfect_score / complete_any_game read.
        const now = new Date()
        if (!priorCompletion) {
          await GameCompletion.create([{
            patient_id: patientId, game_id: game._id, game_name: game.name || null,
            times_completed: 1, best_score: result.correct ?? null, best_max_score: result.attempts ?? null,
            perfect_score_achieved: perfect, first_completed_at: now, last_completed_at: now,
          }], { session })
        } else {
          priorCompletion.times_completed += 1
          priorCompletion.last_completed_at = now
          if (result.correct != null && (priorCompletion.best_score == null || result.correct > priorCompletion.best_score)) {
            priorCompletion.best_score = result.correct
            priorCompletion.best_max_score = result.attempts ?? null
          }
          if (perfect) priorCompletion.perfect_score_achieved = true
          await priorCompletion.save({ session })
        }

        // ── Badges ──────────────────────────────────────────────────────
        const ctx = await buildUnlockContext(patientId, session) // must see this transaction's own writes above
        const alreadyEarned = new Set((await PatientBadge.find({ patient_id: patientId }).select('badge_code').session(session).lean()).map((b) => b.badge_code))
        const activeBadges = await Badge.find({ is_active: true, status: 'active' }).session(session).lean()

        const newlyEarnedBadges = []
        for (const b of activeBadges) {
          if (alreadyEarned.has(b.code)) continue
          const met = evaluateCriteria({ type: b.criteria?.type, gameId: b.criteria?.game_id, value: b.criteria?.value, taskKey: b.criteria?.task_key }, ctx)
          if (met) {
            newlyEarnedBadges.push(b)
            ctx.earnedBadgeCodes.add(b.code)
          }
        }
        if (newlyEarnedBadges.length) {
          await PatientBadge.insertMany(
            newlyEarnedBadges.map((b) => ({ patient_id: patientId, badge_id: b._id, badge_code: b.code, earned_at: now, game_id: game._id, session_id: existing._id })),
            { session }
          )
          await Badge.updateMany({ _id: { $in: newlyEarnedBadges.map((b) => b._id) } }, { $inc: { earned_count: 1 } }, { session })
        }

        // ── Items & hair ────────────────────────────────────────────────
        const alreadyUnlocked = new Set(
          (await PatientUnlock.find({ patient_id: patientId }).select('item_type item_code').session(session).lean())
            .map((u) => `${u.item_type}:${u.item_code}`)
        )
        const themeCodes = new Set()
        // Sequential — see the matching note in unlockContext.js: a session
        // can't be shared across concurrent operations.
        const clothesDocs = await db.collection('clothes').find({ is_active: true }, { session }).toArray()
        const hairDocs = await db.collection('pao_hair').find({ is_active: true }, { session }).toArray()
        for (const d of [...clothesDocs, ...hairDocs]) if (d.theme_code) themeCodes.add(d.theme_code)
        const themes = themeCodes.size
          ? await db.collection('pao_themes').find({ code: { $in: [...themeCodes] } }, { session }).toArray()
          : []
        const themeByCode = new Map(themes.map((t) => [t.code, t]))

        const newUnlocks = [] // { item_type, item_code, source }
        const badgeUnlockCodes = new Set(newlyEarnedBadges.filter((b) => b.unlock_item_code).map((b) => b.unlock_item_code))

        const considerItem = (doc, itemType) => {
          const key = `${itemType}:${doc.code}`
          if (alreadyUnlocked.has(key) || newUnlocks.some((u) => u.item_type === itemType && u.item_code === doc.code)) return
          if (!themeIsActiveToday(doc.theme_code ? themeByCode.get(doc.theme_code) : null)) return

          if (badgeUnlockCodes.has(doc.code)) {
            const badge = newlyEarnedBadges.find((b) => b.unlock_item_code === doc.code)
            newUnlocks.push({ item_type: itemType, item_code: doc.code, source: { type: 'badge', badge_code: badge?.code || null, session_id: existing._id } })
            return
          }
          if (!doc.unlock) return // only reachable via a badge's unlock_item_code — already handled above
          const met = evaluateCriteria({ type: doc.unlock.type, gameId: doc.unlock.game_id, value: doc.unlock.value, badgeCode: doc.unlock.badge_code }, ctx)
          if (met) {
            // patient_unlocks.source.type is only ever 'free' | 'achievement' | 'badge' —
            // the item's OWN unlock rule (anything but 'free') reads as 'achievement'.
            const sourceType = doc.unlock.type === 'free' ? 'free' : 'achievement'
            newUnlocks.push({ item_type: itemType, item_code: doc.code, source: { type: sourceType, badge_code: doc.unlock.badge_code || null, session_id: existing._id } })
          }
        }
        for (const d of clothesDocs) considerItem(d, 'item')
        for (const d of hairDocs) considerItem(d, 'hair')

        if (newUnlocks.length) {
          await PatientUnlock.insertMany(
            newUnlocks.map((u) => ({ patient_id: patientId, item_type: u.item_type, item_code: u.item_code, source: u.source, unlocked_at: now })),
            { session }
          )
        }

        // ── Close out the session ───────────────────────────────────────
        const reward = {
          xp_earned: xpEarned,
          level_before: levelBefore,
          level_after: level,
          stat_gains: appliedGains,
          badge_codes: newlyEarnedBadges.map((b) => b.code),
          unlocks: newUnlocks.map((u) => ({ item_type: u.item_type, item_code: u.item_code })),
        }
        // Guard against a concurrent duplicate completion racing this same
        // transaction: only the request that still finds status:'in_progress'
        // gets to write. A lost race aborts and falls back to the idempotent
        // "already completed" replay below.
        const closeResult = await GameSession.updateOne(
          { _id: existing._id, status: 'in_progress' },
          {
            $set: {
              status: 'completed',
              completed_at: now,
              result: {
                correct: result.correct ?? null,
                attempts: result.attempts ?? null,
                hints_used: result.hints_used ?? 0,
                stars: result.stars ?? null,
                perfect,
                duration_seconds: Math.round((now.getTime() - startedAt.getTime()) / 1000),
                detail: result.detail ?? null,
              },
              reward,
            },
          },
          { session }
        )
        if (closeResult.modifiedCount === 0) {
          throw Object.assign(new Error('RACE_LOST'), { raceLost: true })
        }

        if (existing.activity_session_id) {
          await ActivitySession.updateOne(
            { _id: existing.activity_session_id },
            { $inc: { games_completed: 1, xp_earned: xpEarned }, $set: { last_active_at: now } },
            { session }
          )
        }

        const names = await buildRewardNames(db, reward.badge_codes, reward.unlocks)
        response = {
          reward: {
            xpEarned,
            levelBefore,
            levelAfter: level,
            leveledUp: level > levelBefore,
            statGains: appliedGains,
            badges: names.badges,
            unlocks: names.unlocks,
          },
          profile: serializePaoProfile(profile.toObject ? profile.toObject() : profile),
        }
      })
    } catch (err) {
      if (err?.raceLost) {
        // Another request completed this session first — replay its result.
        const saved = await GameSession.findById(id).lean()
        const profile = await PaoProfile.findOne({ patient_id: saved.patient_id }).lean()
        const names = await buildRewardNames(db, saved.reward?.badge_codes || [], (saved.reward?.unlocks || []).map((u) => ({ item_type: u.item_type, item_code: u.item_code })))
        return res.status(200).json({
          reward: {
            xpEarned: saved.reward?.xp_earned || 0,
            levelBefore: saved.reward?.level_before,
            levelAfter: saved.reward?.level_after,
            leveledUp: (saved.reward?.level_after || 0) > (saved.reward?.level_before || 0),
            statGains: saved.reward?.stat_gains || {},
            badges: names.badges,
            unlocks: names.unlocks,
          },
          profile: serializePaoProfile(profile),
        })
      }
      throw err
    } finally {
      await session.endSession()
    }

    return res.status(200).json(response)
  } catch (err) {
    console.error('game-sessions/complete error:', err)
    return res.status(500).json({ error: err.message || 'Could not record this game session.' })
  }
}
