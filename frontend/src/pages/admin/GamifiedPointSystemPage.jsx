import { useMemo, useState } from 'react'
import AdminPageShell from './AdminPageShell'
import { adminMenuItems } from './adminSidebarConfig'
import { defaultPointRules } from './gamifiedLibraryData'

export default function GamifiedPointSystemPage({ user, onLogout }) {
  const [rules, setRules] = useState(defaultPointRules)
  const [savedAt, setSavedAt] = useState(null)

  const totalPoints = useMemo(() => rules.reduce((sum, rule) => sum + Number(rule.points || 0), 0), [rules])

  const updatePoints = (id, value) => {
    setSavedAt(null)
    setRules((current) => current.map((rule) => (rule.id === id ? { ...rule, points: value } : rule)))
  }

  const handleSave = (event) => {
    event.preventDefault()
    setRules((current) => current.map((rule) => ({ ...rule, points: Number(rule.points) || 0 })))
    setSavedAt(new Date())
  }

  const handleReset = () => {
    setRules(defaultPointRules)
    setSavedAt(null)
  }

  return (
    <AdminPageShell
      user={user}
      onLogout={onLogout}
      title="Point System"
      subtitle="Configure how patients earn points across the gamified library"
      icon="⭐"
      menuItems={adminMenuItems}
    >
      <div className="admin-stats-grid">
        <section className="admin-stat-card">
          <p className="admin-stat-label">Point Rules</p>
          <h3 className="admin-stat-value">{rules.length}</h3>
          <p className="admin-stat-meta">Configured actions</p>
        </section>
        <section className="admin-stat-card">
          <p className="admin-stat-label">Combined Points</p>
          <h3 className="admin-stat-value">{totalPoints}</h3>
          <p className="admin-stat-meta">If a patient triggers every rule once</p>
        </section>
      </div>

      <div className="admin-panel">
        <div className="admin-panel-header">
          <div>
            <h3>Point Rules</h3>
            <p>Set how many points each action rewards</p>
          </div>
        </div>

        <form onSubmit={handleSave}>
          <div className="admin-list">
            {rules.map((rule) => (
              <div key={rule.id} className="admin-list-item">
                <div>
                  <h4>{rule.label}</h4>
                </div>
                <label className="admin-field" style={{ width: '120px' }}>
                  <span>Points</span>
                  <input
                    type="number"
                    min="0"
                    value={rule.points}
                    onChange={(event) => updatePoints(rule.id, event.target.value)}
                  />
                </label>
              </div>
            ))}
          </div>

          <div className="admin-button-row" style={{ marginTop: '16px' }}>
            <button className="admin-btn" type="submit">Save Point System</button>
            <button className="admin-btn-secondary" type="button" onClick={handleReset}>Reset to Defaults</button>
            {savedAt && <span className="admin-pill green">Saved at {savedAt.toLocaleTimeString()}</span>}
          </div>
        </form>
      </div>
    </AdminPageShell>
  )
}
