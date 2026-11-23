import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import useIdleTimeout from '../../hooks/useIdleTimeout'
import { getSessionToken } from '../../utils/session'
import { onSessionEnded, resetSessionEnded } from '../../session/sessionBus'
import IdleTimeoutModal, { PAO_SLEEPY, PAO_WOW } from './IdleTimeoutModal'
import { idleFor } from '../../config/idle'

// Mounted ONCE (in App) for every role. Owns the timer, the warning modal and the redirect after an automatic logout.
//   onLogout(reason)  App's single cleanup function; reason is 'manual' or 'idle'
export default function IdleGate({ isAuthenticated, role, onLogout }) {
  const navigate = useNavigate()

  const heartbeat = async () => {
    const token = getSessionToken()
    if (!token) return // accounts without a server session (built-in demo logins) have nothing to refresh
    const res = await fetch('/api/auth/heartbeat', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: '{}' })
    if (res.status === 401) { const e = new Error('session ended'); e.status = 401; throw e }
    if (!res.ok) throw new Error(`heartbeat ${res.status}`)
  }

  const onExpire = (reason, { remote } = {}) => {
    if (reason === 'idle' || reason === 'ended') {
      onLogout('idle')
      navigate(`/session-expired?reason=${reason === 'ended' ? 'ended' : 'idle'}`, { replace: true })
    } else {
      onLogout('manual') // "Log out now" / logout in another tab: the normal login page, no "idle" message
      if (!remote) navigate('/login', { replace: true })
    }
  }

  const idle = useIdleTimeout({ enabled: isAuthenticated, role, onExpire, heartbeat })

  // The server says the session is over (401 SESSION_IDLE / NO_SESSION from any API call): handled once.
  useEffect(() => onSessionEnded((code) => idle.expire(code === 'SESSION_IDLE' ? 'idle' : 'ended')), [idle.expire]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (isAuthenticated) resetSessionEnded() }, [isAuthenticated])

  // Pao's pictures are fetched right after login so the warning appears instantly, with no empty box.
  useEffect(() => {
    if (!isAuthenticated) return
    for (const src of [PAO_SLEEPY, PAO_WOW]) { const i = new Image(); i.src = src }
  }, [isAuthenticated])

  // Therapist and Owner accounts only ever sign in through the server. A saved "signed in" flag with no token (browser reopened,
  // token cleared) can never work: every call would be a 401. End it now instead of showing a page that cannot load.
  useEffect(() => {
    if (isAuthenticated && (role === 'Therapist' || role === 'Owner') && !getSessionToken()) idle.expire('ended')
  }, [isAuthenticated, role]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!isAuthenticated || idle.phase !== 'warning') return null
  const { idleMs } = idleFor(role)
  return (
    <IdleTimeoutModal
      remaining={idle.remaining} total={idle.warningSeconds} minutes={Math.max(1, Math.round(idleMs / 60000))}
      onStay={idle.stay} onLogout={idle.logoutNow}
    />
  )
}
