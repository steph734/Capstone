import { useRef } from 'react'
import { useModalFocus } from './useModalFocus'

const TILES = [
  { icon: '🔊', title: '1. Listen', bg: '#FDE68A' },
  { icon: '🤚', title: '2. Choose', bg: '#BBF7D0' },
  { icon: '📖', title: '3. My story', bg: '#DDD6FE' },
]

// Opening card: what the game is, then one big button to pick a story.
export default function StoryStartModal({ game, onStart, onCancel }) {
  const ref = useRef(null)
  useModalFocus(ref, onCancel)
  const points = game?.pointsPerPlay ?? 100

  return (
    <div className="sb-overlay" role="dialog" aria-modal="true" aria-labelledby="sb-start-title" ref={ref}>
      <div className="sb-modal">
        <div aria-hidden="true" style={{ fontSize: 64, lineHeight: 1 }}>📖</div>
        <h1 id="sb-start-title" className="sb-title" style={{ fontSize: 40, marginTop: 8 }}>Story Builder</h1>
        <p style={{ fontSize: 20, margin: '8px 0 0' }}>Pick a story and choose what happens next!</p>

        <div className="sb-tiles">
          {TILES.map((t) => (
            <div key={t.title} className="sb-tile" style={{ background: t.bg }}>
              <span className="sb-tile-icon" aria-hidden="true">{t.icon}</span>
              {t.title}
            </div>
          ))}
        </div>

        <div className="sb-actions" style={{ marginBottom: 14 }}>
          <span className="sb-pill">🏅 {game?.badge?.name || 'Story Builder'} badge</span>
          <span className="sb-pill">⭐ +{points} XP</span>
        </div>

        <button type="button" className="sb-btn" style={{ width: '100%' }} onClick={onStart}>
          Start a story
        </button>

        {game?.description && (
          <p style={{ fontSize: 14, opacity: .7, margin: '14px 0 0' }}>{game.description}</p>
        )}
      </div>
    </div>
  )
}
