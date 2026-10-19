import { Volume2 } from 'lucide-react'
import { useEffect } from 'react'
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
  useEffect(() => { if (warnNow && !muted) softBell() }, [warnNow, muted])
  if (!ps.enabled) return null
  // With "finish the current game" on, an open game keeps going; the card shows once it is closed.
  const showOver = state === 'over' && plan && !overDismissed && !(gameOpen && plan.allowFinishCurrent)
  return (
    <>
      {warnNow && (
        <div className="pl-toast" role="status"><img src={rewardPoses.keepGoing} alt="" /> <span>{plan.warnBeforeMinutes} minutes left! Let&apos;s finish this game.</span> <Volume2 size={18} aria-hidden="true" /></div>
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
