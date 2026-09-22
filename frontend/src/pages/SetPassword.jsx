import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { sha256Hex } from '../utils/hash'
import './SetPassword.css'

// Same-origin, like login/signup/reset — served by the Vercel function at
// /api/set-password/:token (frontend/api/_lib/routes/set-password.js), not
// the separately-hosted Express backend (which utils/api.js's apiGet/apiPost
// would point at instead, breaking once deployed).
async function fetchJson(path, options) {
  const res = await fetch(path, options)
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || 'Something went wrong.')
  return data
}

function CheckIcon() {
  return (
    <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  )
}

function RuleIcon({ met }) {
  if (met) {
    return (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <polyline points="20 6 9 17 4 12" />
      </svg>
    )
  }
  return <span className="sp-rule-dot" aria-hidden="true" />
}

export default function SetPassword() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const token = params.get('token') || ''

  const [status, setStatus] = useState('loading') // loading | ready | invalid
  const [info, setInfo] = useState(null)
  const [loadError, setLoadError] = useState('')

  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  useEffect(() => {
    if (!token) {
      setLoadError('This link is missing its token.')
      setStatus('invalid')
      return
    }
    let cancelled = false
    fetchJson(`/api/set-password/${token}`)
      .then((data) => {
        if (cancelled) return
        setInfo(data)
        setStatus('ready')
      })
      .catch((err) => {
        if (cancelled) return
        setLoadError(err.message || 'This link is invalid or has expired.')
        setStatus('invalid')
      })
    return () => { cancelled = true }
  }, [token])

  const hasLength = password.length >= 8
  const hasNumberOrSymbol = useMemo(() => /[0-9]/.test(password) || /[^A-Za-z0-9]/.test(password), [password])

  const goToLogin = () => navigate('/login')

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    if (!hasLength) {
      setError('Password must be at least 8 characters.')
      return
    }
    if (!hasNumberOrSymbol) {
      setError('Password must include a number or symbol.')
      return
    }
    if (password !== confirm) {
      setError('Passwords do not match.')
      return
    }

    setSubmitting(true)
    try {
      // Hashed client-side so the raw password never appears in the request
      // payload — must match the hashing done at login (App.jsx), sign up
      // (SignUp.jsx) and reset (ResetPassword.jsx) so the server's bcrypt
      // compare at login keeps working for this account afterward.
      const passwordHash = await sha256Hex(password)
      await fetchJson(`/api/set-password/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: passwordHash }),
      })
      setDone(true)
    } catch (err) {
      setError(err.message || 'Could not set your password.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="sp-page">
      <div className="sp-card">
        <div className="sp-brand">
          <span className="sp-brand-check"><CheckIcon /></span>
          <span className="sp-brand-name">TherapyPro</span>
        </div>

        {status === 'loading' && <p className="sp-loading">Checking your link…</p>}

        {status === 'invalid' && (
          <div className="sp-invalid">
            <h1>Link invalid or expired</h1>
            <p>{loadError}</p>
            <button type="button" className="sp-btn primary" onClick={goToLogin}>Go to Sign In</button>
          </div>
        )}

        {status === 'ready' && !done && (
          <>
            <h1 className="sp-title">Set your password</h1>
            <p className="sp-subtitle">
              First login as <strong>{info?.name || 'your account'}</strong>. Choose a password to
              replace the temporary one.
            </p>

            <form className="sp-form" onSubmit={handleSubmit}>
              <div className="sp-field">
                <label htmlFor="sp-new">New password</label>
                <input
                  id="sp-new"
                  type="password"
                  placeholder="Enter a new password"
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>

              <div className="sp-field">
                <label htmlFor="sp-confirm">Confirm password</label>
                <input
                  id="sp-confirm"
                  type="password"
                  placeholder="Re-enter the password"
                  autoComplete="new-password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                />
              </div>

              <div className="sp-rules">
                <div className={`sp-rule ${hasLength ? 'met' : ''}`}>
                  <RuleIcon met={hasLength} /> At least 8 characters
                </div>
                <div className={`sp-rule ${hasNumberOrSymbol ? 'met' : ''}`}>
                  <RuleIcon met={hasNumberOrSymbol} /> One number or symbol
                </div>
                <div className="sp-rule">
                  <RuleIcon met={false} /> Doesn't match the temporary password
                </div>
              </div>

              {error && <p className="sp-error">{error}</p>}

              <button type="submit" className="sp-btn primary full" disabled={submitting}>
                {submitting ? 'Saving…' : 'Set password and continue'}
              </button>
            </form>
          </>
        )}

        {done && (
          <div className="sp-success">
            <div className="sp-success-check"><CheckIcon /></div>
            <h1>Password set</h1>
            <p>Your password has been updated. You can now sign in with it.</p>
            <button type="button" className="sp-btn primary full" onClick={goToLogin}>Go to Sign In</button>
          </div>
        )}
      </div>
    </div>
  )
}
