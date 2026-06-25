import LogoCircle from '../components/LogoCircle'
import './Splash.css'

export default function Splash({ onLogoClick }) {
  return (
    <div className="splash-container">
      <LogoCircle onClick={onLogoClick} size="large" label="Go to login" />
      <h1 className="app-title">Therapy Pro</h1>
    </div>
  )
}
