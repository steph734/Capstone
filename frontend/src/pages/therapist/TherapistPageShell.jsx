import { useEffect, useState } from 'react'
import { authFetch } from '../../utils/session'
import { useNavigate } from 'react-router-dom'
import PatientSidebar from '../../components/PatientSidebar'
import BetaTag from '../../components/BetaTag'
import SyncStatus from '../../offline/SyncStatus'
import '../PageWithSidebar.css'
import '../admin/AdminPages.css'

export default function TherapistPageShell({ user, onLogout, title, subtitle, icon, children, menuItems, beta, bare }) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const navigate = useNavigate()
  // Notes handed to me by an absent colleague show as a count on Notes & Progress.
  const [coverCount, setCoverCount] = useState(0)
  useEffect(() => {
    if (!menuItems?.some((m) => m.id === 'notes-progress')) return undefined
    let alive = true
    let t
    // Quiet badge refresh: skipped while the tab is hidden, and stopped for good if the server refuses (expired or locked session).
    const load = () => { if (document.hidden) return; authFetch('/api/note-shares/shared-with-me').then((d) => { if (alive) setCoverCount(d.pendingCount || 0) }).catch((e) => { if (e?.status === 401 || e?.status === 403) clearInterval(t) }) }
    load()
    t = setInterval(load, 60000)
    return () => { alive = false; clearInterval(t) }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
  const items = menuItems?.map((m) => (m.id === 'notes-progress' && coverCount > 0 ? { ...m, badge: coverCount } : m))

  return (
    <div className="page-with-sidebar admin-page-shell">
      <PatientSidebar
        user={user}
        onLogout={onLogout}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        menuItems={items}
        bottomMenuItems={[]}
        profileRoleLabel="Therapist"
        profilePath="/therapist/profile"
      />

      <main className="page-content admin-page-content">
        <button className="mobile-menu-toggle" onClick={() => setSidebarOpen(true)} aria-label="Open menu">
          ☰
        </button>

        <div className="page-header admin-page-header">
          <div>
            <h1 style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              {title}
              {beta && <BetaTag />}
            </h1>
            <p>{subtitle}</p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <SyncStatus />
          <div className="admin-header-badge">
            <img src={user?.avatar || '/therapy-pro-logo.png'} alt={user?.name || 'Therapist'} />
            <span>{user?.name || 'Therapist'}</span>
          </div>
          </div>
        </div>

        <div className={bare ? 'admin-content-container' : 'content-container admin-content-container'} style={bare ? { maxWidth: 1280, margin: '0 auto' } : undefined}>
          {children}
        </div>
      </main>
    </div>
  )
}
