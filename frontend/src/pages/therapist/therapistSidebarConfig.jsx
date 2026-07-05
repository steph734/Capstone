const Icon = ({ children }) => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    {children}
  </svg>
)

function DashboardIcon() {
  return (
    <Icon>
      <path d="M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8V11h-8v10zm0-18v6h8V3h-8z" />
    </Icon>
  )
}

function PatientsIcon() {
  return (
    <Icon>
      <path d="M12 12a4 4 0 1 0-4-4 4 4 0 0 0 4 4zm0 2c-4.42 0-8 2.24-8 5v3h16v-3c0-2.76-3.58-5-8-5z" />
    </Icon>
  )
}

function AppointmentsIcon() {
  return (
    <Icon>
      <path d="M7 2h2v2h6V2h2v2h3v18H4V4h3V2zm13 6H4v12h16V8zm-10 3h4v4h-4v-4z" />
    </Icon>
  )
}

function NotesIcon() {
  return (
    <Icon>
      <path d="M4 4h16v16H4V4zm3 3v2h10V7H7zm0 4v2h10v-2H7zm0 4v2h7v-2H7z" />
    </Icon>
  )
}

function ExercisesIcon() {
  return (
    <Icon>
      <path d="M7 2h10a3 3 0 0 1 3 3v14a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3V5a3 3 0 0 1 3-3zm1 6h8v2H8V8zm0 4h8v2H8v-2zm0 4h5v2H8v-2z" />
    </Icon>
  )
}

function SubscriptionIcon() {
  return (
    <Icon>
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15.5V19h-2v-1.5c-1.93-.24-3.5-1.61-3.5-3.5h2c0 1.1 1.12 1.75 2.5 1.75 1.48 0 2.5-.68 2.5-1.6 0-1.05-1.06-1.4-2.9-1.82-2.1-.48-4.1-1.2-4.1-3.58 0-1.76 1.33-3.12 3.5-3.42V5h2v1.32c1.7.22 3 1.24 3.22 2.93h-2c-.18-.83-1-1.45-2.22-1.45-1.35 0-2.3.56-2.3 1.42 0 .98 1.15 1.28 2.93 1.69 2.24.5 4.07 1.26 4.07 3.8 0 1.8-1.36 3.27-3.7 3.79z" />
    </Icon>
  )
}

function SpeechToTextIcon() {
  return (
    <Icon>
      <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm-1-9c0-.55.45-1 1-1s1 .45 1 1v6c0 .55-.45 1-1 1s-1-.45-1-1V5zm6 6c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" />
    </Icon>
  )
}

function GamepadIcon() {
  return (
    <Icon>
      <path d="M15 7.5V2H9v5.5l3 3 3-3zM7.5 9H2v6h5.5l3-3-3-3zM9 16.5V22h6v-5.5l-3-3-3 3zM16.5 9l-3 3 3 3H22V9h-5.5z" />
    </Icon>
  )
}

function ReportIcon() {
  return (
    <Icon>
      <path d="M19 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2zM9 17H7v-7h2v7zm4 0h-2V7h2v10zm4 0h-2v-4h2v4z"/>
    </Icon>
  )
}

const BASE_THERAPIST_MENU_ITEMS = [
  { id: 'dashboard', label: 'Dashboard', icon: <DashboardIcon />, path: '/therapist/dashboard' },
  { id: 'patients', label: 'My Patients', icon: <PatientsIcon />, path: '/therapist/patients' },
  { id: 'appointments', label: 'Appointments', icon: <AppointmentsIcon />, path: '/therapist/appointments' },
  { id: 'subscription', label: 'Subscription', icon: <SubscriptionIcon />, path: '/therapist/subscription' },
  { id: 'notes-progress', label: 'Notes & Progress', icon: <NotesIcon />, path: '/therapist/notes-progress' },
  { id: 'assign-exercises', label: 'Assign Exercises', icon: <ExercisesIcon />, path: '/therapist/assign-exercises' },
  { id: 'reports', label: 'Reports', icon: <ReportIcon />, path: '/therapist/reports' },
]

const SPEECH_ITEM = { id: 'speech-features', label: 'Speech to Text / TTS', icon: <SpeechToTextIcon />, path: '/therapist/speech-features' }
const GAMIFIED_ITEM = { id: 'gamified-activities', label: 'Gamified Activities', icon: <GamepadIcon />, path: '/therapist/gamified-activities' }

export const therapistMenuItems = BASE_THERAPIST_MENU_ITEMS

export function getTherapistMenuItems(betaTier) {
  if (betaTier === 'gold') return [...BASE_THERAPIST_MENU_ITEMS, SPEECH_ITEM, GAMIFIED_ITEM]
  if (betaTier === 'silver') return [...BASE_THERAPIST_MENU_ITEMS, SPEECH_ITEM]
  return BASE_THERAPIST_MENU_ITEMS
}
