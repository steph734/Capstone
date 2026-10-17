import { Check, Volume2 } from 'lucide-react'
import Picture from './pictures/Picture'

// state: idle | found | wrong | glow | faded
export default function PictureCard({ word, index, state, showWord, label, disabled, onPick, onHear }) {
  return (
    <div
      className={`sh-card ${state}`} role="button" tabIndex={disabled ? -1 : 0} aria-label={word} aria-disabled={disabled}
      onClick={() => !disabled && onPick(word)}
      onKeyDown={(e) => { if (!disabled && e.key === 'Enter') { e.preventDefault(); onPick(word) } }}
      data-key={index + 1}
    >
      {state === 'found' && <span className="sh-check" aria-hidden="true"><Check size={30} strokeWidth={4} /></span>}
      {label && <span className="sh-wronglabel">{label}</span>}
      <button type="button" className="sh-spk" aria-label={`Hear ${word}`} onClick={(e) => { e.stopPropagation(); onHear(word) }}><Volume2 size={18} aria-hidden="true" /></button>
      <div className="sh-pic"><Picture word={word} /></div>
      {showWord && (
        <span className="sh-word">
          <span className={state === 'found' ? 'sh-orange' : undefined}>{word.charAt(0).toUpperCase()}</span>{word.slice(1).toUpperCase()}
        </span>
      )}
    </div>
  )
}
