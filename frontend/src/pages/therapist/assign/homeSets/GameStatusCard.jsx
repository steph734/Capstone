import { gameEmoji } from './gameIcons'

// One game of a patient's home set: icon, name, status pill (always with text, never color alone) and mastered plays x of N.
const PILL = {
  mastered: { cls: 'mastered', text: '★ Mastered' },
  practicing: { cls: 'practicing', text: '▶ Practicing' },
  not_started: { cls: 'idle', text: '○ Not started' },
}

export default function GameStatusCard({ game }) {
  const pill = PILL[game.status] || PILL.not_started
  const shown = Math.min(game.masteredPlays, game.required)
  return (
    <li className={`hs-game ${pill.cls}`}>
      <div className="hs-game-top"><span className="hs-game-ico" aria-hidden="true">{gameEmoji(game.name)}</span><b>{game.name}</b></div>
      <span className={`hs-pill ${pill.cls}`}>{pill.text}</span>
      <div className="hs-game-row"><span>Mastered plays</span><b>{shown} of {game.required}</b></div>
      <div className="hs-bar" role="progressbar" aria-label={`${game.name} mastered plays`} aria-valuemin={0} aria-valuemax={game.required} aria-valuenow={shown}>
        <i style={{ width: `${(shown / game.required) * 100}%` }} />
      </div>
    </li>
  )
}
