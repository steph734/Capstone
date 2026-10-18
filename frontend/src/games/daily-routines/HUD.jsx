import { Pause, Star, Volume2, VolumeX } from 'lucide-react'

export default function HUD({ label, total = 0, index = 0, points, sound, onPause, onToggleSound }) {
  return (
    <div className="dr-top">
      <div className="dr-top-l">
        <button type="button" className="dr-pill-btn sq" onClick={onPause} aria-label="Pause"><Pause size={22} aria-hidden="true" /></button>
        <div className="dr-title"><span>Cognitive · {label}</span><strong>Daily Routines</strong></div>
      </div>
      {total > 0 && (
        <div className="dr-steps" aria-label={`Step ${Math.min(index + 1, total)} of ${total}`}>
          <span>Step {Math.min(index + 1, total)} of {total}</span>
          <span className="dr-dots">{Array.from({ length: total }, (_, i) => <i key={i} className={i < index ? 'done' : i === index ? 'now' : ''} />)}</span>
        </div>
      )}
      <div className="dr-top-r">
        <div className="dr-pill-btn stat"><Star size={20} fill="#ffc83d" color="#ffc83d" aria-hidden="true" /> <b>{points}</b></div>
        <button type="button" className="dr-pill-btn sq" onClick={onToggleSound} aria-label={sound ? 'Turn sound off' : 'Turn sound on'}>{sound ? <Volume2 size={22} aria-hidden="true" /> : <VolumeX size={22} aria-hidden="true" />}</button>
      </div>
    </div>
  )
}
