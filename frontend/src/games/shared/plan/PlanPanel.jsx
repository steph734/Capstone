import { useState } from 'react'
import { Check, Gamepad2, Lock, Play, Star } from 'lucide-react'
import { findGame } from '../gameRegistry'
import { clock, norm } from './usePlanState'
import './plan.css'

const DIFF = { easy: 'Easy', medium: 'Medium', hard: 'Hard' }
const CAT = { cognitive: 'Cognitive', speech: 'Speech & Language' }
const EASE_TO_HARD = 'sentence'

// The game's picture: its icon on a tile in the game's own colour.
function GamePic({ card, locked }) {
  const Icon = findGame(card.id)?.icon || Gamepad2
  return <span className={`pl-pic${locked ? ' locked' : ''}`} style={{ '--c': card.color }} aria-hidden="true"><Icon size={34} strokeWidth={2.2} /></span>
}

function TimerCard({ ps }) {
  const { state, remaining, total, plan } = ps
  const min = Math.ceil(remaining / 60)
  const pct = state === 'open' || state === 'paused' ? Math.max(0, Math.min(1, remaining / total)) : state === 'before' ? 1 : 0
  const R = 26
  const C = 2 * Math.PI * R
  const title = state === 'open' ? `${min} min left` : state === 'paused' ? 'Paused by your therapist' : state === 'before' ? 'Play time has not started' : 'Play time is over'
  const sub = state === 'open' ? `${clock(remaining)} left` : state === 'paused' ? `${clock(remaining)} left when it starts again` : state === 'before' ? 'Your therapist will start play time soon' : 'Great playing today'
  return (
    <div className={`pl-timer ${state}`} role="timer" aria-label={`${title}. ${sub}`}>
      <svg width="64" height="64" viewBox="0 0 64 64" aria-hidden="true">
        <circle cx="32" cy="32" r={R} fill="none" stroke="#e5efe9" strokeWidth="7" />
        <circle cx="32" cy="32" r={R} fill="none" stroke={state === 'open' ? '#22c55e' : '#9aa9a2'} strokeWidth="7" strokeLinecap="round" strokeDasharray={C} strokeDashoffset={C * (1 - pct)} transform="rotate(-90 32 32)" />
        <text x="32" y="38" textAnchor="middle" fontSize="18" fontWeight="800" fill="#14532d">{state === 'open' || state === 'paused' ? min : <tspan>·</tspan>}</text>
      </svg>
      <div><b>{title}</b><small>{sub}</small></div>
    </div>
  )
}

// The patient's games page when a play plan applies: today's games open, everything else locked.
export default function PlanPanel({ ps, cards, onPlay, name }) {
  const [msg, setMsg] = useState('')
  const { state, plan } = ps
  const first = String(name || ps.playerName || 'friend').split(' ')[0]
  const planCards = plan ? plan.games.map((g) => ({ g, card: cards.find((c) => norm(c.title) === norm(g.name)) })).filter((x) => x.card) : []
  const inPlan = new Set(planCards.map((x) => x.card.id))
  const others = cards.filter((c) => !inPlan.has(c.id))
  const done = plan ? plan.games.filter((g) => g.status === 'done').length : 0
  const total = plan ? plan.games.length : 0
  const next = planCards.find((x) => x.g.status !== 'done')
  const open = state === 'open'

  const line = state === 'none' ? 'No games today yet. Your therapist will pick them during your session.'
    : state === 'before' ? `Hi ${first}! Your therapist will start play time soon.`
      : state === 'over' ? `Time's up! Great playing today, ${first}.`
        : state === 'paused' ? 'Play time is paused. Wait a moment!'
          : `Hi ${first}! Your therapist picked ${total} game${total === 1 ? '' : 's'} for today. Let's play!`

  const tapLocked = (why) => { setMsg(why); setTimeout(() => setMsg(''), 2600) }

  return (
    <div className="pl-wrap">
      <div className="pl-top">
        <div className="pl-bubble" aria-live="polite">{line}</div>
        {plan && state !== 'none' && <TimerCard ps={ps} />}
      </div>

      {plan && state !== 'none' && (
        <div className="pl-progress" aria-label={`${done} of ${total} done`}>
          <span>Today&apos;s games:</span>
          {plan.games.map((g) => <i key={g.gameId} className={g.status === 'done' ? 'done' : g.status === 'in_progress' ? 'now' : ''} />)}
          <b>{done} of {total} done</b>
        </div>
      )}

      {planCards.length > 0 && (
        <>
          <h3 className="pl-h">Today&apos;s games</h3>
          <div className="pl-row">
            {planCards.map(({ g, card }, i) => {
              const isDone = g.status === 'done'
              const isNext = next && next.g.gameId === g.gameId
              return (
                <div key={g.gameId} className={`pl-today${isDone ? ' done' : ''}${isNext && open ? ' next' : ''}`} style={{ '--c': card.color }}>
                  <span className="pl-tag"><Star size={13} aria-hidden="true" /> Today</span>
                  <div className="pl-head"><GamePic card={card} /><strong>{card.title}</strong></div>
                  <div className="pl-tags">
                    <span className="c">{CAT[card.category] || card.category}</span>
                    <span className={`d ${card.difficulty}`}>{card.id === EASE_TO_HARD ? 'Easy to Hard' : DIFF[card.difficulty]}</span>
                    <span className="m">{g.minutes} min</span>
                  </div>
                  <div className="pl-act">
                    {isDone ? <span className="pl-done"><Check size={16} aria-hidden="true" /> Done</span>
                      : open ? <button type="button" className={isNext ? 'play' : 'ghost'} onClick={() => onPlay(card)}><Play size={15} aria-hidden="true" /> Play now</button>
                        : <span className="pl-wait">{i === 0 ? 'Up next' : 'Later'}</span>}
                    {!isDone && open && !isNext && null}
                    {!isDone && !open && null}
                  </div>
                </div>
              )
            })}
          </div>
        </>
      )}

      <h3 className="pl-h">{planCards.length ? 'Other games · locked for today' : 'Games · locked for today'}</h3>
      <div className="pl-locked">
        {others.map((card) => (
          <button key={card.id} type="button" className="pl-lock" onClick={() => tapLocked('Ask your therapist to add this game.')} aria-label={`${card.title}, locked`}>
            <Lock size={18} className="pl-ico" aria-hidden="true" />
            <div className="pl-head"><GamePic card={card} locked /><strong>{card.title}</strong></div>
            <div className="pl-tags"><span className="c">{CAT[card.category] || card.category}</span><span className={`d ${card.difficulty}`}>{card.id === EASE_TO_HARD ? 'Easy to Hard' : DIFF[card.difficulty]}</span></div>
            <small>Not in today&apos;s plan</small>
          </button>
        ))}
      </div>
      {msg && <div className="pl-msg" role="status">{msg}</div>}
    </div>
  )
}
