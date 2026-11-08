import { Lock } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import GamifiedFullPage from './GamifiedFullPage'
import useClinicPlan from '../hooks/useClinicPlan'

export default function PatientGamifiedActivitiesPage({ user }) {
  const navigate = useNavigate()
  const clinic = useClinicPlan(true)
  const patientId = (user?.name || 'alvrin').toLowerCase()
  if (clinic.gamified === false) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, background: 'linear-gradient(180deg,#56b8ee,#bdeafd)', fontFamily: "'Atkinson Hyperlegible','Segoe UI',system-ui,sans-serif" }}>
        <div style={{ background: '#fff', borderRadius: 24, padding: '32px 28px', maxWidth: 420, textAlign: 'center', boxShadow: '0 20px 50px rgba(0,0,0,.2)' }}>
          <Lock size={44} color="#51647a" aria-hidden="true" />
          <h2 style={{ margin: '12px 0 6px', fontSize: 24, color: '#1d3557' }}>Gamified Activities are locked</h2>
          <p style={{ margin: '0 0 20px', color: '#51647a', fontSize: 16, lineHeight: 1.5 }}>Games are part of the clinic&apos;s Gold plan. They will unlock here as soon as the clinic subscribes to Gold.</p>
          <button type="button" onClick={() => navigate('/dashboard')} style={{ minHeight: 48, padding: '0 28px', borderRadius: 14, border: 0, background: '#2c5a47', color: '#fff', fontSize: 16, fontWeight: 800, cursor: 'pointer' }}>Back to home</button>
        </div>
      </div>
    )
  }
  return <GamifiedFullPage backPath="/dashboard" patientId={patientId} patientEmail={user?.email || null} patientName={user?.name || null} />
}
