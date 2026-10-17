import { Check, Volume2 } from 'lucide-react'
import Picture from './pictures/Picture'

// state: idle | wiggle | wrong (faded, off) | faded | correct | hint
export default function ChoiceCard({ word, index, state, disabled, onPick, onHear, tag }) {
  return (
    <div
      className={`rt-choice ${state}`} role="button" tabIndex={disabled ? -1 : 0} aria-label={word} aria-disabled={disabled}
      data-key={index + 1}
      onClick={() => !disabled && onPick(word)}
      onKeyDown={(e) => { if (!disabled && e.key === 'Enter') { e.preventDefault(); onPick(word) } }}
    >
      {state === 'correct' && <span className="rt-check" aria-hidden="true"><Check size={30} strokeWidth={4} /></span>}
      {state === 'correct' && tag && <span className="rt-plus">{tag}</span>}
      <button type="button" className="rt-spk" aria-label={`Hear ${word}`} onClick={(e) => { e.stopPropagation(); onHear(word) }}><Volume2 size={18} aria-hidden="true" /></button>
      <div className="rt-choicepic"><Picture word={word} /></div>
      <span className="rt-choiceword">{word.toUpperCase()}</span>
    </div>
  )
}
