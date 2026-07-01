import { useNavigate } from 'react-router-dom'
import LogoCircle from '../components/LogoCircle'
import './Splash.css'

export default function Splash({ onLogoClick }) {
  const navigate = useNavigate()
  
  return (
    <div className="splash-container">
      <LogoCircle onClick={() => navigate('/login')} size="large" label="Go to login" />
      <h1 className="app-title">Therapy Pro</h1>
    </div>
  )
}
