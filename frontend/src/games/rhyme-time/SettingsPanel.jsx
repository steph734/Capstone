import { X } from 'lucide-react'
import { WORD_SETS } from './rounds'

function Seg({ value, k, options, set }) {
  return (
    <div className="rt-seg" role="radiogroup">
      {options.map(([v, label]) => (
        <button key={String(v)} type="button" role="radio" aria-checked={value[k] === v} className={value[k] === v ? 'on' : ''} onClick={() => set(k, v)}>{label}</button>
      ))}
    </div>
  )
}

function Tog({ value, k, label, set }) {
  return <label className="rt-tog"><input type="checkbox" checked={Boolean(value[k])} onChange={(e) => set(k, e.target.checked)} /> {label}</label>
}

// Therapist-only settings (saved per patient).
export default function SettingsPanel({ value, onChange, onClose }) {
  const set = (k, v) => onChange({ ...value, [k]: v })
  return (
    <div className="rt-overlay rt-fixed" role="dialog" aria-modal="true" aria-label="Game settings">
      <div className="rt-card rt-settings">
        <div className="rt-settings-head"><h2>Game settings</h2><button type="button" onClick={onClose} aria-label="Close"><X size={20} /></button></div>
        <div className="rt-set-body">
          <p className="rt-set-label">Rounds</p>
          <Seg value={value} set={set} k="rounds" options={[[5, '5'], [10, '10']]} />
          <p className="rt-set-label">Word set</p>
          <Seg value={value} set={set} k="wordSet" options={Object.entries(WORD_SETS)} />
          <p className="rt-set-label">Choices per round</p>
          <Seg value={value} set={set} k="choices" options={[[2, '2'], [3, '3']]} />
          <p className="rt-set-label">Hint after</p>
          <Seg value={value} set={set} k="hintDelay" options={[[6, '6 sec'], [8, '8 sec'], [12, '12 sec']]} />
          <Tog value={value} set={set} k="autoPlay" label="Say the word automatically" />
          <Tog value={value} set={set} k="autoNext" label="Go to the next round by itself" />
        </div>
        <button type="button" className="rt-big primary" onClick={onClose}>Done</button>
      </div>
    </div>
  )
}
