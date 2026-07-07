import GamifiedFullPage from './GamifiedFullPage'

export default function PatientGamifiedActivitiesPage({ user }) {
  const patientId = (user?.name || 'alvrin').toLowerCase()
  return <GamifiedFullPage backPath="/dashboard" patientId={patientId} />
}
