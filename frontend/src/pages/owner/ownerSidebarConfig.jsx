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

export const ownerMenuItems = [
  { id: 'dashboard', label: 'Dashboard', icon: <DashboardIcon />, path: '/owner/dashboard' },
  { id: 'appointments', label: 'Appointments', icon: <AppointmentsIcon />, path: '/owner/appointments' },
  { id: 'subscription', label: 'Subscription', icon: <SubscriptionIcon />, path: '/owner/subscription' },
  { id: 'patients', label: 'Patients', icon: <PatientsIcon />, path: '/owner/patients' },
  { id: 'staff', label: 'Staff', icon: <StaffIcon />, path: '/owner/staff' },
  { id: 'reports', label: 'Reports', icon: <ReportsIcon />, path: '/owner/reports' },
  { id: 'billing', label: 'Sales / Billing', icon: <BillingIcon />, path: '/owner/billing' },
]
