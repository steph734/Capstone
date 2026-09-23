import GamifiedFullPage from '../GamifiedFullPage'

// The therapist's "Games" tab shows the exact same Pao-the-panda game hub
// patients play from (see PatientGamifiedActivitiesPage.jsx) — same mascot,
// same game grid, same level-gating — so a therapist can see precisely what
// their patients see. It's a full-screen overlay (fixed/inset:0) by design,
// same as the patient version, so it isn't wrapped in TherapistPageShell —
// the "back" button below returns to the therapist's own Stats tab instead
// of the patient dashboard the default targets.
export default function TherapistActivityLibraryPage() {
  return <GamifiedFullPage backPath="/therapist/gamified-activities" patientId="therapist-preview" />
}
