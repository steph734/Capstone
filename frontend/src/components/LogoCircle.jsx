import './LogoCircle.css'

export default function LogoCircle({ onClick, size = 'large', label = 'Therapy Pro' }) {
  return (
    <button
      type="button"
      className={`logo-circle-btn logo-circle-btn--${size}`}
      onClick={onClick}
      aria-label={label}
    >
      <img
        src="/therapy-pro-logo.png"
        alt="Therapy Pro"
        className="logo-img"
      />
    </button>
  )
}
