import { Check, Pause, Star, Volume2, VolumeX } from 'lucide-react'

const CHIPS = ['Pick an emergency', 'What is it?', 'Learn what to do', 'Pack the go-bag']

// current: 0-3 (index of the chip being worked on). No timers here, ever.
export default function HUD({ label, current, points, sound, onPause, onToggleSound, calm }) {
  return (
    <div className="er-top">
      <div className="er-top-l">
        <button type="button" className="er-pill-btn sq" onClick={onPause} aria-label="Pause"><Pause size={22} aria-hidden="true" /></button>
        <div className="er-title"><span>Cognitive · {label}</span><strong>Emergency Ready</strong></div>
      </div>
      <ol className="er-chips" aria-label="Where you are">
        {CHIPS.map((c, i) => (
          <li key={c} className={i < current ? 'done' : i === current ? 'now' : ''} aria-current={i === current ? 'step' : undefined}>
            {i < current && <Check size={15} strokeWidth={3.5} aria-hidden="true" />}{i >= current && `${i + 1}. `}{c}
          </li>
        ))}
      </ol>
      <div className="er-top-r">
        {calm}
        <div className="er-pill-btn stat"><Star size={20} fill="#ffc83d" color="#ffc83d" aria-hidden="true" /> <b>{points}</b></div>
        <button type="button" className="er-pill-btn sq" onClick={onToggleSound} aria-label={sound ? 'Turn sound off' : 'Turn sound on'}>{sound ? <Volume2 size={22} aria-hidden="true" /> : <VolumeX size={22} aria-hidden="true" />}</button>
      </div>
    </div>
  )
}
