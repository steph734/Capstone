import { useEffect, useRef, useState } from 'react'
import { reauth } from './notesApi'

export const IDLE_MS = 15 * 60 * 1000

// Locks the notes page after 15 minutes without a click, key press, scroll or
// touch. While locked the parent drops every note out of memory, and the
// session can only be resumed by re-entering the password (checked on the
// server; five wrong tries lock the account).
export function useIdleLock(active, onLock) {
  const last = useRef(Date.now())
  const lockRef = useRef(onLock)
  lockRef.current = onLock
  useEffect(() => {
    if (!active) return undefined
    last.current = Date.now()
    const bump = () => { last.current = Date.now() }
    const events = ['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart', 'click']
    events.forEach((e) => window.addEventListener(e, bump, { passive: true }))
    const timer = setInterval(() => { if (Date.now() - last.current >= IDLE_MS) lockRef.current() }, 15000)
    return () => { events.forEach((e) => window.removeEventListener(e, bump)); clearInterval(timer) }
  }, [active])
}

export default function LockScreen({ reason, userName, onUnlocked, onSignOut }) {
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const input = useRef(null)
  useEffect(() => { input.current?.focus() }, [])

  const submit = async (e) => {
    e.preventDefault()
    setBusy(true); setError('')
    try { await reauth(password); setPassword(''); onUnlocked() } catch (err) {
      if (err.code === 'NO_SESSION') { onSignOut(); return }
      setError(err.message); setPassword(''); setBusy(false)
    }
  }

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="lock-title" style={{ position: 'fixed', inset: 0, zIndex: 3000, background: 'rgba(245,250,248,.97)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <form onSubmit={submit} style={{ background: '#fff', border: '1px solid #e3e8e4', borderRadius: 18, padding: 26, width: 'min(380px, 100%)', textAlign: 'center', boxShadow: '0 10px 40px rgba(0,0,0,.08)' }}>
        <div style={{ fontSize: 34 }} aria-hidden="true">🔒</div>
        <h2 id="lock-title" style={{ margin: '6px 0', fontSize: 20, color: '#1f3d36' }}>Notes are locked</h2>
        <p style={{ margin: '0 0 14px', fontSize: 13.5, color: '#5d7770', lineHeight: 1.5 }}>{reason || 'For privacy, this page locks after 15 minutes of inactivity.'}{userName ? ` Enter ${userName}'s password to continue.` : ' Enter your password to continue.'}</p>
        <input ref={input} type="password" autoComplete="current-password" aria-label="Password" value={password} onChange={(e) => setPassword(e.target.value)}
          style={{ width: '100%', boxSizing: 'border-box', minHeight: 46, borderRadius: 12, border: '1px solid #d5ded9', padding: '0 14px', fontSize: 15 }} />
        {error && <p role="alert" style={{ color: '#b91c1c', fontSize: 13, margin: '8px 0 0' }}>{error}</p>}
        <button type="submit" className="tnp-primary-btn" disabled={busy || !password} style={{ width: '100%', marginTop: 12, minHeight: 46 }}>{busy ? 'Checking…' : 'Unlock'}</button>
        <button type="button" onClick={onSignOut} style={{ marginTop: 10, minHeight: 44, border: 'none', background: 'transparent', color: '#5d7770', cursor: 'pointer', fontFamily: 'inherit' }}>Sign out instead</button>
      </form>
    </div>
  )
}
