import GamifiedFullPage from '../GamifiedFullPage'
import { ActivitySessionProvider } from '../../context/ActivitySessionContext'

// The therapist's "Games" tab runs the same Pao game hub the patients use,
// but the therapist first chooses who is playing (or practice mode). Progress
// from every game goes to that chosen patient's Pao.
// It's a full-screen overlay (fixed/inset:0) by design, so it isn't wrapped in
// TherapistPageShell — the back button returns to the therapist's Stats tab.
export default function TherapistActivityLibraryPage({ user }) {
  const therapistEmail = user?.email || null
  return (
    <ActivitySessionProvider therapistEmail={therapistEmail}>
      <GamifiedFullPage backPath="/therapist/gamified-activities" requirePlayer therapistEmail={therapistEmail} />
    </ActivitySessionProvider>
  )
}
