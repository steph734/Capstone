import { useState } from 'react'
import PatientSidebar from '../components/PatientSidebar'
import './PageWithSidebar.css'

export default function MessagesPage({ user, onLogout, betaTier }) {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <div className="page-with-sidebar">
      <PatientSidebar 
        user={user} 
        onLogout={onLogout}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        betaTier={betaTier}
      />
      
      <main className="page-content">
        <button 
          className="mobile-menu-toggle"
          onClick={() => setSidebarOpen(true)}
        >
          ☰
        </button>

        <div className="page-header">
          <h1>Messages</h1>
          <p>Communicate with your therapy team</p>
        </div>

        <div className="content-container">
          <div className="placeholder-content">
            <div className="placeholder-icon">💬</div>
            <h2>Messages Page</h2>
            <p>This page will enable messaging with therapists.</p>
            <p>Features coming soon:</p>
            <ul>
              <li>Send messages to therapists</li>
              <li>View message history</li>
              <li>Receive notifications</li>
              <li>Attach files and images</li>
            </ul>
          </div>
        </div>
      </main>
    </div>
  )
}
