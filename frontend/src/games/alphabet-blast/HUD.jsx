import { Clock, Flame, Info, Pause, Star, Volume2, VolumeX, X } from 'lucide-react'
import { SPEED_BUTTONS, SPEED_ORDER } from './config'

// Everything around the board. Lives in the same stage space as the board (1440x900 landscape).
export default function HUD({
  settings, targets, done, current, points, timeLabel, onPause, onToggleSound, onHear, onSpeed, message, tip, howOpen, onToggleHow,
  display, preview, combo, difficulty, avatar,
}) {
  return (
    <>
      <div className="ab-top">
        <button type="button" className="ab-glass ab-sq" onClick={onPause} aria-label="Pause"><Pause size={26} aria-hidden="true" /></button>
        <div className="ab-title"><span>Speech &amp; Language · {difficulty}</span><strong>Alphabet Blast</strong></div>
        <div className="ab-stats-r">
          <div className="ab-glass ab-stat" aria-label={`Score ${points}`}><Star size={26} fill="#FFD43B" color="#FFD43B" aria-hidden="true" /><b>{points}</b></div>
          {settings.showTimer && <div className="ab-glass ab-stat" aria-label={`Time ${timeLabel}`}><Clock size={24} color="#fff" aria-hidden="true" /><b>{timeLabel}</b></div>}
          <button type="button" className="ab-glass ab-sq" onClick={onToggleSound} aria-label={settings.sound ? 'Turn sound off' : 'Turn sound on'}>
            {settings.sound ? <Volume2 size={26} aria-hidden="true" /> : <VolumeX size={26} aria-hidden="true" />}
          </button>
        </div>
      </div>

      <div className="ab-strip" role="list" aria-label="Letters popped so far">
        {targets.map((l) => (
          <span key={l} role="listitem" aria-current={l === current ? 'step' : undefined} className={`ab-chip${done.has(l) ? ' done' : ''}${l === current ? ' now' : ''}`}>{display(l)}</span>
        ))}
      </div>
      {preview && <div className="ab-previewpill"><Info size={13} aria-hidden="true" /> Preview mode: scores are not saved</div>}
      {combo && <div key={combo.key} className="ab-combo" role="status"><Flame size={18} aria-hidden="true" /> Combo x{combo.n}! Keep going</div>}

      <div className="ab-target">
        <span className="ab-target-label">Pop the letter</span>
        <span className="ab-target-letter" role="status" aria-live="polite" aria-label={current ? `Pop the letter ${display(current)}` : undefined}>{current ? display(current) : ''}</span>
        <button type="button" className="ab-hear" onClick={onHear}><Volume2 size={20} aria-hidden="true" /> Hear it</button>
        <span className="ab-speed-label" id="ab-speed-label">Chain speed</span>
        <div className="ab-speedseg" role="radiogroup" aria-labelledby="ab-speed-label">
          {SPEED_ORDER.map((k) => (
            <button key={k} type="button" role="radio" aria-checked={settings.speed === k} className={settings.speed === k ? 'on' : ''} onClick={() => onSpeed(k)}>{SPEED_BUTTONS[k]}</button>
          ))}
        </div>
      </div>

      <div className="ab-say" aria-live="polite">
        {avatar}
        <div className="ab-bubble">
          <p>{message}</p>
          {tip && <small>{tip}</small>}
        </div>
      </div>

      <div className="ab-how">
        {howOpen && (
          <div className="ab-how-panel" role="region" aria-label="How to play">
            <button type="button" className="ab-how-x" onClick={onToggleHow} aria-label="Close how to play"><X size={16} aria-hidden="true" /></button>
            <b>How to play</b>
            <p>Tap the letter ball Pao asks for. Pao blasts a star and pops it. Pop A to Z before the chain reaches the black hole.</p>
          </div>
        )}
        <button type="button" className="ab-how-chip" onClick={onToggleHow} aria-expanded={howOpen}><Info size={18} aria-hidden="true" /> How to play</button>
      </div>
    </>
  )
}
