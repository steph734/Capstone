import { useState } from 'react'
import PatientSidebar from '../components/PatientSidebar'
import './PageWithSidebar.css'

export default function SettingsPage({ user, onLogout, betaTier }) {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <div className="page-with-sidebar">
      <PatientSidebar 
        user={user} 
        onLogout={onLogout}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        betaTier={betaTier}
        profilePath="/patient/profile"
      />
      
      <main className="page-content">
        <button 
          className="mobile-menu-toggle"
          onClick={() => setSidebarOpen(true)}
        >
          ☰
        </button>

        <div className="page-header">
          <h1>Settings</h1>
          <p>Manage your account and preferences</p>
        </div>

        <div className="content-container">
          <div className="placeholder-content">
            <div className="placeholder-icon">⚙️</div>
            <h2>Settings Page</h2>
            <p>This page will manage account settings and preferences.</p>
            <p>Features coming soon:</p>
            <ul>
              <li>Profile settings</li>
              <li>Privacy settings</li>
              <li>Notification preferences</li>
              <li>Security settings</li>
            </ul>
          </div>
        </div>
      </main>
    </div>
  )
}
