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

export function MessageIcon(props) {
  return (
    <Icon {...props}>
      <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
    </Icon>
  )
}

export function PenIcon(props) {
  return (
    <Icon {...props}>
      <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5z" />
      <path d="m15 5 4 4" />
    </Icon>
  )
}

export function PlusIcon(props) {
  return (
    <Icon {...props}>
      <path d="M12 5v14M5 12h14" />
    </Icon>
  )
}

export function RepeatIcon(props) {
  return (
    <Icon {...props}>
      <path d="m17 2 4 4-4 4" />
      <path d="M3 11v-1a4 4 0 0 1 4-4h14" />
      <path d="m7 22-4-4 4-4" />
      <path d="M21 13v1a4 4 0 0 1-4 4H3" />
    </Icon>
  )
}

export function TurtleIcon(props) {
  return (
    <Icon {...props}>
      <path d="M10 3c1.5 1 2.5 1 4 0M12 3v4" />
      <path d="M4.5 12.5C4.5 9 8 6 12 6s7.5 3 7.5 6.5c0 1-1 2-2 2h-.5a2 2 0 0 0-2 2v1a2 2 0 0 1-2 2h-2a2 2 0 0 1-2-2v-1a2 2 0 0 0-2-2h-.5c-1 0-2-1-2-2z" />
      <circle cx="8" cy="12" r="1" />
      <path d="M2 9c1 0 2 1 2 2M22 9c-1 0-2 1-2 2M9 19l-1.5 2M15 19l1.5 2" />
    </Icon>
  )
}

export function SaveIcon(props) {
  return (
    <Icon {...props}>
      <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
      <path d="M17 21v-8H7v8M7 3v5h8" />
    </Icon>
  )
}

export function ArrowLeftIcon(props) {
  return (
    <Icon {...props}>
      <path d="M19 12H5M12 19l-7-7 7-7" />
    </Icon>
  )
}

export function ChevronLeftIcon(props) {
  return (
    <Icon {...props}>
      <path d="M15 18l-6-6 6-6" />
    </Icon>
  )
}

export function PuzzleIcon(props) {
  return (
    <Icon {...props}>
      <path d="M9 3h4a1 1 0 0 1 1 1v2.2a1.8 1.8 0 1 0 0 3.6V12a1 1 0 0 1-1 1h-2.2a1.8 1.8 0 1 0-3.6 0H5a1 1 0 0 1-1-1V9a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h2.2A1.8 1.8 0 0 0 9 3z"/>
    </Icon>
  )
}

export function GridIcon(props) {
  return (
    <Icon {...props}>
      <rect x="3" y="3" width="7" height="7" rx="1"/>
      <rect x="14" y="3" width="7" height="7" rx="1"/>
      <rect x="3" y="14" width="7" height="7" rx="1"/>
      <rect x="14" y="14" width="7" height="7" rx="1"/>
    </Icon>
  )
}

export function HandIcon(props) {
  return (
    <Icon {...props}>
      <path d="M18 11V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v5" />
      <path d="M14 10V4a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v6" />
      <path d="M10 10.5V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v8" />
      <path d="M6 14v-2a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v4a8 8 0 0 0 8 8h2a8 8 0 0 0 8-8v-3a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2" />
    </Icon>
  )
}

export function ArrowUpIcon(props) {
  return (
    <Icon {...props}>
      <path d="M12 19V5M5 12l7-7 7 7" />
    </Icon>
  )
}

export function ArrowDownIcon(props) {
  return (
    <Icon {...props}>
      <path d="M12 5v14M19 12l-7 7-7-7" />
    </Icon>
  )
}
