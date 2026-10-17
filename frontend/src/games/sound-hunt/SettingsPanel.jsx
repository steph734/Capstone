import { X } from 'lucide-react'

function Seg({ value, k, options, set }) {
  return (
    <div className="sh-seg" role="radiogroup">
      {options.map(([v, label]) => (
        <button key={String(v)} type="button" role="radio" aria-checked={value[k] === v} className={value[k] === v ? 'on' : ''} onClick={() => set(k, v)}>{label}</button>
      ))}
    </div>
  )
}

function Tog({ value, k, label, set }) {
  return <label className="sh-tog"><input type="checkbox" checked={Boolean(value[k])} onChange={(e) => set(k, e.target.checked)} /> {label}</label>
}

// Therapist-only settings (saved per patient). 5 rounds is fixed.
export default function SettingsPanel({ value, onChange, onClose }) {
  const set = (k, v) => onChange({ ...value, [k]: v })
  return (
    <div className="sh-overlay sh-fixed" role="dialog" aria-modal="true" aria-label="Game settings">
      <div className="sh-modal sh-settings">
        <div className="sh-settings-head"><h2>Game settings</h2><button type="button" onClick={onClose} aria-label="Close"><X size={20} /></button></div>
        <div className="sh-set-body">
          <p className="sh-set-label">Hint after</p>
          <Seg value={value} set={set} k="hintDelay" options={[[6, '6 sec'], [10, '10 sec'], [15, '15 sec']]} />
          <Tog value={value} set={set} k="saySound" label="Say the sound 3 times at the start" />
          <Tog value={value} set={set} k="showWords" label="Show the word under each picture" />
          <Tog value={value} set={set} k="autoNext" label="Go to the next sound by itself" />
        </div>
        <button type="button" className="sh-big primary" onClick={onClose}>Done</button>
      </div>
    </div>
  )
}
