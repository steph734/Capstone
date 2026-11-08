import { useEffect, useState } from 'react'
import { Bell, Clock, House, Lock, Play } from 'lucide-react'
import PlanPanel from '../plan/PlanPanel'
import { Dots, TimeLeft } from './HomeCard'
import { cardFor, dayRange, fmt12, iconFor, shortDate } from './homeUtil'
import './home.css'

const CAT = { cognitive: 'Cognitive', speech: 'Speech & Language' }
const DIFF = { easy: 'Easy', medium: 'Medium', hard: 'Hard' }
const POSE = '/games/pao-money-match-poses/'
const nextText = (date, time) => {
  if (!date) return ''
  const d = new Date(`${date}T12:00:00Z`).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' })
  return time ? `${d}, ${time}` : d
}
const day = (iso) => new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'Asia/Manila' })

function HomeTab({ hp, cards, onPlay }) {
  const plan = hp.plan
  if (!plan) {
    return <div className="hm-empty"><House size={30} aria-hidden="true" /><b>No home practice yet</b><span>When your therapist sends games home, they show up here.</span></div>
  }
  const open = hp.status.kind === 'open'
  const sessionOnly = hp.data.sessionOnly || []
  // Each game can be played 3 times: progress, Pao's message and the "all finished" state follow the plays used.
  const limit = plan.games[0]?.playsLimit ?? 3
  const playsUsed = hp.data.set?.playsUsed ?? plan.games.reduce((s, g) => s + Math.min(g.homePlays || 0, limit), 0)
  const playsAllowed = hp.data.set?.playsAllowed ?? plan.games.length * limit
  const allFinished = plan.games.length > 0 && playsUsed >= playsAllowed
  const finishedGame = plan.games.find((g) => g.finished)
  const nextGame = plan.games.find((g) => !g.finished && g.homePlays > 0) || plan.games.find((g) => !g.finished)
  const left = nextGame ? limit - (nextGame.homePlays || 0) : 0
  const paoText = allFinished
    ? `Hooray, ${hp.data.firstName}! You played every game ${limit} times. You finished ALL your home games! Your therapist will give you new games soon.`
    : finishedGame && nextGame
      ? `Great job on ${finishedGame.name}! You played it ${limit} times, so it is finished. ${nextGame.name} has ${left} play${left === 1 ? '' : 's'} left!`
      : `You can play each game ${limit} times. Pick a game to play!`
  return (
    <div className="hm-tab">
      <div className="hm-pao" role="status">
        <img src={`${POSE}${allFinished ? 'pao-heart-eyes' : 'pao-point-side'}.png`} alt="" width="96" height="96" />
        <p>{paoText}</p>
      </div>
      <div className="hm-banner">
        <div className="hm-banner-top">
          <span className="hm-ico w"><House size={22} aria-hidden="true" /></span>
          <div>
            <b>{plan.therapistName} sent these games home</b>
            <small>Open until {day(plan.endsAt)} · {dayRange(plan.days)}, {fmt12(plan.dailyStart)}–{fmt12(plan.dailyEnd)} · <b>each game can be played {limit} times</b></small>
          </div>
          <span className="hm-pill on-blue">{playsUsed} of {playsAllowed} plays used</span>
        </div>
        <TimeLeft hp={hp} />
        <p className="hm-remind"><Bell size={14} aria-hidden="true" /> You&apos;ll get a reminder 5 min before time ends.</p>
      </div>

      {allFinished && (
        <div className="hm-done" role="status">
          <span aria-hidden="true" className="hm-done-ico">🎉</span>
          <div><b>Home games finished!</b><small>Your therapist is getting your next set ready.{hp.data.nextSession ? ` See you at your next session on ${nextText(hp.data.nextSession, hp.data.nextSessionTime)}.` : ''}</small></div>
          <span className="hm-pill wait">Waiting for new games</span>
        </div>
      )}

      <div className="hm-grid">
        {plan.games.map((g) => {
          const Icon = iconFor(g.name)
          const card = cardFor(cards, g.name)
          return (
            <article key={g.id} className={`hm-gcard${g.finished ? ' fin' : ''}`} style={{ '--c': card?.color || '#2563eb' }}>
              <header>
                <span className="hm-gico big"><Icon size={26} aria-hidden="true" /></span>
                <div className="hm-tags">
                  <span className="t">{CAT[g.therapyType] || g.therapyType}</span>
                  <span className={`d ${g.difficulty}`}>{DIFF[g.difficulty]}</span>
                  <span className="h">At home</span>
                  {g.finished ? <span className="fin">★ Finished</span> : (g.homePlays || 0) === (g.playsLimit ?? limit) - 1 ? <span className="left">1 play left</span> : g.needsPractice && <span className="p">Practice this one</span>}
                </div>
              </header>
              <h3>{g.name}</h3>
              <p>{g.description || 'Keep practicing to get stronger!'}</p>
              <div className="hm-stats">
                <span><Dots done={g.homePlays ?? 0} goal={g.playsLimit ?? limit} finished={g.finished} /> <b>{Math.min(g.homePlays ?? 0, g.playsLimit ?? limit)} of {g.playsLimit ?? limit}</b> plays used</span>
                <span>Session score <b>{g.sessionScore != null ? `${g.sessionScore}%` : '—'}</b></span>
                <span>Best at home <b>{g.bestHome != null ? `${g.bestHome}%` : '—'}</b></span>
              </div>
              <footer>
                <span className="hm-meta"><Clock size={14} aria-hidden="true" /> {g.minutes} min · +100 XP</span>
                <button type="button" className="hm-play lg" disabled={!open || !card || g.finished} onClick={() => onPlay(card)}>
                  {g.finished ? <><Lock size={16} aria-hidden="true" /> Finished</> : open ? <><Play size={16} aria-hidden="true" /> {(g.homePlays ?? g.playsThisWeek) ? 'Play again' : 'Play'}</> : <><Lock size={16} aria-hidden="true" /> {hp.status.label}</>}
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
