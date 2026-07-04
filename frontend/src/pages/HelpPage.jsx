import { useState } from 'react'
import PatientSidebar from '../components/PatientSidebar'
import './PageWithSidebar.css'

export default function HelpPage({ user, onLogout, betaTier }) {
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
          <h1>Help & Support</h1>
          <p>Get help with using Therapy Pro</p>
        </div>

        <div className="content-container">
          <div className="placeholder-content">
            <div className="placeholder-icon">❓</div>
            <h2>Help & Support Page</h2>
            <p>This page will provide help and support resources.</p>
            <p>Features coming soon:</p>
            <ul>
              <li>FAQ section</li>
              <li>Contact support</li>
              <li>Video tutorials</li>
              <li>Live chat support</li>
            </ul>
          </div>
        </div>
      </main>
    </div>
  )
}
