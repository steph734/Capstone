import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import LogoCircle from '../components/LogoCircle'
import './ForgotPassword.css'

function EnvelopeIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <path d="M2 7l10 7 10-7" />
    </svg>
  )
}

export default function ForgotPassword() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState('idle') // idle | sending | error
  const [error, setError] = useState('')

  const sendResetCode = async (e) => {
    e?.preventDefault()
    const trimmed = email.trim().toLowerCase()
    if (!trimmed) {
      setError('Please enter your email address.')
      setStatus('error')
      return
    }

    setStatus('sending')
    setError('')

    try {
      const res = await fetch('/api/auth/send-reset-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: trimmed }),
      })

      let data
      try {
        data = await res.json()
      } catch {
        throw new Error(
          "Couldn't reach the email server. If you're running `npm run dev`, the /api routes " +
          'are not served that way — run `vercel dev` instead.'
        )
      }
      if (!res.ok) throw new Error(data.error || 'Could not send the reset code.')

      // A 6-digit code was emailed (if that account exists) — take them to the
      // verification screen, same as the signup flow.
      navigate('/verify-reset-otp', { state: { email: trimmed } })
    } catch (err) {
      setError(err.message || 'Could not send the reset code.')
      setStatus('error')
    }
  }

  return (
    <div className="forgot-page">
      <div className="forgot-container">
        <div className="forgot-header">
          <LogoCircle onClick={() => navigate('/')} size="small" label="Back to home" />
          <h1 className="forgot-title">Reset Password</h1>
          <p className="forgot-subtitle">
            Please enter your email address to reset your password.
          </p>
        </div>

        <form className="forgot-form" onSubmit={sendResetCode}>
          <div className="form-group">
            <label htmlFor="email">Email Address</label>
            <div className="input-wrapper">
              <span className="input-icon"><EnvelopeIcon /></span>
              <input
                id="email"
                type="email"
                placeholder="Enter your email address"
                autoComplete="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value)
                  if (status === 'error') setStatus('idle')
                }}
              />
            </div>
          </div>

          {status === 'error' && <p className="forgot-error">{error}</p>}

          <button type="submit" className="forgot-btn" disabled={status === 'sending'}>
            {status === 'sending' ? 'Sending…' : 'Reset Password'}
          </button>
        </form>

        <p className="signin-text">
          Already know your password?{' '}
          <button type="button" className="signin-link" onClick={() => navigate('/login')}>
            Sign In
          </button>
        </p>
      </div>
    </div>
  )
}
