import PandaMascot from '../games/PandaMascot'
import { PAO_THEMES } from '../../data/paoThemes'
import { ShirtIcon } from './gamifiedIcons'

// One card per theme: Pao wearing the whole themed look, and a button that
// adds every piece of it to the wardrobe at once.
export default function PaoThemeSets({ clothes, addingId, onAdd, onClose }) {
  return (
    <div className="admin-modal-backdrop" onClick={onClose}>
      <div className="admin-modal pao-theme-sets-modal" onClick={(event) => event.stopPropagation()}>
        <div className="admin-modal-header">
          <div className="admin-modal-title">
            <span className="admin-modal-icon"><ShirtIcon /></span>
            <div>
              <h3>Theme sets</h3>
              <p>Add a whole seasonal outfit to Pao's wardrobe in one click — each piece can be edited afterwards.</p>
            </div>
          </div>
          <button className="admin-modal-close" onClick={onClose} aria-label="Close">✕</button>
        </div>

        <div className="pao-theme-sets-grid">
          {PAO_THEMES.map((theme) => {
            const looks = Object.entries(theme.looks)
            const accessories = Object.fromEntries(looks.map(([cat, look]) => [cat.toLowerCase(), { design: look.design }]))
            const missing = looks.filter(([, look]) => !clothes.some((c) => c.theme === theme.id && c.name === look.name))
            const busy = addingId === theme.id
            return (
              <article key={theme.id} className="pao-theme-set-card">
                <div className="pao-theme-set-stage" style={{ background: `radial-gradient(circle at 50% 38%, #fff 0%, ${theme.bg} 78%)` }}>
                  <PandaMascot pxWidth={150} pandaState="happy" accessories={accessories} viewPad={{ top: 60, bottom: 0 }} />
                </div>
                <h4><span aria-hidden="true">{theme.icon}</span> {theme.label}</h4>
                <ul>
                  {looks.map(([cat, look]) => <li key={cat}><strong>{cat}:</strong> {look.name}</li>)}
                </ul>
                <button
                  type="button"
                  className={missing.length ? 'admin-btn' : 'admin-btn-secondary'}
                  disabled={busy || !missing.length}
                  onClick={() => onAdd(theme)}
                >
                  {busy ? 'Adding…' : !missing.length ? 'In the wardrobe ✓' : missing.length < looks.length ? `Add ${missing.length} missing` : 'Add set'}
                </button>
              </article>
            )
          })}
        </div>
      </div>
    </div>
  )
}
