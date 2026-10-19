import { Volume2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { rewardPoses } from '../rewards/paoRewardPoses'
import './plan.css'

function softBell() {
  try {
    const C = window.AudioContext || window.webkitAudioContext
    if (!C) return
    const ctx = new C()
    const o = ctx.createOscillator(); const g = ctx.createGain()
    o.type = 'sine'; o.frequency.setValueAtTime(660, ctx.currentTime); o.frequency.setValueAtTime(880, ctx.currentTime + 0.15)
    g.gain.setValueAtTime(0.05, ctx.currentTime); g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5)
    o.connect(g); g.connect(ctx.destination); o.start(); o.stop(ctx.currentTime + 0.55)
    o.onended = () => ctx.close()
  } catch { /* sound is optional */ }
}

// Above every game: the "5 minutes left" toast and the friendly "Time's up" card.
export default function PlanOverlays({ ps, muted }) {
  const { warnNow, state, plan, gameOpen, overDismissed } = ps
  const [shown, setShown] = useState(false) // keeps the overlay mounted for its fade-out
  useEffect(() => {
    if (state === 'paused') { setShown(true); return undefined }
    const t = setTimeout(() => setShown(false), 350)
    return () => clearTimeout(t)
  }, [state])
  useEffect(() => {
    if (state !== 'paused') return undefined
    const block = (e) => { if (!e.target.closest?.('.pl-pause')) { e.stopPropagation(); e.preventDefault() } }
    const evs = ['keydown', 'keyup', 'keypress']
    evs.forEach((n) => window.addEventListener(n, block, true))
    return () => evs.forEach((n) => window.removeEventListener(n, block, true))
  }, [state])
  useEffect(() => { if (warnNow && !muted) softBell() }, [warnNow, muted])
  if (!ps.enabled) return null
  // With "finish the current game" on, an open game keeps going; the card shows once it is closed.
  const showOver = state === 'over' && plan && !overDismissed && !(gameOpen && plan.allowFinishCurrent)
  return (
    <>
      {warnNow && (
        <div className="pl-toast" role="status"><img src={rewardPoses.keepGoing} alt="" /> <span>{plan.warnBeforeMinutes} minutes left! Let&apos;s finish this game.</span> <Volume2 size={18} aria-hidden="true" /></div>
      )}
      {plan && (state === 'paused' || shown) && (
        <div className={`pl-pause${state === 'paused' ? '' : ' out'}`} role="alertdialog" aria-modal="true" aria-live="assertive" aria-label="Game paused">
          <div>
            <img src={rewardPoses.keepGoing} alt="Pao" />
            <h2>Game paused</h2>
            <p>Your therapist paused the game. Wait a moment!</p>
          </div>
        </div>
      )}
      {showOver && (
        <div className="pl-over" role="dialog" aria-modal="true" aria-label="Time is up">
          <div>
            <img src={rewardPoses.allDone} alt="Pao" />
            <h2>Time&apos;s up!</h2>
            <p>Great playing today. Your progress is saved.</p>
            <button type="button" onClick={() => { ps.dismissOver(); ps.goBack() }} autoFocus>Back to games</button>
          </div>
        </div>
      )}
    </>
  )
}
