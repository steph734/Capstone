import { useState } from 'react'
import PatientSidebar from '../components/PatientSidebar'
import './PageWithSidebar.css'

export default function NotesPage({ user, onLogout }) {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <div className="page-with-sidebar">
      <PatientSidebar 
        user={user} 
        onLogout={onLogout}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />
      
      <main className="page-content">
        <button 
          className="mobile-menu-toggle"
          onClick={() => setSidebarOpen(true)}
        >
          ☰
        </button>

        <div className="page-header">
          <h1>Notes</h1>
          <p>View therapy session notes and progress reports</p>
        </div>

        <div className="content-container">
          <div className="placeholder-content">
            <div className="placeholder-icon">📝</div>
            <h2>Notes Page</h2>
            <p>This page will display therapy notes and progress reports.</p>
            <p>Features coming soon:</p>
            <ul>
              <li>View session notes</li>
              <li>Progress reports</li>
              <li>Therapist feedback</li>
              <li>Search and filter notes</li>
            </ul>
          </div>
        </div>
      </main>
    </div>
  )
}
