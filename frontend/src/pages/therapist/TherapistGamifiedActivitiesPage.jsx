import TherapistGamifiedStatsPage from './TherapistGamifiedStatsPage'

// /therapist/gamified-activities — real data from the backend (see
// api/_lib/routes/therapist-gamified-overview.js), no hard-coded patients.
export default function TherapistGamifiedActivitiesPage({ user, onLogout, betaTier }) {
  return <TherapistGamifiedStatsPage user={user} onLogout={onLogout} betaTier={betaTier} />
}
