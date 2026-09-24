import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import AdminPageShell from './AdminPageShell'
import { adminMenuItems } from './adminSidebarConfig'
import { initialGames, initialBadges, defaultPointRules } from './gamifiedLibraryData'
import { GameControllerIcon, InboxIcon, MedalIcon, StarIcon, PlusIcon } from './gamifiedIcons'
import './GamifiedLibraryDashboard.css'

const initialRequests = [
  {
    id: 1,
    initial: 'A',
    color: '#3b82f6',
    owner: '[Owner name]',
    branch: '[Branch A]',
    date: 'Sep 22',
    status: 'Pending',
    title: 'Color Sorting',
    description: 'Sort objects by color to build visual discrimination in younger patients.',
    type: 'Cognitive',
    level: 'Easy',
  },
  {
    id: 2,
    initial: 'B',
    color: '#f59e0b',
    owner: '[Owner name]',
    branch: '[Branch B]',
    date: 'Sep 21',
    status: 'Pending',
    title: 'Breath Balloon',
    description: 'Blow into the mic to inflate a balloon for breath-control practice.',
    type: 'Speech',
    level: 'Medium',
  },
  {
    id: 3,
    initial: 'C',
    color: '#8b5cf6',
    owner: '[Owner name]',
    branch: '[Branch C]',
    date: 'Sep 19',
    status: 'Pending',
    title: 'Pinch & Place',
    description: 'Drag small items into slots to train fine-motor precision.',
    type: 'Occupational',
    level: 'Medium',
  },
]

const THERAPY_TYPES = [
  { type: 'Cognitive', color: '#3b82f6' },
  { type: 'Speech', color: '#e46a4b' },
  { type: 'Physical', color: '#2c4a3e' },
  { type: 'Occupational', color: '#d8eae0' },
]

const TABS = ['Pending', 'Approved', 'Declined', 'All']

export default function GamifiedLibraryDashboardPage({ user, onLogout }) {
  const navigate = useNavigate()
  const [requests, setRequests] = useState(initialRequests)
  const [activeTab, setActiveTab] = useState('Pending')

  const stats = useMemo(() => {
    const live = initialGames.filter((game) => game.status === 'Published').length
    const draft = initialGames.filter((game) => game.status === 'Draft').length
    const pending = requests.filter((request) => request.status === 'Pending').length
    const activeBadges = initialBadges.filter((badge) => badge.status === 'Active').length
    return {
      totalGames: initialGames.length,
      live,
      draft,
      pending,
      activeBadges,
      pointRules: defaultPointRules.length,
    }
  }, [requests])

  const counts = useMemo(() => ({
    Pending: requests.filter((r) => r.status === 'Pending').length,
    Approved: requests.filter((r) => r.status === 'Approved').length,
    Declined: requests.filter((r) => r.status === 'Declined').length,
    All: requests.length,
  }), [requests])

  const visibleRequests = useMemo(() => {
    if (activeTab === 'All') return requests
    return requests.filter((request) => request.status === activeTab)
  }, [requests, activeTab])

  const gamesByType = useMemo(() => {
    const counted = THERAPY_TYPES.map(({ type, color }) => ({
      type,
      color,
      count: initialGames.filter((game) => game.type === type).length,
    }))
    const max = Math.max(1, ...counted.map((t) => t.count))
    return counted.map((t) => ({ ...t, percent: Math.round((t.count / max) * 100) }))
  }, [])

  const updateStatus = (id, status) => {
    setRequests((current) => current.map((request) => (request.id === id ? { ...request, status } : request)))
  }

  return (
    <AdminPageShell
      user={user}
      onLogout={onLogout}
      title="Gamified Library"
      subtitle="Games, badges, and points that keep patients motivated"
      icon={<GameControllerIcon />}
      menuItems={adminMenuItems}
    >
      <div className="gl-hero">
        <h2>Library overview</h2>
        <p>Games, badges and points that keep patients motivated.</p>
      </div>

      <div className="admin-stats-grid">
        <section className="admin-stat-card">
          <div className="gl-stat-icon teal" aria-hidden="true"><GameControllerIcon /></div>
          <p className="admin-stat-label">Total games</p>
          <h3 className="admin-stat-value">{stats.totalGames}</h3>
          <p className="admin-stat-meta">{stats.live} live · {stats.draft} draft</p>
        </section>
        <section className="admin-stat-card">
          <div className="gl-stat-icon orange" aria-hidden="true"><InboxIcon /></div>
          <p className="admin-stat-label">Pending requests</p>
          <h3 className="admin-stat-value">{stats.pending}</h3>
          <p className="admin-stat-meta">From clinic owners</p>
        </section>
        <section className="admin-stat-card">
          <div className="gl-stat-icon purple" aria-hidden="true"><MedalIcon /></div>
          <p className="admin-stat-label">Active badges</p>
          <h3 className="admin-stat-value">{stats.activeBadges}</h3>
          <p className="admin-stat-meta">Visible to patients</p>
        </section>
        <section className="admin-stat-card">
          <div className="gl-stat-icon blue" aria-hidden="true"><StarIcon /></div>
          <p className="admin-stat-label">Point rules</p>
          <h3 className="admin-stat-value">{stats.pointRules}</h3>
          <p className="admin-stat-meta">Configured actions</p>
        </section>
      </div>

      <div className="gl-banner">
        <div className="gl-banner-header">
          <div className="gl-banner-title">
            <h3>Game requests from owners</h3>
            <span className="gl-pending-pill">{counts.Pending} pending</span>
          </div>
          <div className="gl-tab-row">
            {TABS.map((tab) => (
              <button
                key={tab}
                type="button"
                className={`gl-tab ${activeTab === tab ? 'active' : ''}`}
                onClick={() => setActiveTab(tab)}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>

        <div className="gl-request-grid">
          {visibleRequests.length === 0 && (
            <div className="gl-request-empty">No {activeTab.toLowerCase()} requests.</div>
          )}
          {visibleRequests.map((request) => (
            <div key={request.id} className="gl-request-card">
              <div className="gl-request-head">
                <div className="gl-request-who">
                  <span className="gl-avatar" style={{ background: request.color }}>{request.initial}</span>
                  <div>
                    <p>{request.owner}</p>
                    <span>{request.branch} · {request.date}</span>
                  </div>
                </div>
                <span className={`gl-status-pill ${request.status}`}>{request.status}</span>
              </div>

              <div className="gl-request-body">
                <h4>{request.title}</h4>
                <p>{request.description}</p>
              </div>

              <div className="admin-button-row">
                <span className="admin-pill gray">{request.type}</span>
                <span className="admin-pill yellow">{request.level}</span>
              </div>

              <button type="button" className="gl-request-link" onClick={() => navigate('/admin/games-library/games')}>
                View full request ›
              </button>

              {request.status === 'Pending' ? (
                <div className="gl-request-actions">
                  <button className="admin-btn-danger" type="button" onClick={() => updateStatus(request.id, 'Declined')}>
                    Decline
                  </button>
                  <button className="admin-btn" type="button" onClick={() => updateStatus(request.id, 'Approved')}>
                    Approve & Build
                  </button>
                </div>
              ) : (
                <div className="gl-request-actions">
                  <button className="admin-btn-secondary" type="button" onClick={() => updateStatus(request.id, 'Pending')}>
                    Move back to Pending
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="gl-bottom-grid">
        <div className="admin-panel">
          <div className="admin-panel-header">
            <div>
              <h3>Request summary</h3>
            </div>
            <button className="admin-btn-secondary" type="button" onClick={() => navigate('/admin/games-library/games')}>
              Open in Games
            </button>
          </div>

          <div className="gl-summary-tiles">
            <div className="gl-summary-tile pending">
              <strong>{counts.Pending}</strong>
              <span>Pending</span>
            </div>
            <div className="gl-summary-tile approved">
              <strong>{counts.Approved}</strong>
              <span>Approved</span>
            </div>
            <div className="gl-summary-tile declined">
              <strong>{counts.Declined}</strong>
              <span>Declined</span>
            </div>
          </div>

          <p className="gl-summary-note">
            Approving a request opens it in the game editor with the owner's details filled in. The owner is
            notified when the game is published or declined.
          </p>
        </div>

        <div className="admin-panel">
          <div className="admin-panel-header">
            <div>
              <h3>Games by therapy type</h3>
            </div>
          </div>

          <div className="gl-bar-list">
            {gamesByType.map((entry) => (
              <div key={entry.type}>
                <div className="gl-bar-row-label">
                  <span>{entry.type}</span>
                  <span>{entry.count}</span>
                </div>
                <div className="gl-bar-track">
                  <div className="gl-bar-fill" style={{ width: `${entry.percent}%`, background: entry.color }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="gl-actions-row">
        <button type="button" className="gl-action-card gl-action-primary" onClick={() => navigate('/admin/games-library/games')}>
          <span className="gl-action-icon" aria-hidden="true"><PlusIcon /></span>
          <div>
            <h4>Build a new game</h4>
            <p>Open the creation workspace</p>
          </div>
        </button>
        <button type="button" className="gl-action-card gl-action-secondary" onClick={() => navigate('/admin/games-library/badges')}>
          <span className="gl-action-icon" aria-hidden="true"><MedalIcon /></span>
          <div>
            <h4>Manage badges</h4>
            <p>Create or edit rewards</p>
          </div>
        </button>
        <button type="button" className="gl-action-card gl-action-secondary" onClick={() => navigate('/admin/games-library/stats')}>
          <span className="gl-action-icon" aria-hidden="true"><StarIcon /></span>
          <div>
            <h4>Tune point rules</h4>
            <p>Rewards, multipliers, levels</p>
          </div>
        </button>
      </div>
    </AdminPageShell>
  )
}
