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

function BranchesIcon() {
  return (
    <Icon>
      <path d="M12 2a4 4 0 0 0-4 4c0 1.66 1 3.1 2.44 3.73A6.01 6.01 0 0 0 6 15v7h2v-7a4 4 0 0 1 8 0v7h2v-7a6.01 6.01 0 0 0-4.44-5.27A4 4 0 0 0 16 6a4 4 0 0 0-4-4z" />
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

function GamesIcon() {
  return (
    <Icon>
      <path d="M7 2h10a3 3 0 0 1 3 3v14a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3V5a3 3 0 0 1 3-3zm1 6h2V6h2v2h2v2h-2v2h-2V8H8V6zm6.5 6a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3z" />
    </Icon>
  )
}

function AuditIcon() {
  return (
    <Icon>
      <path d="M4 4h16v2H4V4zm0 5h16v2H4V9zm0 5h10v2H4v-2zm0 5h16v2H4v-2z" />
    </Icon>
  )
}

export const adminMenuItems = [
  { id: 'dashboard', label: 'Dashboard', icon: <DashboardIcon />, path: '/admin/dashboard' },
  { id: 'branches', label: 'Branches', icon: <BranchesIcon />, path: '/admin/branches' },
  { id: 'subscription', label: 'Subscription', icon: <SubscriptionIcon />, path: '/admin/subscription' },
  { id: 'games-library', label: 'Games Library', icon: <GamesIcon />, path: '/admin/games-library' },
  { id: 'audit-logs', label: 'Audit Logs', icon: <AuditIcon />, path: '/admin/audit-logs' },
]