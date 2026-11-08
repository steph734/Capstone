import { gameEmoji } from './gameIcons'

// One game of a patient's home set: icon, name, status pill (always with text, never color alone) and plays used x of N.
// A patient may play each home game N times (3); after that it is finished (and mastered when every play was perfect).
const PILL = {
  mastered: { cls: 'mastered', text: '★ Mastered' },
  finished: { cls: 'finished', text: '✓ Finished' },
  practicing: { cls: 'practicing', text: '▶ Practicing' },
  not_started: { cls: 'idle', text: '○ Not started' },
}

export default function GameStatusCard({ game }) {
  const pill = PILL[game.status] || PILL.not_started
  const shown = Math.min(game.plays, game.required)
  return (
    <li className={`hs-game ${pill.cls}`}>
      <div className="hs-game-top"><span className="hs-game-ico" aria-hidden="true">{gameEmoji(game.name)}</span><b>{game.name}</b></div>
      <span className={`hs-pill ${pill.cls}`}>{pill.text}</span>
      <div className="hs-game-row"><span>Plays</span><b>{shown} of {game.required}</b></div>
      <div className="hs-bar" role="progressbar" aria-label={`${game.name} plays used`} aria-valuemin={0} aria-valuemax={game.required} aria-valuenow={shown}>
        <i style={{ width: `${(shown / game.required) * 100}%` }} />
      </div>
    </li>
  )
}
