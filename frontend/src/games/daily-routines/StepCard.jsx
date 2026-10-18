import { Volume2 } from 'lucide-react'
import Picture from './pictures/Picture'

// One step card in the tray. `state`: idle | glow | wiggle.
export default function StepCard({ task, step, index, state, hidden, disabled, onPick, onHear }) {
  return (
    <div
      className={`dr-card ${state}`} style={hidden ? { visibility: 'hidden' } : undefined} role="button" tabIndex={disabled ? -1 : 0}
      aria-label={step.text} aria-disabled={disabled} data-card={step.id} data-pos={index + 1}
      onClick={() => !disabled && onPick(step)}
      onKeyDown={(e) => { if (!disabled && e.key === 'Enter') { e.preventDefault(); onPick(step) } }}
    >
      <button type="button" className="dr-spk" aria-label={`Hear: ${step.text}`} onClick={(e) => { e.stopPropagation(); onHear(step.text) }}><Volume2 size={16} aria-hidden="true" /></button>
      <div className="dr-pic"><Picture name={`${task.id}:${step.id}`} /></div>
      <span className="dr-steptext">{step.text}</span>
    </div>
  )
}
