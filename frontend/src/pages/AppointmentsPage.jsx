import { useState } from 'react'
import PatientSidebar from '../components/PatientSidebar'
import './PageWithSidebar.css'

export default function AppointmentsPage({ user, onLogout }) {
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
          <h1>Appointments</h1>
          <p>Manage your therapy appointments</p>
        </div>

        <div className="content-container">
          <div className="placeholder-content">
            <div className="placeholder-icon">📅</div>
            <h2>Appointments Page</h2>
            <p>This page will display upcoming and past appointments.</p>
            <p>Features coming soon:</p>
            <ul>
              <li>View upcoming appointments</li>
              <li>Schedule new appointments</li>
              <li>Cancel or reschedule</li>
              <li>View appointment history</li>
            </ul>
          </div>
        </div>
      </main>
    </div>
  )
}
