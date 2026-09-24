import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import AdminPageShell from './AdminPageShell'
import { adminMenuItems } from './adminSidebarConfig'
import { initialGames, initialBadges, defaultPointRules } from './gamifiedLibraryData'

const QUICK_LINKS = [
  { path: '/admin/games-library/games', icon: '🎮', label: 'Games', description: 'Add, edit, or publish gamified exercises' },
  { path: '/admin/games-library/badges', icon: '🏅', label: 'Badges', description: 'Manage badges patients can unlock' },
  { path: '/admin/games-library/stats', icon: '📊', label: 'Stats', description: 'See engagement across all games' },
  { path: '/admin/games-library/points', icon: '⭐', label: 'Point System', description: 'Configure how points are earned' },
]

export default function GamifiedLibraryDashboardPage({ user, onLogout }) {
  const navigate = useNavigate()

  const stats = useMemo(() => {
    const published = initialGames.filter((game) => game.status === 'Published').length
    const activeBadges = initialBadges.filter((badge) => badge.status === 'Active').length
    const pointsPerAction = defaultPointRules.reduce((sum, rule) => sum + rule.points, 0) / defaultPointRules.length
    return {
      totalGames: initialGames.length,
      published,
      totalBadges: initialBadges.length,
      activeBadges,
      avgPoints: Math.round(pointsPerAction),
    }
  }, [])

  return (
    <AdminPageShell
      user={user}
      onLogout={onLogout}
      title="Gamified Library"
      subtitle="Overview of games, badges, stats, and the point system"
      icon="🎮"
      menuItems={adminMenuItems}
    >
      <div className="admin-stats-grid">
        <section className="admin-stat-card">
          <p className="admin-stat-label">Total Games</p>
          <h3 className="admin-stat-value">{stats.totalGames}</h3>
          <p className="admin-stat-meta">{stats.published} published</p>
        </section>
        <section className="admin-stat-card">
          <p className="admin-stat-label">Badges</p>
          <h3 className="admin-stat-value">{stats.totalBadges}</h3>
          <p className="admin-stat-meta">{stats.activeBadges} active</p>
        </section>
        <section className="admin-stat-card">
          <p className="admin-stat-label">Avg. Points per Action</p>
          <h3 className="admin-stat-value">{stats.avgPoints}</h3>
          <p className="admin-stat-meta">Across all point rules</p>
        </section>
        <section className="admin-stat-card">
          <p className="admin-stat-label">Therapy Types</p>
          <h3 className="admin-stat-value">{new Set(initialGames.map((g) => g.type)).size}</h3>
          <p className="admin-stat-meta">Covered by current games</p>
        </section>
      </div>

      <div className="admin-panel">
        <div className="admin-panel-header">
          <div>
            <h3>Manage the Gamified Library</h3>
            <p>Jump into games, badges, stats, or the point system</p>
          </div>
        </div>

        <div className="admin-list">
          {QUICK_LINKS.map((link) => (
            <button
              key={link.path}
              type="button"
              className="admin-list-item"
              style={{ width: '100%', border: '1px solid #e8f5f0', cursor: 'pointer', textAlign: 'left', font: 'inherit' }}
              onClick={() => navigate(link.path)}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px', minWidth: 0 }}>
                <span className="admin-modal-icon" aria-hidden="true">{link.icon}</span>
                <div>
                  <h4>{link.label}</h4>
                  <p>{link.description}</p>
                </div>
              </div>
              <span aria-hidden="true">→</span>
            </button>
          ))}
        </div>
      </div>
    </AdminPageShell>
  )
}
