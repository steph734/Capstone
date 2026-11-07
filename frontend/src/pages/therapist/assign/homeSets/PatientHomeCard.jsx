import { useState } from 'react'
import GameStatusCard from './GameStatusCard'
import SetCompleteBanner from './SetCompleteBanner'
import { dayKeyOf, relativeDay, sessionText, shortDay } from './gameIcons'

const COLORS = [['#d9efe7', '#159a72'], ['#e7e3fb', '#6d5bd0'], ['#d8ecfb', '#0284c7'], ['#fbeacb', '#d97706'], ['#fbdce8', '#db2777']]
const colorOf = (n) => COLORS[[...String(n || '')].reduce((h, c) => (h + c.charCodeAt(0)) % COLORS.length, 0)]
const initials = (n) => String(n || '').split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('') || '?'

// One patient: header, a row of game cards, the celebration banner when the whole set is mastered, and finished sets.
export default function PatientHomeCard({ patient: p, onChoose, onKeep, keeping, openSetup }) {
  const [showHistory, setShowHistory] = useState(false)
  const [bg, fg] = colorOf(p.name)
  const today = dayKeyOf(new Date())
  const freshSet = p.setNumber > 1 && dayKeyOf(p.assignedAt) === today && !p.complete
  const subtitle = p.complete
    ? `Set ${p.setNumber} · started ${shortDay(p.startedAt)} · all home games mastered`
    : freshSet
      ? `Set ${p.setNumber} · assigned today${p.nextSession ? ` · next session ${sessionText(p.nextSession)}` : ''}`
      : `Set ${p.setNumber} · ${relativeDay(p.startedAt) === 'Yesterday' || relativeDay(p.startedAt) === 'Today' ? relativeDay(p.startedAt) : `started ${shortDay(p.startedAt)}`} · ${p.playedCount} of ${p.games.length} played`
  const badge = p.complete ? ['done', '✓ Set complete'] : freshSet ? ['fresh', '● New set active'] : p.useAtHome ? ['on', 'Home practice on'] : ['off', 'Home practice off']
  const last = p.history[0]

  return (
    <article className={`hs-card${p.needsNew ? ' complete' : ''}${freshSet ? ' fresh' : ''}`} aria-label={`${p.name}, set ${p.setNumber}`}>
      <header className="hs-card-head">
        <span className="hs-avatar" style={{ background: bg, color: fg }} aria-hidden="true">{initials(p.name)}</span>
        <div className="hs-card-title"><h3>{p.name}</h3><p>{subtitle}</p></div>
        <span className={`hs-badge ${badge[0]}`}>{badge[1]}</span>
      </header>

      {p.games.length === 0 ? (
        <div className="hs-setup"><p>No games are set for home practice yet.</p><button type="button" className="hs-btn green" onClick={openSetup}>Set up home practice</button></div>
      ) : (
        <ul className="hs-games" style={{ '--cols': Math.min(4, p.games.length) }}>{p.games.map((g) => <GameStatusCard key={g.gameId} game={g} />)}</ul>
      )}

      {p.needsNew && <SetCompleteBanner patient={p} onChoose={() => onChoose(p)} onKeep={() => onKeep(p)} keeping={keeping} />}
      {p.complete && p.dismissed && (
        <p className="hs-keep-note">This set stays as it is. <button type="button" className="hs-link" onClick={() => onChoose(p)}>Choose new games</button> whenever you are ready.</p>
      )}

      {last && (
        <div className="hs-history">
          <div className="hs-history-row">
            <span aria-hidden="true">📦</span>
            <span><b>Set {last.setNumber} · completed {shortDay(last.completedAt)}</b> — {last.games.join(', ')} · all mastered</span>
            <button type="button" className="hs-link" aria-expanded={showHistory} onClick={() => setShowHistory((v) => !v)}>{showHistory ? 'Hide history' : 'View history'}</button>
          </div>
          {showHistory && (
            <ol className="hs-history-list">
              {p.history.map((h) => <li key={h.setId}><b>Set {h.setNumber}</b> · {shortDay(h.startedAt)} to {shortDay(h.completedAt)} · {h.games.join(', ')}</li>)}
            </ol>
          )}
        </div>
      )}
    </article>
  )
}
