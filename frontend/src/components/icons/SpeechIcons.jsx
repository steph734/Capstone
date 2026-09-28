function Icon({ size = 20, strokeWidth = 2, children, ...rest }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...rest}>
      {children}
    </svg>
  )
}

export function UsersIcon(props) {
  return (
    <Icon {...props}>
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </Icon>
  )
}

export function XIcon(props) {
  return (
    <Icon {...props}>
      <path d="M18 6 6 18M6 6l12 12" />
    </Icon>
  )
}

export function SearchIcon(props) {
  return (
    <Icon {...props}>
      <circle cx="11" cy="11" r="7" />
      <path d="m21 21-4.35-4.35" />
    </Icon>
  )
}

export function CalendarIcon(props) {
  return (
    <Icon {...props}>
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <path d="M16 2v4M8 2v4M3 10h18" />
    </Icon>
  )
}

export function ChevronDownIcon(props) {
  return (
    <Icon {...props}>
      <path d="m6 9 6 6 6-6" />
    </Icon>
  )
}

export function CakeIcon(props) {
  return (
    <Icon {...props}>
      <path d="M20 21v-8a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8" />
      <path d="M4 16a3 3 0 0 0 3 0 3 3 0 0 1 3 0 3 3 0 0 0 3 0 3 3 0 0 1 3 0 3 3 0 0 0 3 0" />
      <path d="M12 11V7" />
      <path d="M12 7c-1 0-1.5-.7-1.5-1.5S11 4 12 3c1 1 1.5 1.7 1.5 2.5S13 7 12 7z" />
    </Icon>
  )
}

export function StethoscopeIcon(props) {
  return (
    <Icon {...props}>
      <path d="M4.8 2.3A1 1 0 1 0 3.3 3.8l.4.4c1 1 1.5 2.3 1.5 3.7v3.8a6 6 0 0 0 12 0v-.5" />
      <path d="M8 4v6.8a4 4 0 0 0 8 0V4" />
      <path d="M4.8 4v.01M19.2 2.3a1 1 0 1 1 1.5 1.5l-.4.4" />
      <circle cx="20" cy="14" r="2" />
    </Icon>
  )
}

export function DotIcon({ size = 8, ...rest }) {
  return (
    <svg width={size} height={size} viewBox="0 0 8 8" fill="currentColor" aria-hidden="true" {...rest}>
      <circle cx="4" cy="4" r="4" />
    </svg>
  )
}

export function ClockIcon(props) {
  return (
    <Icon {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 3" />
    </Icon>
  )
}

export function MicIcon(props) {
  return (
    <Icon {...props}>
      <rect x="9" y="2" width="6" height="12" rx="3" />
      <path d="M5 11a7 7 0 0 0 14 0" />
      <path d="M12 18v4M8 22h8" />
    </Icon>
  )
}

export function VolumeIcon(props) {
  return (
    <Icon {...props}>
      <path d="M11 5 6 9H3v6h3l5 4V5z" />
      <path d="M16 8.5a4.5 4.5 0 0 1 0 7M19 5.5a8.5 8.5 0 0 1 0 13" />
    </Icon>
  )
}

export function CheckIcon(props) {
  return (
    <Icon {...props}>
      <path d="M20 6 9 17l-5-5" />
    </Icon>
  )
}

export function ArrowRightIcon(props) {
  return (
    <Icon {...props}>
      <path d="M5 12h14M13 6l6 6-6 6" />
    </Icon>
  )
}

export function FlaskIcon(props) {
  return (
    <Icon {...props}>
      <path d="M9 2h6" />
      <path d="M10 2v6.5L4.5 18a2 2 0 0 0 1.7 3h11.6a2 2 0 0 0 1.7-3L14 8.5V2" />
      <path d="M7 15h10" />
    </Icon>
  )
}

export function SwapIcon(props) {
  return (
    <Icon {...props}>
      <path d="m16 3 4 4-4 4" />
      <path d="M20 7H4" />
      <path d="m8 21-4-4 4-4" />
      <path d="M4 17h16" />
    </Icon>
  )
}
