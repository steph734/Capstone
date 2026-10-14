import { useState } from 'react'
import PatientSidebar from '../../components/PatientSidebar'
import '../PageWithSidebar.css'
import './AdminPages.css'

// `headerActions` puts buttons on the right of the title row. `bare` drops the
// white wrapper (and the profile badge) so the page's own cards sit directly on
// the mint page background.
export default function AdminPageShell({ user, onLogout, title, subtitle, icon, children, menuItems, headerActions, bare }) {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <div className="page-with-sidebar admin-page-shell">
      <PatientSidebar
        user={user}
        onLogout={onLogout}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        menuItems={menuItems}
        bottomMenuItems={[]}
        profileRoleLabel="Super Admin"
        profilePath="/admin/profile"
      />

      <main className="page-content admin-page-content">
        <button className="mobile-menu-toggle" onClick={() => setSidebarOpen(true)} aria-label="Open menu">
          ☰
        </button>

        <div className={`page-header admin-page-header${bare && headerActions ? ' has-actions' : ''}`}>
          <div>
            <h1>{title}</h1>
            <p>{subtitle}</p>
          </div>
          <div className="admin-header-actions">
            {headerActions}
            {!bare && (
              <div className="admin-header-badge">
                <img src={user?.avatar || '/therapy-pro-logo.png'} alt={user?.name || 'Super Admin'} />
                <span>{user?.name || 'Super Admin'}</span>
              </div>
            )}
          </div>
        </div>

        <div className={`content-container admin-content-container${bare ? ' admin-content-bare' : ''}`}>
          {children}
        </div>
      </main>
    </div>
  )
}
