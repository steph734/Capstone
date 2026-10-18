import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ArrowRight, Shirt, Star } from 'lucide-react'
import BadgeMedal from '../../../components/BadgeMedal'
import { markPaoSeen } from '../../../utils/paoApi'
import { speakPao, stopPaoVoice } from '../../../utils/paoVoice'
import { buildSteps, SPEECH, xpNumbers } from './buildSteps'
import { FALLBACK_PAO, rewardPoses } from './paoRewardPoses'
import './rewards-flow.css'

const CATEGORY_SLOT = { Hats: 'hats', Clothes: 'clothes', Pants: 'pants', Shoes: 'shoes', Hair: 'hair' }

const poseFor = (step, wearing) => ({ badge: 'badge', xp: 'xp', level: 'levelUp', stats: 'stats', outfit: wearing ? 'wearing' : 'gift', allDone: 'allDone', replay: 'replay', keepGoing: 'keepGoing' }[step.kind])

function useCountUp(target, run, ms = 900) {
  const [v, setV] = useState(0)
  useEffect(() => {
    if (!run) { setV(0); return undefined }
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduce) { setV(target); return undefined }
    let raf = 0
    const t0 = performance.now()
    const tick = (now) => {
      const t = Math.min(1, (now - t0) / ms)
      setV(Math.round(target * (1 - (1 - t) * (1 - t))))
      if (t < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [target, run, ms])
  return v
}

// The one "You won!" rewards flow every game ends with. Titles are always fully visible: only transform animates.
export default function RewardsFlow({ reward, ident, onEquip, onDone, actions, gameName = 'Game', sound = true }) {
  const steps = useMemo(() => buildSteps(reward), [reward])
  const [index, setIndex] = useState(0)
  const [wearing, setWearing] = useState(false)
  const [counted, setCounted] = useState(false)
  const step = steps[index] || steps[0]
  const last = index === steps.length - 1
  const reduce = useMemo(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches, [])
  const xp = useMemo(() => xpNumbers(reward || {}), [reward])
  const [shown, setShown] = useState({ cur: poseFor(step, false), prev: null })
  const lastPose = useRef(shown.cur)
  const seen = useRef(false)

  const pose = step ? poseFor(step, wearing) : 'allDone'
  useEffect(() => {
    if (lastPose.current === pose) return undefined
    const prev = lastPose.current
    lastPose.current = pose
    setShown({ cur: pose, prev })
    const t = setTimeout(() => setShown((s) => ({ ...s, prev: null })), 220)
    return () => clearTimeout(t)
  }, [pose])

  // One short line per step.
  useEffect(() => {
    if (!step || !sound) return undefined
    const line = step.kind === 'level' ? SPEECH.levelUp(xp.levelAfter) : step.kind === 'outfit' ? (wearing ? SPEECH.wearing : SPEECH.gift) : SPEECH[step.kind]
    if (line) speakPao(line, { rate: 0.85, pitch: 1.1 })
    return undefined
  }, [index, wearing]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => stopPaoVoice(), [])
  useEffect(() => { setCounted(step?.kind !== 'xp' && step?.kind !== 'level' && step?.kind !== 'stats') }, [index]) // eslint-disable-line react-hooks/exhaustive-deps

  const gained = useCountUp(xp.gained, step?.kind === 'xp')
  useEffect(() => { if (step?.kind === 'xp') { const t = setTimeout(() => setCounted(true), reduce ? 50 : 1000); return () => clearTimeout(t) } return undefined }, [index, step?.kind, reduce])
  useEffect(() => { if (step?.kind === 'level' || step?.kind === 'stats') { const t = setTimeout(() => setCounted(true), reduce ? 50 : 700); return () => clearTimeout(t) } return undefined }, [index, step?.kind, reduce])

  const markSeen = useCallback(async () => {
    if (seen.current) return
    seen.current = true
    try {
      await markPaoSeen(ident, {
        badgeCodes: (reward.badges || []).map((b) => b.code),
        unlocks: (reward.unlocks || []).map((u) => ({ itemType: u.itemType, code: u.code })),
      })
    } catch { /* seen-flags are cosmetic */ }
  }, [ident, reward])

  const close = useCallback((then) => { stopPaoVoice(); markSeen(); onDone(); then?.() }, [markSeen, onDone])
  const next = () => (last ? close() : setIndex((i) => i + 1))

  // Esc / back skips to the last step (the rewards are already saved).
  useEffect(() => {
    const on = (e) => { if (e.key === 'Escape') setIndex(steps.length - 1) }
    window.addEventListener('keydown', on)
    return () => window.removeEventListener('keydown', on)
  }, [steps.length])

  const putOn = async (u) => {
    const slot = CATEGORY_SLOT[u.category] || (u.itemType === 'hair' ? 'hair' : null)
    if (slot && onEquip) { try { await onEquip(slot, u.code) } catch { /* stays unworn */ } }
    setWearing(true)
  }

  if (!step) return null
  const stars = Number(reward.stars) || 0
  const profile = reward.profile
  const xpPct = (v) => Math.min(100, Math.round((v / (xp.cap || 100)) * 100))

  return (
    <div className="rw-overlay" role="dialog" aria-modal="true" aria-label="Pao's rewards">
      <div className="rw-card" onClick={(e) => { if (counted && !last && !e.target.closest('button') && step.kind !== 'outfit') next() }}>
        <div className="rw-head">
          <span className="rw-chip">{gameName}</span>
          <span className="rw-dots" aria-label={`Step ${index + 1} of ${steps.length}`}>{steps.map((_, i) => <i key={i} className={i === index ? 'now' : i < index ? 'done' : ''} />)}</span>
        </div>

        <div className="rw-pao">
          <div className="rw-oval" />
          <div className={`rw-img-wrap rw-move-${pose}`} key={`${pose}-${index}`}>
            {shown.prev && <img className="rw-img prev" src={rewardPoses[shown.prev]} alt="" draggable="false" />}
            <img className="rw-img cur" src={rewardPoses[shown.cur]} alt="Pao" draggable="false"
              onError={(e) => { if (!e.currentTarget.dataset.fb) { e.currentTarget.dataset.fb = '1'; console.warn('Rewards: pose failed, using default Pao'); e.currentTarget.src = FALLBACK_PAO } }} />
          </div>
          {step.kind === 'xp' && !reduce && <div className="rw-stars" aria-hidden="true">{[0, 1, 2, 3, 4].map((i) => <Star key={i} size={22} fill="#ffc83d" color="#f0a500" style={{ left: `${10 + i * 20}%`, animationDelay: `${i * 0.12}s` }} />)}</div>}
          {step.kind === 'level' && !reduce && <div className="rw-confetti" aria-hidden="true">{Array.from({ length: 16 }, (_, i) => <i key={i} style={{ left: `${(i * 6.4) % 100}%`, animationDelay: `${(i % 5) * 0.1}s`, background: ['#ffc83d', '#4ade80', '#60a5fa', '#f472b6'][i % 4] }} />)}</div>}
        </div>

        {step.kind === 'badge' && (
          <>
            <h2>You earned a badge!</h2>
            <p>For finishing {gameName}</p>
            <div className="rw-box gold">
              <BadgeMedal shape={step.badge.shape} colour={step.badge.colour} symbol={step.badge.symbol} size={64} />
              <div><strong>{step.badge.name}</strong><small>Added to your badge collection</small></div>
            </div>
          </>
        )}
        {step.kind === 'xp' && (
          <>
            <h2>+{gained} XP</h2>
            <p>Great playing! Pao is growing.</p>
            <div className="rw-xpbox" aria-label={`${xp.after} of ${xp.cap} XP`}>
              <div className="rw-bar" role="progressbar" aria-valuemin={0} aria-valuemax={xp.cap} aria-valuenow={xp.after}>
                <i style={{ width: `${counted ? xpPct(xp.after) : xpPct(xp.before)}%` }} />
              </div>
              <div className="rw-xprow"><span>Level {xp.level}</span><span>{counted ? xp.after : xp.before} / {xp.cap} XP</span></div>
            </div>
          </>
        )}
        {step.kind === 'level' && (
          <>
            <h2>Level up!</h2>
            <p>Pao is now level {xp.levelAfter}</p>
            <div className="rw-levels"><span className="from">{xp.levelBefore}</span><ArrowRight size={34} aria-hidden="true" /><span className="to">{xp.levelAfter}</span></div>
            <div className="rw-xprow solo"><span>Next level</span><span>0 / {xp.next} XP</span></div>
          </>
        )}
        {step.kind === 'stats' && (
          <>
            <h2>Pao got stronger</h2>
            <p>From this game</p>
            <ul className="rw-stats">
              {step.stats.map((s) => (
                <li key={s.key}>
                  <span>{s.label}</span>
                  <div className="rw-minibar"><i style={{ width: `${Math.min(100, Math.round(((s.total || profile?.stats?.[s.key] || 0) / (s.max || 100)) * 100))}%` }} /></div>
                  <b>+{s.gained}</b>
                </li>
              ))}
            </ul>
          </>
        )}
        {step.kind === 'outfit' && (
          <>
            <h2>{wearing ? 'Looking good!' : 'New outfit!'}</h2>
            <p>{wearing ? 'Pao is wearing it' : 'Pao unlocked something new'}</p>
            <div className="rw-box rose">
              <span className="rw-outfit" style={{ color: step.unlock.design?.main || '#e0457b' }}><Shirt size={36} aria-hidden="true" /></span>
              <div><strong>{step.unlock.name}</strong><small>{step.unlock.category} · from {gameName}</small></div>
            </div>
          </>
        )}
        {step.kind === 'allDone' && (
          <>
            <h2>All done!</h2>
            <p>Thank you for playing</p>
            <div className="rw-starsrow" aria-label={`${stars} out of 3 stars`}>{[1, 2, 3].map((n) => <Star key={n} size={46} fill={n <= stars ? '#ffc83d' : 'none'} color={n <= stars ? '#f0a500' : '#d9cdea'} strokeWidth={2.2} aria-hidden="true" />)}</div>
          </>
        )}
        {step.kind === 'replay' && (
          <>
            <h2>Good job again!</h2>
            <p>Stars for you</p>
            <div className="rw-starsrow" aria-label={`${stars} out of 3 stars`}>{[1, 2, 3].map((n) => <Star key={n} size={46} fill={n <= stars ? '#ffc83d' : 'none'} color={n <= stars ? '#f0a500' : '#d9cdea'} strokeWidth={2.2} aria-hidden="true" />)}</div>
          </>
        )}
        {step.kind === 'keepGoing' && (
          <>
            <h2>Keep going!</h2>
            <p>Good try! Let&apos;s finish next time.</p>
          </>
        )}

        <div className="rw-actions">
          {step.kind === 'outfit' && !wearing ? (
            <>
              <button type="button" className="rw-btn green" onClick={() => putOn(step.unlock)}>Put it on Pao</button>
              <button type="button" className="rw-btn white" onClick={next}>Maybe later</button>
            </>
          ) : (step.kind === 'allDone' || step.kind === 'replay') ? (
            <>
              <button type="button" className="rw-btn orange" onClick={() => close(actions?.playAgain)} autoFocus>Play again</button>
              <button type="button" className="rw-btn white" onClick={() => close(actions?.allGames)}>All games</button>
            </>
          ) : step.kind === 'keepGoing' ? (
            <button type="button" className="rw-btn orange" onClick={() => close(actions?.allGames)} autoFocus>All games</button>
          ) : (
            <button type="button" className="rw-btn orange" onClick={next} disabled={!counted} autoFocus>Next</button>
          )}
        </div>
        {(step.kind === 'badge' || step.kind === 'xp') && <small className="rw-hint">Tap anywhere to continue</small>}
      </div>
    </div>
  )
}
