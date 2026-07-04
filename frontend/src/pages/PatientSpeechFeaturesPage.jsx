import { useState } from 'react'
import PatientSidebar from '../components/PatientSidebar'
import SpeechFeaturesUI from './SpeechFeaturesUI'
import './Dashboard.css'

export default function PatientSpeechFeaturesPage({ user, onLogout, betaTier }) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const currentUser = user || { name: 'Alvrin', role: 'Patient', avatar: '/therapy-pro-logo.png' }

  return (
    <div className="dashboard-layout">
      <PatientSidebar
        user={currentUser}
        onLogout={onLogout}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        betaTier={betaTier}
        profilePath="/patient/profile"
      />

      <div className="dashboard-main" style={{ padding: '32px' }}>
        <button className="mobile-menu-btn" onClick={() => setSidebarOpen(true)} aria-label="Open menu">☰</button>

        <div style={{ marginBottom: 24 }}>
          <h1 style={{ fontSize: 26, fontWeight: 800, color: '#2c4a3e', margin: 0 }}>🎙️ Speech Features</h1>
          <p style={{ color: '#8a9e96', margin: '6px 0 0', fontSize: 14, fontWeight: 500 }}>Voice recorder and text-to-speech tools</p>
        </div>

        <SpeechFeaturesUI />
      </div>
    </div>
  )
}
