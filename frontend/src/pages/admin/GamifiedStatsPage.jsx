import { useMemo, useState } from 'react'
import AdminPageShell from './AdminPageShell'
import { adminMenuItems } from './adminSidebarConfig'
import { initialGames, initialBadges, defaultPointRules } from './gamifiedLibraryData'

const GAME_STATS = [
  { name: 'Memory Match', plays: 482, completionRate: 88, avgScore: 76, avgMinutes: 6 },
  { name: 'Sound Builder', plays: 129, completionRate: 61, avgScore: 58, avgMinutes: 9 },
  { name: 'Balance Quest', plays: 214, completionRate: 72, avgScore: 69, avgMinutes: 12 },
]

const BADGE_STATS = [
  { name: 'First Steps', timesEarned: 340 },
  { name: 'Streak Master', timesEarned: 118 },
  { name: 'Perfectionist', timesEarned: 54 },
  { name: 'Explorer', timesEarned: 22 },
]

export default function GamifiedStatsPage({ user, onLogout }) {
  const [rules, setRules] = useState(defaultPointRules)
  const [savedAt, setSavedAt] = useState(null)

  const overview = useMemo(() => {
    const totalPlays = GAME_STATS.reduce((sum, g) => sum + g.plays, 0)
    const avgCompletion = Math.round(GAME_STATS.reduce((sum, g) => sum + g.completionRate, 0) / GAME_STATS.length)
    const totalBadgesEarned = BADGE_STATS.reduce((sum, b) => sum + b.timesEarned, 0)
    const topGame = [...GAME_STATS].sort((a, b) => b.plays - a.plays)[0]
    return { totalPlays, avgCompletion, totalBadgesEarned, topGame }
  }, [])

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
      title="Stats & Points"
      subtitle="Engagement across games and badges, plus how points are earned"
      icon="📊"
      menuItems={adminMenuItems}
    >
      <div className="admin-stats-grid">
        <section className="admin-stat-card">
          <p className="admin-stat-label">Total Plays</p>
          <h3 className="admin-stat-value">{overview.totalPlays}</h3>
          <p className="admin-stat-meta">Across {initialGames.length} games</p>
        </section>
        <section className="admin-stat-card">
          <p className="admin-stat-label">Avg. Completion Rate</p>
          <h3 className="admin-stat-value">{overview.avgCompletion}%</h3>
          <p className="admin-stat-meta">Across published games</p>
        </section>
        <section className="admin-stat-card">
          <p className="admin-stat-label">Badges Earned</p>
          <h3 className="admin-stat-value">{overview.totalBadgesEarned}</h3>
          <p className="admin-stat-meta">Across {initialBadges.length} badge types</p>
        </section>
        <section className="admin-stat-card">
          <p className="admin-stat-label">Most Played</p>
          <h3 className="admin-stat-value" style={{ fontSize: '20px' }}>{overview.topGame.name}</h3>
          <p className="admin-stat-meta">{overview.topGame.plays} plays</p>
        </section>
      </div>

      <div className="admin-table-card">
        <div className="admin-panel-header" style={{ padding: '20px 20px 0' }}>
          <div>
            <h3>Game Performance</h3>
            <p>Plays, completion, and average scores per game</p>
          </div>
        </div>
        <div className="admin-table-scroll">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Game</th>
                <th>Plays</th>
                <th>Completion Rate</th>
                <th>Avg. Score</th>
                <th>Avg. Session</th>
              </tr>
            </thead>
            <tbody>
              {GAME_STATS.map((game) => (
                <tr key={game.name}>
                  <td>{game.name}</td>
                  <td>{game.plays}</td>
                  <td>{game.completionRate}%</td>
                  <td>{game.avgScore}</td>
                  <td>{game.avgMinutes} min</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="admin-table-card">
        <div className="admin-panel-header" style={{ padding: '20px 20px 0' }}>
          <div>
            <h3>Badge Performance</h3>
            <p>How often each badge has been earned</p>
          </div>
        </div>
        <div className="admin-table-scroll">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Badge</th>
                <th>Times Earned</th>
              </tr>
            </thead>
            <tbody>
              {BADGE_STATS.map((badge) => (
                <tr key={badge.name}>
                  <td>{badge.name}</td>
                  <td>{badge.timesEarned}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="admin-panel">
        <div className="admin-panel-header">
          <div>
            <h3>Point Rules</h3>
            <p>Set how many points each action rewards ({rules.length} rules, {totalPoints} pts combined)</p>
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
