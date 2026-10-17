import { Pause, Star, Volume2, VolumeX } from 'lucide-react'

export default function HUD({ round, total, points, sound, onPause, onToggleSound }) {
  return (
    <div className="rt-top">
      <div className="rt-top-l">
        <button type="button" className="rt-sq" onClick={onPause} aria-label="Pause"><Pause size={24} aria-hidden="true" /></button>
        <div className="rt-title"><span>Speech &amp; Language · Easy</span><strong>Rhyme Time</strong></div>
      </div>
      <div className="rt-pill" aria-label={`Round ${round + 1} of ${total}`}>
        <span>Round {round + 1} of {total}</span>
        <span className="rt-dots">{Array.from({ length: total }, (_, i) => <i key={i} className={i < round ? 'done' : i === round ? 'now' : ''} />)}</span>
      </div>
      <div className="rt-top-r">
        <div className="rt-stat"><Star size={22} fill="#ffd23f" color="#ffd23f" aria-hidden="true" /> <b>{points}</b></div>
        <button type="button" className="rt-sq" onClick={onToggleSound} aria-label={sound ? 'Turn sound off' : 'Turn sound on'}>{sound ? <Volume2 size={24} aria-hidden="true" /> : <VolumeX size={24} aria-hidden="true" />}</button>
      </div>
    </div>
  )
}
