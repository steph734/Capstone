import { X } from 'lucide-react'
import { EMERGENCIES } from './emergencies'

// Therapist-only settings (saved per patient).
export default function SettingsPanel({ value, onChange, onClose }) {
  const set = (k, v) => onChange({ ...value, [k]: v })
  const toggleShown = (id) => {
    const has = value.shown.includes(id)
    const next = has ? value.shown.filter((x) => x !== id) : [...value.shown, id]
    if (next.length) set('shown', next)
  }
  return (
    <div className="er-overlay er-fixed" role="dialog" aria-modal="true" aria-label="Game settings">
      <div className="er-modal er-settings">
        <div className="er-settings-head"><h2>Game settings</h2><button type="button" onClick={onClose} aria-label="Close"><X size={20} /></button></div>
        <div className="er-set-body">
          <p className="er-set-label">Emergencies shown</p>
          {EMERGENCIES.map((e) => (
            <label key={e.id} className="er-tog"><input type="checkbox" checked={value.shown.includes(e.id)} onChange={() => toggleShown(e.id)} /> {e.name}</label>
          ))}
          <p className="er-set-label">Options</p>
          <label className="er-tog"><input type="checkbox" checked={value.readAloud} onChange={(e) => set('readAloud', e.target.checked)} /> Read every card aloud automatically</label>
          <label className="er-tog"><input type="checkbox" checked={value.practice} onChange={(e) => set('practice', e.target.checked)} /> Include the practice round</label>
          <p className="er-set-label">Local hotline number</p>
          <input className="er-input" value={value.hotline} maxLength={8} onChange={(e) => set('hotline', e.target.value.replace(/[^0-9]/g, ''))} aria-label="Hotline number" />
        </div>
        <button type="button" className="er-big primary" onClick={onClose}>Done</button>
      </div>
    </div>
  )
}
