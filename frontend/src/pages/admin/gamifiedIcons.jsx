function IconBase({ size = 20, children }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      {children}
    </svg>
  )
}

export function GameControllerIcon(props) {
  return (
    <IconBase {...props}>
      <path d="M7 2h10a3 3 0 0 1 3 3v14a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3V5a3 3 0 0 1 3-3zm1 6h2V6h2v2h2v2h-2v2h-2V8H8V6zm6.5 6a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3z" />
    </IconBase>
  )
}

export function InboxIcon(props) {
  return (
    <IconBase {...props}>
      <path d="M20 4H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2zm0 8h-3.5l-1.5 2h-6l-1.5-2H4V6h16v6z" />
    </IconBase>
  )
}

export function MedalIcon(props) {
  return (
    <IconBase {...props}>
      <path d="M12 2 4.5 5.2v6.1c0 4.6 3.1 8.6 7.5 9.8 4.4-1.2 7.5-5.2 7.5-9.8V5.2L12 2zm0 2.2 5.5 2.4v4.7c0 3.6-2.3 6.9-5.5 8-3.2-1.1-5.5-4.4-5.5-8V6.6L12 4.2zM12 6l-2.6 5.2H12v4.8l2.6-5.2H12V6z" />
    </IconBase>
  )
}

export function StarIcon(props) {
  return (
    <IconBase {...props}>
      <path d="M12 2.5 15 9l7 1-5.2 4.9L18.2 21.5 12 17.9l-6.2 3.6 1.4-6.6L2 10l7-1 3-6.5z" />
    </IconBase>
  )
}

export function ChartIcon(props) {
  return (
    <IconBase {...props}>
      <path d="M5 20h2v-8H5v8zm6 0h2V4h-2v16zm6 0h2v-12h-2v12z" />
    </IconBase>
  )
}

export function PlusIcon(props) {
  return (
    <IconBase {...props}>
      <path d="M11 5h2v6h6v2h-6v6h-2v-6H5v-2h6V5z" />
    </IconBase>
  )
}

export function TrashIcon(props) {
  return (
    <svg width={props?.size || 15} height={props?.size || 15} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 6h18" />
      <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6h14z" />
      <path d="M10 11v6M14 11v6" />
    </svg>
  )
}

export function PencilIcon(props) {
  return (
    <svg width={props?.size || 15} height={props?.size || 15} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" />
    </svg>
  )
}
