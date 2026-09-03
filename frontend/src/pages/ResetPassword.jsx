import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import LogoCircle from '../components/LogoCircle'
import { savePasswordReset } from '../utils/passwordResets'
import './ForgotPassword.css'
import './ResetPassword.css'

function CloseIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  )
}

function LockIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <rect x="3" y="11" width="18" height="11" rx="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  )
}

function CheckIcon() {
  return (
    <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  )
}

export default function ResetPassword() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const token = params.get('token') || ''
  const email = params.get('email') || ''

  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  const goToLogin = () => navigate('/login')

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    if (password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }
    if (password !== confirm) {
      setError('Passwords do not match.')
      return
    }

    setSubmitting(true)
    try {
      let confirmedEmail = email

      try {
        const res = await fetch('/api/reset-password', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token, password }),
        })
        const data = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(data.error || 'Could not reset your password.')
        confirmedEmail = data.email || email
      } catch (apiErr) {
        // If the /api routes aren't running (plain `npm run dev`), fall back to
        // the email carried in the link so the demo still works end to end.
        const offline =
          apiErr instanceof TypeError ||
          /Failed to fetch|NetworkError|Unexpected token/i.test(apiErr.message || '')
        if (!offline) throw apiErr
        if (!confirmedEmail) throw new Error('Reset link is missing its email. Request a new one.')
      }

      // No user database in this prototype — persist the new password locally so
      // the login screen accepts it.
      savePasswordReset(confirmedEmail, password)
      setDone(true)
    } catch (err) {
      setError(err.message || 'Could not reset your password.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="forgot-page">
      <div className="forgot-container">
        <div className="forgot-header">
          <LogoCircle onClick={() => navigate('/')} size="small" label="Back to home" />
          <h1 className="forgot-title">Reset Password</h1>
          <p className="forgot-subtitle">Opening the secure form to set your new password…</p>
        </div>
      </div>

      <div
        className="rp-modal-overlay"
        role="dialog"
        aria-modal="true"
        aria-labelledby="rp-modal-title"
        onClick={goToLogin}
      >
        <div className="rp-modal" onClick={(e) => e.stopPropagation()}>
          <button type="button" className="rp-modal-close" onClick={goToLogin} aria-label="Close">
            <CloseIcon />
          </button>

          {done ? (
            <div className="rp-success">
              <div className="rp-success-check"><CheckIcon /></div>
              <h2 id="rp-modal-title">Password updated</h2>
              <p>
                Your password has been changed{email ? ` for ${email}` : ''}. You can now sign in
                with your new password.
              </p>
              <button type="button" className="rp-btn primary" onClick={goToLogin}>
                Go to Sign In
              </button>
            </div>
          ) : (
            <>
              <div className="rp-modal-header">
                <h2 id="rp-modal-title">Create New Password</h2>
                <p>
                  {email
                    ? <>Set a new password for <strong>{email}</strong>.</>
                    : 'Choose a new password for your account.'}
                </p>
              </div>

              <form className="rp-form" onSubmit={handleSubmit}>
                <div className="rp-field">
                  <label htmlFor="rp-new">New Password</label>
                  <div className="rp-input-wrapper">
                    <span className="rp-input-icon"><LockIcon /></span>
                    <input
                      id="rp-new"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="At least 8 characters"
                      autoComplete="new-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                    <button
                      type="button"
                      className="rp-toggle"
                      onClick={() => setShowPassword((v) => !v)}
                    >
                      {showPassword ? 'Hide' : 'Show'}
                    </button>
                  </div>
                </div>

                <div className="rp-field">
                  <label htmlFor="rp-confirm">Confirm Password</label>
                  <div className="rp-input-wrapper">
                    <span className="rp-input-icon"><LockIcon /></span>
                    <input
                      id="rp-confirm"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="Re-enter your new password"
                      autoComplete="new-password"
                      value={confirm}
                      onChange={(e) => setConfirm(e.target.value)}
                    />
                  </div>
                </div>

                {error && <p className="rp-error">{error}</p>}

                <div className="rp-actions">
                  <button type="button" className="rp-btn secondary" onClick={goToLogin} disabled={submitting}>
                    Cancel
                  </button>
                  <button type="submit" className="rp-btn primary" disabled={submitting}>
                    {submitting ? 'Saving…' : 'Reset Password'}
                  </button>
                </div>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
