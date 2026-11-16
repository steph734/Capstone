import { useState } from 'react'
import { useLocation } from 'react-router-dom'
import LogoCircle from '../components/LogoCircle'
import './Login.css'

function EnvelopeIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <path d="M2 7l10 7 10-7" />
    </svg>
  )
}

function LockIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <rect x="5" y="11" width="14" height="10" rx="2" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </svg>
  )
}

function EyeIcon({ open }) {
  if (open) {
    return (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
        <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" />
        <circle cx="12" cy="12" r="3" />
      </svg>
    )
  }
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-10-8-10-8a18.45 18.45 0 0 1 5.06-5.94" />
      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 10 8 10 8a18.5 18.5 0 0 1-2.16 3.19" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  )
}

export default function Login({ onLogoClick, onSignUpClick, onForgotPasswordClick, onLogin, onVerify2fa }) {
  const location = useLocation()
  const signupEmail = location.state?.signupEmail || ''
  const passedNotice = location.state?.notice || ''
  const [showPassword, setShowPassword] = useState(false)
  const [rememberMe, setRememberMe] = useState(true)
  const [email, setEmail] = useState(signupEmail)
  const [password, setPassword] = useState('')
  const [loginError, setLoginError] = useState('')
  const [notice, setNotice] = useState(
    passedNotice || (signupEmail ? 'Account created! Sign in with your new credentials.' : '')
  )
  const [isSubmitting, setIsSubmitting] = useState(false)
  // Therapist / owner accounts get a second step: the 6-digit code we email.
  const [twoFactorEmail, setTwoFactorEmail] = useState('')
  const [code, setCode] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!onLogin || isSubmitting) return

    setLoginError('')
    setNotice('')
    setIsSubmitting(true)
    const result = await onLogin(email, password)

    // On success the wrapper navigates away immediately (a global toast
    // shows on the page the user lands on), so this component unmounts
    // before isSubmitting would need to be reset.
    if (result?.success) return

    setIsSubmitting(false)
    if (result?.requires2fa) {
      setTwoFactorEmail(result.email || email)
      setNotice(result.message || 'We emailed you a 6-digit sign-in code.')
      return
    }
    if (result?.requiresVerification) {
      // The wrapper redirects to /verify-otp — no error to show.
      return
    }
    setLoginError(result?.message || 'Login failed')
  }

  const handleVerifyCode = async (e) => {
    e.preventDefault()
    if (!onVerify2fa || isSubmitting) return
    setLoginError('')
    setIsSubmitting(true)
    const result = await onVerify2fa(twoFactorEmail, code.trim())
    if (result?.success) return
    setIsSubmitting(false)
    setLoginError(result?.message || 'That code is not valid.')
    if (result?.locked) { setTwoFactorEmail(''); setCode(''); setPassword('') }
  }

  return (
    <div className="login-page">
      <div className="login-container">
        <div className="login-header">
          <LogoCircle onClick={onLogoClick} size="small" label="Back to home" />
          <h1 className="login-title">Welcome back!</h1>
          <p className="login-subtitle">Login to continue your journey</p>
        </div>

        {twoFactorEmail ? (
          <form className="login-form" onSubmit={handleVerifyCode}>
            <div className="form-group">
              <label htmlFor="login-code">Sign-in code</label>
              <div className="input-wrapper">
                <span className="input-icon"><LockIcon /></span>
                <input
                  id="login-code"
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  placeholder="6-digit code"
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                  autoFocus
                />
              </div>
            </div>
            {notice && <p className="login-notice">{notice}</p>}
            {loginError && <p className="login-error" role="alert">{loginError}</p>}
            <button type="submit" className="login-btn" disabled={isSubmitting || code.length !== 6} aria-busy={isSubmitting}>
              {isSubmitting ? 'Verifying…' : 'Verify and sign in'}
            </button>
            <button type="button" className="forgot-link" style={{ marginTop: 12 }} onClick={() => { setTwoFactorEmail(''); setCode(''); setNotice(''); setLoginError('') }}>
              Use a different account
            </button>
          </form>
        ) : (
        <form className="login-form" onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="email">Email</label>
            <div className="input-wrapper">
              <span className="input-icon"><EnvelopeIcon /></span>
              <input
                id="email"
                type="email"
                placeholder="Enter your email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="password">Password</label>
            <div className="input-wrapper">
              <span className="input-icon"><LockIcon /></span>
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                placeholder="Enter your password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <button
                type="button"
                className="password-toggle"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                <EyeIcon open={showPassword} />
              </button>
            </div>
          </div>

          {notice && <p className="login-notice">{notice}</p>}
          {loginError && <p className="login-error">{loginError}</p>}

          <div className="form-options">
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
              />
              <span className="checkbox-custom" />
              Remember me
            </label>
            <button type="button" className="forgot-link" onClick={onForgotPasswordClick}>
              Forgot Password?
            </button>
          </div>

          <button type="submit" className="login-btn" disabled={isSubmitting} aria-busy={isSubmitting}>
            {isSubmitting ? (
              <>
                <span className="login-btn-spinner" aria-hidden="true" />
                Logging in…
              </>
            ) : (
              'Login'
            )}
          </button>
        </form>
        )}

        <p className="signup-text">
          Don&apos;t have an account?{' '}
          <button type="button" className="signup-link" onClick={onSignUpClick}>
            Sign Up
          </button>
        </p>
      </div>
    </div>
  )
}
