import { useState } from 'react'
import PatientSidebar from '../../components/PatientSidebar'
import BetaTag from '../../components/BetaTag'
import { getOwnerMenuItems } from './ownerSidebarConfig'
import '../PageWithSidebar.css'
import '../admin/AdminPages.css'

export default function OwnerPageShell({ user, onLogout, title, subtitle, icon, children, menuItems, betaTier, beta, headerActions }) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  // Default to the owner nav so a page that forgets to pass menuItems doesn't
  // fall back to the patient menu inside PatientSidebar.
  const resolvedMenuItems = menuItems ?? getOwnerMenuItems(betaTier)

  return (
    <div className="page-with-sidebar admin-page-shell">
      <PatientSidebar
        user={user}
        onLogout={onLogout}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        menuItems={resolvedMenuItems}
        bottomMenuItems={[]}
        profileRoleLabel="Owner"
        profilePath="/owner/profile"
      />

      <main className="page-content admin-page-content">
        <button className="mobile-menu-toggle" onClick={() => setSidebarOpen(true)} aria-label="Open menu">
          ☰
        </button>

        <div className="page-header admin-page-header">
          <div>
            <h1 style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              {icon && <span className="admin-header-title-icon">{icon}</span>}
              {title}
              {beta && <BetaTag />}
            </h1>
            <p>{subtitle}</p>
          </div>
          <div className="admin-header-right">
            {headerActions}
            <div className="admin-header-badge">
              <img src={user?.avatar || '/therapy-pro-logo.png'} alt={user?.name || 'Owner'} />
              <span>{user?.name || 'Owner'}</span>
            </div>
          </div>
        </div>

        <div className="content-container admin-content-container">
          {children}
        </div>
      </main>
    </div>
  )
}
