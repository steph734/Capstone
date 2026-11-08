import { Clock, House, Lock, Play, RotateCcw } from 'lucide-react'
import { SHORT_DAYS, fmt12, iconFor } from './homeUtil'
import './home.css'

export function Dots({ done, goal, finished = false }) {
  return (
    <span className={`hm-dots${finished ? ' fin' : ''}`} aria-label={`${done} of ${goal} plays used`}>
      {Array.from({ length: Math.max(goal, done) }, (_, i) => <i key={i} className={i < done ? 'on' : ''} />)}
    </span>
  )
}

export function TimeLeft({ hp }) {
  const w = hp.data.window
  const limit = Math.round(w.limitSeconds / 60)
  const open = hp.status.kind === 'open'
  const left = Math.ceil(hp.secondsLeft / 60)
  const pct = open ? Math.min(100, Math.round((hp.secondsLeft / w.limitSeconds) * 100)) : 0
  return (
    <div className="hm-time" role="progressbar" aria-valuemin={0} aria-valuemax={limit} aria-valuenow={open ? left : 0} aria-label="Play time left today">
      <div className="hm-time-row"><Clock size={16} aria-hidden="true" /> <b>{open ? `${left} of ${limit} min left today` : hp.status.kind === 'done' ? `${limit} of ${limit} min used today` : `${limit} min a day`}</b></div>
      <div className="hm-bar"><i style={{ width: `${pct}%` }} /></div>
    </div>
  )
}

// Dashboard card: "Home practice from [Therapist]".
export default function HomeCard({ hp, onPlay }) {
  if (!hp.plan) return null
  const plan = hp.plan
  const open = hp.status.kind === 'open'
  return (
    <section className="hm-card" aria-label="Home practice">
      <header>
        <span className="hm-ico"><House size={22} aria-hidden="true" /></span>
        <h2>Home practice from {plan.therapistName}</h2>
        <span className={`hm-pill ${hp.status.kind}`}>{hp.status.label}</span>
      </header>
      <TimeLeft hp={hp} />
      <div className="hm-days" aria-label="Practice days">
        {SHORT_DAYS.map(([name, d]) => <span key={d} className={plan.days.includes(d) ? 'on' : ''}>{name}</span>)}
      </div>
      <ul className="hm-games">
        {plan.games.map((g) => {
          const Icon = iconFor(g.name)
          return (
            <li key={g.id}>
              <span className="hm-gico"><Icon size={22} aria-hidden="true" /></span>
              <div className="hm-ginfo"><b>{g.name}</b><small><Dots done={g.homePlays ?? g.playsThisWeek} goal={g.playsLimit ?? plan.goalPerGamePerWeek} /> {g.homePlays ?? g.playsThisWeek} of {g.playsLimit ?? plan.goalPerGamePerWeek} plays{g.bestHome != null ? ` · Best ${g.bestHome}%` : ''}</small></div>
              <button type="button" className="hm-play" disabled={!open || g.finished} onClick={() => onPlay(g)} aria-label={`${g.playsThisWeek ? 'Play again' : 'Play'} ${g.name}`}>
                {open ? (g.playsThisWeek ? <><RotateCcw size={15} aria-hidden="true" /> Play again</> : <><Play size={15} aria-hidden="true" /> Play</>) : <><Lock size={15} aria-hidden="true" /> Play</>}
              </button>
            </li>
          )
        })}
      </ul>
      <p className="hm-note">Your home scores are shared with {plan.therapistName} so they can see your progress.</p>
    </section>
  )
}
