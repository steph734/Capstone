import { useNavigate, useParams } from 'react-router-dom'
import TherapistPageShell from './TherapistPageShell'
import { getTherapistMenuItems } from './therapistSidebarConfig'

// /therapist/gamified-activities/patients/:patientId — placeholder.
// The full per-patient dashboard (character stats, session analytics tabs,
// weekly completion, independence chart, Pao summary card) isn't built yet;
// this stands in so "View Stats" opens a real page instead of a dead link.
export default function TherapistPatientStatsPage({ user, onLogout, betaTier }) {
  const { patientId } = useParams()
  const navigate = useNavigate()
  return (
    <TherapistPageShell user={user} onLogout={onLogout} title="Patient Stats" subtitle="Full per-patient dashboard" menuItems={getTherapistMenuItems(betaTier)}>
      <div className="rounded-[22px] bg-white p-8 text-center" style={{ border: '1px solid #E4EBE8' }}>
        <button type="button" onClick={() => navigate('/therapist/gamified-activities')} className="mb-4 text-[14px] font-extrabold" style={{ color: '#234C40' }}>← Back to Gamified Stats</button>
        <p className="text-[16px] font-bold" style={{ color: '#1F3D36' }}>The full stats dashboard for this patient isn't built yet.</p>
        <p className="mt-1 text-[13px]" style={{ color: '#5D7770' }}>Patient ID: {patientId}</p>
      </div>
    </TherapistPageShell>
  )
}
