import { Pause, Star, Volume2, VolumeX } from 'lucide-react'

export default function HUD({ round, total, points, sound, onPause, onToggleSound }) {
  return (
    <div className="sh-top">
      <div className="sh-top-l">
        <button type="button" className="sh-sq" onClick={onPause} aria-label="Pause"><Pause size={24} aria-hidden="true" /></button>
        <div className="sh-title"><span>Speech &amp; Language · Easy</span><strong>Sound Hunt</strong></div>
      </div>
      <div className="sh-pill" aria-label={`Sound ${round + 1} of ${total}`}>
        <span>Sound {round + 1} of {total}</span>
        <span className="sh-dots">{Array.from({ length: total }, (_, i) => <i key={i} className={i < round ? 'done' : i === round ? 'now' : ''} />)}</span>
      </div>
      <div className="sh-top-r">
        <div className="sh-stat"><Star size={22} fill="#ffd23f" color="#ffd23f" aria-hidden="true" /> <b>{points}</b></div>
        <button type="button" className="sh-sq" onClick={onToggleSound} aria-label={sound ? 'Turn sound off' : 'Turn sound on'}>{sound ? <Volume2 size={24} aria-hidden="true" /> : <VolumeX size={24} aria-hidden="true" />}</button>
      </div>
    </div>
  )
}
