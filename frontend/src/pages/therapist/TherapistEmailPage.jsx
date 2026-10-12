import PatientEmailPage from '../PatientEmailPage'
import { getTherapistMenuItems } from './therapistSidebarConfig'

export default function TherapistEmailPage({ user, onLogout, betaTier }) {
  return (
    <PatientEmailPage
      user={user}
      onLogout={onLogout}
      betaTier={betaTier}
      menuItems={getTherapistMenuItems(betaTier)}
      profilePath="/therapist/profile"
    />
  )
}
