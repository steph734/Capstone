import { useNavigate, useParams } from 'react-router-dom'
import AppointmentsPage from './AppointmentsPage'
import RecommendationBookingModal from '../components/RecommendationBookingModal'

// /appointments/recommendation/:id — the link in the recommendation email. It shows
// the guardian's Appointments page with the "Set next therapy session" popup on top;
// closing the popup just leaves them on Appointments.
export default function RecommendationBookingPage({ user, onLogout, betaTier }) {
  const { id } = useParams()
  const navigate = useNavigate()
  return (
    <>
      <AppointmentsPage user={user} onLogout={onLogout} betaTier={betaTier} />
      <RecommendationBookingModal recommendationId={id} onClose={() => navigate('/appointments', { replace: true })} />
    </>
  )
}
