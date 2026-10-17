import { Pause, Star, Volume2, VolumeX } from 'lucide-react'
import { LEVEL_COLOR, LEVEL_LABEL } from './sentences'

export default function HUD({ index, total, level, points, sound, onPause, onToggleSound }) {
  return (
    <div className="sb-top">
      <div className="sb-top-l">
        <button type="button" className="sb-sq" onClick={onPause} aria-label="Pause"><Pause size={24} aria-hidden="true" /></button>
        <div className="sb-title"><span>Cognitive · Easy to Hard</span><strong>Sentence Builder</strong></div>
        <span className="sb-level" style={{ background: LEVEL_COLOR[level] }}>{LEVEL_LABEL[level]}</span>
      </div>
      <div className="sb-pill" aria-label={`Sentence ${index + 1} of ${total}`}>
        <span>Sentence {index + 1} of {total}</span>
        <span className="sb-dots">{Array.from({ length: total }, (_, i) => <i key={i} className={i < index ? 'done' : i === index ? 'now' : ''} />)}</span>
      </div>
      <div className="sb-top-r">
        <div className="sb-stat"><Star size={22} fill="#ffd23f" color="#ffd23f" aria-hidden="true" /> <b>{points}</b></div>
        <button type="button" className="sb-sq" onClick={onToggleSound} aria-label={sound ? 'Turn sound off' : 'Turn sound on'}>{sound ? <Volume2 size={24} aria-hidden="true" /> : <VolumeX size={24} aria-hidden="true" />}</button>
      </div>
    </div>
  )
}
