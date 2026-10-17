import { X } from 'lucide-react'
import { HINT_DELAYS, LETTER_SETS, SPEED_LABELS } from './config'

function Seg({ value, k, options, set }) {
  return (
    <div className="ab-seg" role="radiogroup">
      {options.map(([v, label]) => (
        <button key={String(v)} type="button" role="radio" aria-checked={value[k] === v} className={value[k] === v ? 'on' : ''} onClick={() => set(k, v)}>{label}</button>
      ))}
    </div>
  )
}

function Tog({ value, k, label, set }) {
  return <label className="ab-tog"><input type="checkbox" checked={Boolean(value[k])} onChange={(e) => set(k, e.target.checked)} /> {label}</label>
}

// Therapist-only game settings (saved per patient).
export default function SettingsPanel({ value, onChange, onClose }) {
  const set = (k, v) => onChange({ ...value, [k]: v })
  return (
    <div className="ab-overlay" role="dialog" aria-modal="true" aria-label="Game settings">
      <div className="ab-card ab-settings">
        <div className="ab-settings-head"><h2>Game settings</h2><button type="button" onClick={onClose} aria-label="Close"><X size={20} /></button></div>
        <div className="ab-set-body">
          <p className="ab-set-label">Chain speed</p>
          <Seg value={value} set={set} k="speed" options={Object.entries(SPEED_LABELS)} />
          <p className="ab-set-label">Letters</p>
          <Seg value={value} set={set} k="letterSet" options={Object.entries(LETTER_SETS)} />
          {value.letterSet === 'custom' && (
            <input className="ab-input" value={value.customLetters} maxLength={26} placeholder="e.g. ABCDM" onChange={(e) => set('customLetters', e.target.value.toUpperCase().replace(/[^A-Z]/g, ''))} aria-label="Custom letters" />
          )}
          <p className="ab-set-label">Letter case</p>
          <Seg value={value} set={set} k="letterCase" options={[['upper', 'ABC'], ['lower', 'abc'], ['both', 'Both']]} />
          <p className="ab-set-label">Hint after</p>
          <Seg value={value} set={set} k="hintDelay" options={HINT_DELAYS.map((s) => [s, `${s} sec`])} />
          <Tog value={value} set={set} k="autoSpeak" label="Say each letter out loud" />
          <Tog value={value} set={set} k="showTimer" label="Show the timer" />
        </div>
        <button type="button" className="ab-big primary" onClick={onClose}>Done</button>
      </div>
    </div>
  )
}
