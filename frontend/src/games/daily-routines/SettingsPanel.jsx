import { X } from 'lucide-react'

function Seg({ value, k, options, set }) {
  return (
    <div className="dr-seg" role="radiogroup">
      {options.map(([v, label]) => (
        <button key={String(v)} type="button" role="radio" aria-checked={value[k] === v} className={value[k] === v ? 'on' : ''} onClick={() => set(k, v)}>{label}</button>
      ))}
    </div>
  )
}

function Tog({ value, k, label, set }) {
  return <label className="dr-tog"><input type="checkbox" checked={Boolean(value[k])} onChange={(e) => set(k, e.target.checked)} /> {label}</label>
}

// Therapist-only settings (saved per patient).
export default function SettingsPanel({ value, onChange, onClose }) {
  const set = (k, v) => onChange({ ...value, [k]: v })
  return (
    <div className="dr-overlay dr-fixed" role="dialog" aria-modal="true" aria-label="Game settings">
      <div className="dr-modal dr-settings">
        <div className="dr-settings-head"><h2>Game settings</h2><button type="button" onClick={onClose} aria-label="Close"><X size={20} /></button></div>
        <div className="dr-set-body">
          <Tog value={value} set={set} k="placeExample" label="Place step 1 as an example" />
          <Tog value={value} set={set} k="showAll" label="Show all remaining steps (harder)" />
          <Tog value={value} set={set} k="readAloud" label="Read each step aloud when placed" />
          <p className="dr-set-label">Hint after</p>
          <Seg value={value} set={set} k="hintDelay" options={[[8, '8 sec'], [12, '12 sec'], [20, '20 sec']]} />
        </div>
        <button type="button" className="dr-big primary" onClick={onClose}>Done</button>
      </div>
    </div>
  )
}
