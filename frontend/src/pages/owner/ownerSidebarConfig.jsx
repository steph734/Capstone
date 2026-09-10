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

function AppointmentsIcon() {
  return (
    <Icon>
      <path d="M7 2h2v2h6V2h2v2h3v18H4V4h3V2zm13 6H4v12h16V8zm-10 3h4v4h-4v-4z" />
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

function StaffIcon() {
  return (
    <Icon>
      <path d="M12 2a4 4 0 0 0-4 4v1H6a2 2 0 0 0-2 2v8h16V9a2 2 0 0 0-2-2h-2V6a4 4 0 0 0-4-4zm-2 5V6a2 2 0 1 1 4 0v1h-4z" />
    </Icon>
  )
}

function ReportsIcon() {
  return (
    <Icon>
      <path d="M4 4h16v16H4V4zm2 2v12h12V6H6zm2 8h2V8H8v6zm4 0h2V10h-2v4zm4 0h2V7h-2v9z" />
    </Icon>
  )
}

function BillingIcon() {
  return (
    <Icon>
      <path d="M3 6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v2H3V6zm0 4h18v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-8zm4 4h4v2H7v-2z" />
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

function SettingsIcon() {
  return (
    <Icon>
      <path d="M19.14 12.94c.04-.31.06-.63.06-.94s-.02-.63-.06-.94l2.03-1.58a.5.5 0 0 0 .12-.64l-1.92-3.32a.5.5 0 0 0-.6-.22l-2.39.96a7 7 0 0 0-1.62-.94l-.36-2.54a.5.5 0 0 0-.5-.42h-3.84a.5.5 0 0 0-.5.42l-.36 2.54c-.59.24-1.13.56-1.62.94l-2.39-.96a.5.5 0 0 0-.6.22L2.74 8.84a.5.5 0 0 0 .12.64l2.03 1.58c-.04.31-.06.63-.06.94s.02.63.06.94l-2.03 1.58a.5.5 0 0 0-.12.64l1.92 3.32c.13.24.42.32.6.22l2.39-.96c.49.38 1.03.7 1.62.94l.36 2.54c.05.24.25.42.5.42h3.84c.25 0 .45-.18.5-.42l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.24.09.47 0 .6-.22l1.92-3.32a.5.5 0 0 0-.12-.64l-2.03-1.58zM12 15.6a3.6 3.6 0 1 1 0-7.2 3.6 3.6 0 0 1 0 7.2z" />
    </Icon>
  )
}

const BASE_OWNER_MENU_ITEMS = [
  { id: 'dashboard', label: 'Dashboard', icon: <DashboardIcon />, path: '/owner/dashboard' },
  { id: 'appointments', label: 'Appointments', icon: <AppointmentsIcon />, path: '/owner/appointments' },
  { id: 'subscription', label: 'Subscription', icon: <SubscriptionIcon />, path: '/owner/subscription' },
  { id: 'patients', label: 'Patients', icon: <PatientsIcon />, path: '/owner/patients' },
  { id: 'staff', label: 'Staff', icon: <StaffIcon />, path: '/owner/staff' },
  { id: 'reports', label: 'Reports', icon: <ReportsIcon />, path: '/owner/reports' },
  {
    id: 'billing',
    label: 'Sales / Billing',
    icon: <BillingIcon />,
    path: '/owner/billing',
    children: [
      { id: 'billing-overview', label: 'Overview', path: '/owner/billing' },
      { id: 'billing-invoices', label: 'Invoices', path: '/owner/billing/invoices' },
      { id: 'billing-payouts', label: 'Payouts', path: '/owner/billing/payouts' },
      { id: 'billing-settings', label: 'Settings', path: '/owner/billing/settings' },
    ],
  },
]

const SPEECH_ITEM = { id: 'speech-features', label: 'Speech to Text / TTS', icon: <SpeechToTextIcon />, path: '/owner/speech-features' }
const GAMIFIED_ITEM = {
  id: 'gamified-activities',
  label: 'Gamified Activities',
  icon: <GamepadIcon />,
  path: '/owner/gamified-activities',
  children: [
    { id: 'ga-overview', label: 'Overview', path: '/owner/gamified-activities' },
    { id: 'ga-library', label: 'Activity Library', path: '/owner/gamified-activities/library' },
    { id: 'ga-request', label: 'Request a Game', path: '/owner/gamified-activities/request' },
  ],
}
const SETTINGS_ITEM = { id: 'settings', label: 'Settings', icon: <SettingsIcon />, path: '/owner/settings' }

export const ownerMenuItems = [...BASE_OWNER_MENU_ITEMS, SETTINGS_ITEM]

const TIER_RANK = { silver: 1, gold: 2 }

function readLS(key) {
  return typeof localStorage !== 'undefined' ? localStorage.getItem(key) : null
}

function pickHighestTier(...tiers) {
  const candidates = tiers.filter((t) => TIER_RANK[t])
  if (!candidates.length) return null
  return candidates.reduce((best, t) => (TIER_RANK[t] > TIER_RANK[best] ? t : best))
}

// Resolve which tier's features are unlocked and whether they're on a live trial.
// A paid `activePlan` (or the persisted fallback) unlocks features; `betaTier` is
// the preview flag. A free trial unlocks too — but once `activePlanTrialEnds` is
// in the past with no payment made, those premium features re-lock.
function resolveUnlock(betaTier, activePlan) {
  const paid = activePlan ?? readLS('activePlan')
  const trialEnds = readLS('activePlanTrialEnds')
  const trialExpired = !!trialEnds && new Date(trialEnds).getTime() <= Date.now()
  const trialing = !!trialEnds && !trialExpired
  const tier = pickHighestTier(betaTier, trialExpired ? null : paid)
  return { tier, trialing }
}

export function getOwnerMenuItems(betaTier, activePlan) {
  const { tier, trialing } = resolveUnlock(betaTier, activePlan)
  const mark = (items) => (trialing ? items.map((it) => ({ ...it, trial: true })) : items)
  if (tier === 'gold') return [...BASE_OWNER_MENU_ITEMS, ...mark([SPEECH_ITEM, GAMIFIED_ITEM]), SETTINGS_ITEM]
  if (tier === 'silver') return [...BASE_OWNER_MENU_ITEMS, ...mark([SPEECH_ITEM]), SETTINGS_ITEM]
  return [...BASE_OWNER_MENU_ITEMS, SETTINGS_ITEM]
}
