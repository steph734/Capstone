import { Clock, Pause, Star, Volume2, VolumeX, ChevronDown, ChevronUp } from 'lucide-react'
import { SPEED_FILL, SPEED_LABELS } from './config'

// Everything around the board. Lives in the same 1600x900 space as the board.
export default function HUD({ settings, targets, done, current, points, timeLabel, onPause, onToggleSound, onHear, message, tip, howOpen, onToggleHow, display }) {
  return (
    <>
      <div className="ab-top">
        <button type="button" className="ab-sq" onClick={onPause} aria-label="Pause"><Pause size={26} aria-hidden="true" /></button>
        <div className="ab-title"><span>Speech &amp; Language · Medium</span><strong>Alphabet Blast</strong></div>
        <div className="ab-az" aria-label="Letters popped so far">
          {targets.map((l) => (
            <span key={l} className={`ab-chip${done.has(l) ? ' done' : ''}${l === current ? ' now' : ''}`}>{display(l)}</span>
          ))}
        </div>
        <div className="ab-stats-r">
          <div className="ab-stat"><Star size={22} fill="#ffd23f" color="#ffd23f" aria-hidden="true" /> <b>{points}</b></div>
          {settings.showTimer && <div className="ab-stat"><Clock size={22} color="#9be3c5" aria-hidden="true" /> <b>{timeLabel}</b></div>}
          <button type="button" className="ab-sq" onClick={onToggleSound} aria-label={settings.sound ? 'Turn sound off' : 'Turn sound on'}>
            {settings.sound ? <Volume2 size={26} aria-hidden="true" /> : <VolumeX size={26} aria-hidden="true" />}
          </button>
        </div>
      </div>

      <div className="ab-target" role="status" aria-live="polite">
        <span className="ab-target-label">Pop the letter</span>
        <span className="ab-target-letter">{current ? display(current) : ''}</span>
        <button type="button" className="ab-hear" onClick={onHear}><Volume2 size={20} aria-hidden="true" /> Hear it</button>
        <small>Chain speed · {SPEED_LABELS[settings.speed]}</small>
        <div className="ab-speedbar"><i style={{ width: `${SPEED_FILL[settings.speed]}%` }} /></div>
      </div>

      <div className="ab-say" aria-live="polite">
        <p>{message}</p>
        {tip && <small>{tip}</small>}
      </div>

      <div className="ab-how">
        <button type="button" className="ab-how-head" onClick={onToggleHow} aria-expanded={howOpen}>
          How to play {howOpen ? <ChevronDown size={18} aria-hidden="true" /> : <ChevronUp size={18} aria-hidden="true" />}
        </button>
        {howOpen && <p>Tap the letter ball Pao asks for. Pao shoots a star and pops it. Pop A to Z before the balls reach the black hole.</p>}
      </div>
    </>
  )
}
