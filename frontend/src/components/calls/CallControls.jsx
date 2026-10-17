// Shared round control button used by every call view.
export function CtrlBtn({ icon: Icon, label, onClick, off = false, danger = false, disabled = false, active = false, accept = false, showLabel = true, big = false }) {
  return (
    <div className={`cl-ctrl${big ? ' big' : ''}`}>
      <button
        type="button"
        className={`cl-btn${off ? ' off' : ''}${danger ? ' danger' : ''}${active ? ' active' : ''}${accept ? ' accept' : ''}`}
        onClick={onClick}
        disabled={disabled}
        aria-label={label}
        aria-pressed={off || active ? true : undefined}
        title={label}
      >
        <Icon size={big ? 28 : 22} aria-hidden="true" />
      </button>
      {showLabel && <span className="cl-ctrl-label">{label}</span>}
    </div>
  )
}

// A person's circle: photo when there is one, otherwise initials on a colour derived from the name.
const COLORS = ['#7c6bd6', '#e0508f', '#2e9d63', '#3b82c4', '#d9822b', '#5b6b66']
export function Avatar({ user, size = 150, rings = false, pulsing = false, children }) {
  const name = user?.name || '?'
  const initials = name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase() || '?'
  const color = COLORS[[...name].reduce((n, c) => n + c.charCodeAt(0), 0) % COLORS.length]
  const box = rings ? size * 1.8 : size
  return (
    <div className={`cl-avatar-wrap${pulsing ? ' pulsing' : ''}`} style={{ width: box, height: box }}>
      {rings && <><i className="cl-ring r1" /><i className="cl-ring r2" /></>}
      {user?.image
        ? <img className="cl-avatar" src={user.image} alt="" style={{ width: size, height: size }} />
        : <div className="cl-avatar cl-avatar-fallback" style={{ width: size, height: size, background: color, fontSize: size * 0.34 }}>{initials}</div>}
      {children}
    </div>
  )
}

// "Guardian of Rene Baterbonia" / "Occupational Therapist · TherapyPro"
export function roleLine(user) {
  const c = user?.custom || {}
  if (c.appRole === 'patient') return c.patientName ? `Guardian of ${c.patientName}` : 'Parent / Guardian'
  return `${c.roleLabel || 'Therapist'} · TherapyPro`
}
