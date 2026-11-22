import { useEffect } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Clock } from 'lucide-react'
import { IDLE_TIMEOUT_MS } from '../config/idle'
import { PAO_WAVE } from '../components/idle/IdleTimeoutModal'
import '../components/idle/idle.css'

// Public page (no role guard): every role lands here after an automatic logout.
//   /session-expired?reason=idle     inactive for 10 minutes
//   /session-expired?reason=ended    the server ended the session
export default function SessionExpiredPage() {
  const [params] = useSearchParams()
  const idle = params.get('reason') !== 'ended'
  const minutes = Math.max(1, Math.round(IDLE_TIMEOUT_MS / 60000))
  useEffect(() => { document.title = 'Signed out · TherapyPro' }, [])
  return (
    <main className="tp-out">
      <p className="tp-out-brand">TherapyPro</p>
      <div className="tp-out-wrap">
        <img className="tp-out-pao" src={PAO_WAVE} alt="Pao the panda waves goodbye" width="300" height="380" decoding="async" draggable="false" />
        <section className="tp-out-card" aria-labelledby="tp-out-title">
          <span className="tp-out-pill"><Clock size={15} aria-hidden="true" /> Signed out</span>
          <h1 id="tp-out-title">You’ve been logged out</h1>
          <p>{idle ? `You were inactive for ${minutes} ${minutes === 1 ? 'minute' : 'minutes'}, so Pao signed you out to keep your account safe.` : 'Your session ended, so Pao signed you out to keep your account safe.'}</p>
          <Link className="tp-out-btn" to="/login" replace data-autofocus>Log in again</Link>
          <p className="tp-out-foot">Your saved work is safe. Anything you did not save was not kept.</p>
        </section>
      </div>
    </main>
  )
}
