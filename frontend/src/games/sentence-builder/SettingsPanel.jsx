import { X } from 'lucide-react'

function Seg({ value, k, options, set }) {
  return (
    <div className="sb-seg" role="radiogroup">
      {options.map(([v, label]) => (
        <button key={String(v)} type="button" role="radio" aria-checked={value[k] === v} className={value[k] === v ? 'on' : ''} onClick={() => set(k, v)}>{label}</button>
      ))}
    </div>
  )
}

function Tog({ value, k, label, set }) {
  return <label className="sb-tog"><input type="checkbox" checked={Boolean(value[k])} onChange={(e) => set(k, e.target.checked)} /> {label}</label>
}

// Therapist-only settings (saved per patient). The 7 puzzles and their order are fixed.
export default function SettingsPanel({ value, onChange, onClose }) {
  const set = (k, v) => onChange({ ...value, [k]: v })
  return (
    <div className="sb-overlay sb-fixed" role="dialog" aria-modal="true" aria-label="Game settings">
      <div className="sb-modal sb-settings">
        <div className="sb-settings-head"><h2>Game settings</h2><button type="button" onClick={onClose} aria-label="Close"><X size={20} /></button></div>
        <div className="sb-set-body">
          <p className="sb-set-label">Say the sentence first</p>
          <Seg value={value} set={set} k="sayFirst" options={[['easy', 'Easy only'], ['all', 'All levels'], ['never', 'Never']]} />
          <p className="sb-set-label">Hint after</p>
          <Seg value={value} set={set} k="hintDelay" options={[[6, '6 sec'], [10, '10 sec'], [15, '15 sec']]} />
          <Tog value={value} set={set} k="showColors" label="Show word colors" />
          <Tog value={value} set={set} k="autoNext" label="Go to the next sentence by itself" />
        </div>
        <button type="button" className="sb-big primary" onClick={onClose}>Done</button>
      </div>
    </div>
  )
}
