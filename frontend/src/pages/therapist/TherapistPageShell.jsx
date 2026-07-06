import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import PatientSidebar from '../../components/PatientSidebar'
import BetaTag from '../../components/BetaTag'
import '../PageWithSidebar.css'
import '../admin/AdminPages.css'

export default function TherapistPageShell({ user, onLogout, title, subtitle, icon, children, menuItems, beta }) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const navigate = useNavigate()

  return (
    <div className="page-with-sidebar admin-page-shell">
      <PatientSidebar
        user={user}
        onLogout={onLogout}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        menuItems={menuItems}
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
          <div className="admin-header-badge">
            <img src={user?.avatar || '/therapy-pro-logo.png'} alt={user?.name || 'Therapist'} />
            <span>{user?.name || 'Therapist'}</span>
          </div>
        </div>

        <div className="content-container admin-content-container">
          {children}
        </div>
      </main>
    </div>
  )
}
