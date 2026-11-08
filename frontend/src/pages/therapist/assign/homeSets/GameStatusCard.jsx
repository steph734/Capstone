import { gameEmoji } from './gameIcons'

// One game of a patient's home set: icon, name, status pill (always with text, never color alone), the accuracy of each of its
// 3 plays, and plays used x of 3. A game is Finished when all 3 plays are used.
const DONE = new Set(['finished', 'mastered'])

export default function GameStatusCard({ game }) {
  const done = DONE.has(game.status)
  const pill = done ? { cls: 'mastered', text: '★ Finished' } : game.status === 'practicing' ? { cls: 'practicing', text: '▶ Playing' } : { cls: 'idle', text: '○ Not started' }
  const shown = Math.min(game.plays, game.required)
  const list = game.playList || []
  return (
    <li className={`hs-game ${done ? 'mastered' : game.status}`}>
      <div className="hs-game-top"><span className="hs-game-ico" aria-hidden="true">{gameEmoji(game.name)}</span><b>{game.name}</b></div>
      <span className={`hs-pill ${pill.cls}`}>{pill.text}</span>
      <div className="hs-chips">
        {Array.from({ length: game.required }, (_, i) => {
          const p = list[i]
          const pct = p?.accuracy
          return (
            <span key={i} className={`hs-chip ${p ? (pct != null && pct >= 80 ? 'good' : 'low') : 'empty'}`} aria-label={p ? `Play ${i + 1}: ${pct != null ? `${pct}%` : 'no score'}` : `Play ${i + 1}: not played`}>
              <small>PLAY {i + 1}</small><b>{p ? (pct != null ? `${pct}%` : '—') : '—'}</b>
            </span>
          )
        })}
      </div>
      <div className="hs-game-row"><span>Plays used</span><b>{shown} of {game.required}</b></div>
      <div className="hs-bar" role="progressbar" aria-label={`${game.name} plays used`} aria-valuemin={0} aria-valuemax={game.required} aria-valuenow={shown}>
        <i style={{ width: `${(shown / game.required) * 100}%` }} />
      </div>
    </li>
  )
}
