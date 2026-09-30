// UI icons (outline, currentColor) + category art + a plain "picture" renderer
// for each vocabulary item. Items use a big, friendly emoji centered on a
// soft colored circle rather than hand-drawn per-item vector art — simple,
// legible at 96px+, and consistent with how the rest of this app already
// renders its game pictures.

function Icon({ size = 24, strokeWidth = 2.2, children, ...rest }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...rest}>
      {children}
    </svg>
  )
}

export function EyeIcon(props) {
  return <Icon {...props}><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3.2"/></Icon>
}

export function SpeakerIcon(props) {
  return <Icon {...props}><path d="M4 9v6h4l5 4V5L8 9H4Z"/><path d="M17 8a5 5 0 0 1 0 8"/><path d="M19.5 5.5a9 9 0 0 1 0 13"/></Icon>
}

export function HandTapIcon(props) {
  return <Icon {...props}><path d="M9 12V5a1.5 1.5 0 0 1 3 0v6"/><path d="M12 11V4a1.5 1.5 0 0 1 3 0v7"/><path d="M15 11.5V6a1.5 1.5 0 0 1 3 0v9"/><path d="M6 13l1 1.6A7 7 0 0 0 13 18h1a4 4 0 0 0 4-4v-.5"/></Icon>
}

export function CheckIcon(props) {
  return <Icon strokeWidth={3} {...props}><path d="M5 13l4 4L19 7"/></Icon>
}

export function PlayIcon(props) {
  return (
    <svg width={props.size || 24} height={props.size || 24} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M8 5.5v13l11-6.5-11-6.5Z"/>
    </svg>
  )
}

export function StarIcon({ filled = true, size = 24, ...rest }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.6" aria-hidden="true" {...rest}>
      <path d="M12 2.5l2.9 6.1 6.6.8-4.9 4.6 1.3 6.6L12 17.6 6.1 20.6l1.3-6.6-4.9-4.6 6.6-.8L12 2.5Z" strokeLinejoin="round"/>
    </svg>
  )
}

export function GearIcon(props) {
  return (
    <Icon {...props}>
      <circle cx="12" cy="12" r="3"/>
      <path d="M19.4 15a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.87-.34 1.7 1.7 0 0 0-1.04 1.56V21a2 2 0 1 1-4 0v-.09A1.7 1.7 0 0 0 8.96 19a1.7 1.7 0 0 0-1.87.34l-.06.06A2 2 0 1 1 4.2 16.6l.06-.06A1.7 1.7 0 0 0 4.6 14.67 1.7 1.7 0 0 0 3 13.6H2.9a2 2 0 1 1 0-4h.09A1.7 1.7 0 0 0 4.6 8.53a1.7 1.7 0 0 0-.34-1.87l-.06-.06A2 2 0 1 1 7.03 3.77l.06.06A1.7 1.7 0 0 0 8.96 4.17 1.7 1.7 0 0 0 10 2.6V2.5a2 2 0 1 1 4 0v.09a1.7 1.7 0 0 0 1.04 1.56 1.7 1.7 0 0 0 1.87-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.7 1.7 0 0 0-.34 1.87c.26.6.82 1.02 1.56 1.04H21a2 2 0 1 1 0 4h-.09A1.7 1.7 0 0 0 19.4 15Z"/>
    </Icon>
  )
}

export function BackArrowIcon(props) {
  return <Icon {...props}><path d="M19 12H5M11 18l-6-6 6-6"/></Icon>
}

// ─── Category art — flat, friendly icon per category ─────────────────────────

export function CategoryIcon({ id, size = 56 }) {
  const common = { width: size, height: size, viewBox: '0 0 64 64', 'aria-hidden': true }
  if (id === 'fruits') {
    return (
      <svg {...common}>
        <circle cx="26" cy="36" r="16" fill="#EF4444"/>
        <circle cx="42" cy="38" r="12" fill="#F59E0B"/>
        <path d="M27 20c0-4 3-7 7-7" stroke="#7C4A1E" strokeWidth="3" fill="none" strokeLinecap="round"/>
        <ellipse cx="33" cy="17" rx="5" ry="3" fill="#4ADE80" transform="rotate(-20 33 17)"/>
      </svg>
    )
  }
  if (id === 'vegetables') {
    return (
      <svg {...common}>
        <path d="M20 30c0-9 7-16 16-16 5 0 9 4 9 9 0 12-10 21-22 21-4 0-7-3-7-7 0-3 1-5 4-7Z" fill="#F97316"/>
        <path d="M32 14c2-4 6-6 10-5" stroke="#16A34A" strokeWidth="3" fill="none" strokeLinecap="round"/>
        <ellipse cx="18" cy="42" rx="10" ry="9" fill="#22C55E"/>
      </svg>
    )
  }
  if (id === 'animals') {
    return (
      <svg {...common}>
        <circle cx="32" cy="36" r="17" fill="#F59E0B"/>
        <circle cx="18" cy="22" r="8" fill="#F59E0B"/>
        <circle cx="46" cy="22" r="8" fill="#F59E0B"/>
        <circle cx="27" cy="34" r="2.6" fill="#3A2E6B"/>
        <circle cx="37" cy="34" r="2.6" fill="#3A2E6B"/>
        <ellipse cx="32" cy="42" rx="5" ry="3.4" fill="#FFF7E8"/>
      </svg>
    )
  }
  // things
  return (
    <svg {...common}>
      <rect x="16" y="24" width="32" height="24" rx="6" fill="#8B5CF6"/>
      <path d="M22 24v-4a10 10 0 0 1 20 0v4" stroke="#6D28D9" strokeWidth="4" fill="none" strokeLinecap="round"/>
      <circle cx="32" cy="36" r="4" fill="#EDE9FE"/>
    </svg>
  )
}

// ─── Item picture — big emoji on a soft colored circle ────────────────────────

export function EmojiPicture({ emoji, tint = '#F1EEDF', size = 220, className = '' }) {
  return (
    <div
      className={`flex items-center justify-center rounded-full ${className}`}
      style={{ width: size, height: size, background: tint }}
      aria-hidden="true"
    >
      <span style={{ fontSize: size * 0.52, lineHeight: 1 }}>{emoji}</span>
    </div>
  )
}

// ─── Fallback mascot — used only if the host app doesn't pass a Mascot prop ──

export function DefaultPanda({ mouthOpen = false, pxWidth = 120 }) {
  return (
    <svg width={pxWidth} height={pxWidth} viewBox="0 0 100 100" aria-hidden="true">
      <circle cx="50" cy="55" r="34" fill="#fff" stroke="#2B2A4C" strokeWidth="2.5"/>
      <circle cx="26" cy="28" r="11" fill="#2B2A4C"/>
      <circle cx="74" cy="28" r="11" fill="#2B2A4C"/>
      <ellipse cx="36" cy="50" rx="9" ry="11" fill="#2B2A4C"/>
      <ellipse cx="64" cy="50" rx="9" ry="11" fill="#2B2A4C"/>
      <circle cx="36" cy="50" r="3.4" fill="#fff"/>
      <circle cx="64" cy="50" r="3.4" fill="#fff"/>
      <ellipse cx="50" cy="63" rx="7" ry="5" fill="#2B2A4C"/>
      {mouthOpen
        ? <ellipse cx="50" cy="74" rx="8" ry="6" fill="#7C4A1E"/>
        : <path d="M42 72q8 6 16 0" stroke="#2B2A4C" strokeWidth="2.5" fill="none" strokeLinecap="round"/>
      }
    </svg>
  )
}
