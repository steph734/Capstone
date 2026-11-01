import { useEffect, useState } from 'react'
import { rewardPoses } from '../rewards/paoRewardPoses'
import '../plan/plan.css'

// Home practice reminders above every game: "5 minutes left" once, and "time is done" when the daily limit is used.
// The game that is open is never cut off: it can finish, then everything locks until the next practice day.
export default function HomeOverlays({ hp, gameOpen }) {
  const [warned, setWarned] = useState(false)
  const [warn, setWarn] = useState(false)
  const [doneMsg, setDoneMsg] = useState(false)
  const open = hp.status.kind === 'open'

  useEffect(() => {
    if (!hp.enabled || !gameOpen || !open || warned || hp.secondsLeft > 300 || hp.secondsLeft <= 0) return undefined
    setWarned(true); setWarn(true)
    const t = setTimeout(() => setWarn(false), 7000)
    return () => clearTimeout(t)
  }, [hp.enabled, gameOpen, open, warned, hp.secondsLeft])
  useEffect(() => {
    if (!hp.enabled || !gameOpen || hp.status.kind !== 'done') return undefined
    setDoneMsg(true)
    const t = setTimeout(() => setDoneMsg(false), 8000)
    return () => clearTimeout(t)
  }, [hp.enabled, gameOpen, hp.status.kind])
  useEffect(() => { if (!gameOpen) setWarn(false) }, [gameOpen])

  if (!hp.enabled || !gameOpen) return null
  if (warn) return <div className="pl-toast" role="status"><img src={rewardPoses.keepGoing} alt="" /> <span>5 minutes left today! Let&apos;s finish this game.</span></div>
  if (doneMsg) return <div className="pl-toast" role="status"><img src={rewardPoses.allDone} alt="" /> <span>That&apos;s all your home play time today. Finish this game, then rest!</span></div>
  return null
}
