import { useEffect, useState } from 'react'
import { Bell, Clock, House, Lock, Play } from 'lucide-react'
import PlanPanel from '../plan/PlanPanel'
import { Dots, TimeLeft } from './HomeCard'
import { cardFor, dayRange, fmt12, iconFor, shortDate } from './homeUtil'
import './home.css'

const CAT = { cognitive: 'Cognitive', speech: 'Speech & Language' }
const DIFF = { easy: 'Easy', medium: 'Medium', hard: 'Hard' }
const day = (iso) => new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'Asia/Manila' })

function HomeTab({ hp, cards, onPlay }) {
  const plan = hp.plan
  if (!plan) {
    return <div className="hm-empty"><House size={30} aria-hidden="true" /><b>No home practice yet</b><span>When your therapist sends games home, they show up here.</span></div>
  }
  const open = hp.status.kind === 'open'
  const sessionOnly = hp.data.sessionOnly || []
  return (
    <div className="hm-tab">
      <div className="hm-banner">
        <div className="hm-banner-top">
          <span className="hm-ico w"><House size={22} aria-hidden="true" /></span>
          <div>
            <b>{plan.therapistName} sent these games home</b>
            <small>Open until {day(plan.endsAt)} · {dayRange(plan.days)}, {fmt12(plan.dailyStart)}–{fmt12(plan.dailyEnd)} · goal {plan.goalPerGamePerWeek}× a week</small>
          </div>
          <span className={`hm-pill on-blue ${hp.status.kind}`}>{hp.status.label}</span>
        </div>
        <TimeLeft hp={hp} />
        <p className="hm-remind"><Bell size={14} aria-hidden="true" /> You&apos;ll get a reminder 5 min before time ends.</p>
      </div>

      <div className="hm-grid">
        {plan.games.map((g) => {
          const Icon = iconFor(g.name)
          const card = cardFor(cards, g.name)
          return (
            <article key={g.id} className="hm-gcard" style={{ '--c': card?.color || '#2563eb' }}>
              <header>
                <span className="hm-gico big"><Icon size={26} aria-hidden="true" /></span>
                <div className="hm-tags">
                  <span className="t">{CAT[g.therapyType] || g.therapyType}</span>
                  <span className={`d ${g.difficulty}`}>{DIFF[g.difficulty]}</span>
                  <span className="h">At home</span>
                  {g.needsPractice && <span className="p">Practice this one</span>}
                </div>
              </header>
              <h3>{g.name}</h3>
              <p>{g.description || 'Keep practicing to get stronger!'}</p>
              <div className="hm-stats">
                <span><Dots done={g.homePlays ?? g.playsThisWeek} goal={g.playsLimit ?? plan.goalPerGamePerWeek} /> {g.homePlays ?? g.playsThisWeek} of {g.playsLimit ?? plan.goalPerGamePerWeek} plays{g.finished ? ' · finished' : ''}</span>
                <span>Session score <b>{g.sessionScore != null ? `${g.sessionScore}%` : '—'}</b></span>
                <span>Best at home <b>{g.bestHome != null ? `${g.bestHome}%` : '—'}</b></span>
              </div>
              <footer>
                <span className="hm-meta"><Clock size={14} aria-hidden="true" /> {g.minutes} min · +100 XP</span>
                <button type="button" className="hm-play lg" disabled={!open || !card || g.finished} onClick={() => onPlay(card)}>
                  {g.finished ? <>✓ All {g.playsLimit} plays done</> : open ? <><Play size={16} aria-hidden="true" /> {(g.homePlays ?? g.playsThisWeek) ? 'Play again' : 'Play'}</> : <><Lock size={16} aria-hidden="true" /> {hp.status.label}</>}
                </button>
              </footer>
            </article>
          )
        })}
      </div>

      {sessionOnly.length > 0 && (
        <>
          <h3 className="hm-h">Only in your sessions</h3>
          <div className="hm-grid">
            {sessionOnly.map((g) => {
              const Icon = iconFor(g.name)
              return (
                <article key={g.gameId} className="hm-gcard locked">
                  <header><span className="hm-gico big"><Icon size={26} aria-hidden="true" /></span><Lock size={18} className="hm-lockicon" aria-hidden="true" /></header>
                  <h3>{g.name}</h3>
                  <p>{g.reason}{hp.data.nextSession ? ` (${shortDate(`${hp.data.nextSession}T12:00:00+08:00`)})` : ''}</p>
                </article>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}

// A line per game: score of every play, green = session play, blue = home play.
function Spark({ points }) {
  const w = 320
  const h = 120
  const pad = 14
  const xs = points.map((_, i) => (points.length === 1 ? w / 2 : pad + (i * (w - pad * 2)) / (points.length - 1)))
  const y = (v) => h - pad - (v / 100) * (h - pad * 2)
  const path = points.map((p, i) => `${i ? 'L' : 'M'}${xs[i].toFixed(1)},${y(p.percent).toFixed(1)}`).join(' ')
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="hm-chart" role="img" aria-label={`Scores: ${points.map((p) => `${p.percent}% ${p.context === 'home' ? 'at home' : 'in session'}`).join(', ')}`}>
      {[0, 50, 100].map((t) => <g key={t}><line x1={pad} x2={w - pad} y1={y(t)} y2={y(t)} stroke="#e8eef3" /><text x="2" y={y(t) + 3} fontSize="8" fill="#6b7c75">{t}</text></g>)}
      {points.length > 1 && <path d={path} fill="none" stroke="#b6c3cf" strokeWidth="2" />}
      {points.map((p, i) => <circle key={i} cx={xs[i]} cy={y(p.percent)} r="5" fill={p.context === 'home' ? '#2563eb' : '#16a34a'} stroke="#fff" strokeWidth="1.5"><title>{`${p.percent}% · ${p.context === 'home' ? 'at home' : 'in session'} · ${day(p.at)}`}</title></circle>)}
    </svg>
  )
}

function ProgressTab({ hp }) {
  const history = hp.data?.history || []
  if (!history.length) return <div className="hm-empty"><b>No scores yet</b><span>Finish a game and your scores show up here.</span></div>
  return (
    <div className="hm-tab">
      <p className="hm-legend"><i className="s" /> In session <i className="h" /> At home</p>
      <div className="hm-grid">
        {history.map((g) => (
          <article key={g.gameId} className="hm-gcard">
            <h3>{g.name}</h3>
            <Spark points={g.points} />
            <p>{g.points.length} play{g.points.length === 1 ? '' : 's'} · latest {g.points[g.points.length - 1].percent}%</p>
          </article>
        ))}
      </div>
    </div>
  )
}

// The patient's Gamified Activities body: Home practice | In my sessions | My progress.
export default function PatientHub({ ps, hp, cards, allCards, onPlay, name }) {
  const homeCount = hp.plan ? hp.plan.games.length : 0
  const sessionLive = ps.state === 'open' || ps.state === 'before' || ps.state === 'paused'
  const [tab, setTab] = useState(null)
  // Default tab: the therapy session while it is on, otherwise home practice when there is some.
  const shown = tab || (sessionLive ? 'sessions' : homeCount ? 'home' : 'sessions')
  useEffect(() => { if (sessionLive && tab === null) setTab('sessions') }, [sessionLive, tab])
  const tabs = [['home', `Home practice (${homeCount})`], ['sessions', 'In my sessions'], ['progress', 'My progress']]
  return (
    <div className="hm-hub">
      <div className="hm-tabs" role="tablist" aria-label="Gamified activities">
        {tabs.map(([id, label]) => <button key={id} type="button" role="tab" aria-selected={shown === id} className={shown === id ? 'on' : ''} onClick={() => setTab(id)}>{label}</button>)}
      </div>
      {shown === 'home' && <HomeTab hp={hp} cards={allCards} onPlay={onPlay} />}
      {shown === 'sessions' && <PlanPanel ps={ps} cards={cards} onPlay={onPlay} name={name} />}
      {shown === 'progress' && <ProgressTab hp={hp} />}
    </div>
  )
}
