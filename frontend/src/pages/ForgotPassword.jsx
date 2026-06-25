import { useState } from 'react'
import LogoCircle from '../components/LogoCircle'
import ReCaptcha from '../components/ReCaptcha'
import './ForgotPassword.css'

function EnvelopeIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <path d="M2 7l10 7 10-7" />
    </svg>
  )
}

export default function ForgotPassword({ onLogoClick, onSignInClick }) {
  const [recaptchaToken, setRecaptchaToken] = useState(null)
  const [captchaError, setCaptchaError] = useState('')

  const handleSubmit = (e) => {
    e.preventDefault()

    if (!recaptchaToken) {
      setCaptchaError('Please complete the reCAPTCHA verification.')
      return
    }

    setCaptchaError('')
    // Send reset request to backend with email and recaptchaToken
  }

  return (
    <div className="forgot-page">
      <div className="forgot-container">
        <div className="forgot-header">
          <LogoCircle onClick={onLogoClick} size="small" label="Back to home" />
          <h1 className="forgot-title">Reset Password</h1>
          <p className="forgot-subtitle">
            Please enter your email address to reset your password.
          </p>
        </div>

        <form className="forgot-form" onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="email">Email Address</label>
            <div className="input-wrapper">
              <span className="input-icon"><EnvelopeIcon /></span>
              <input
                id="email"
                type="email"
                placeholder="Enter your email address"
                autoComplete="email"
              />
            </div>
          </div>

          <ReCaptcha
            onChange={(token) => {
              setRecaptchaToken(token)
              if (token) setCaptchaError('')
            }}
            onExpired={() => setRecaptchaToken(null)}
          />
          {captchaError && <p className="captcha-error">{captchaError}</p>}

          <button type="submit" className="forgot-btn">Reset Password</button>
        </form>

        <p className="signin-text">
          Already know your password?{' '}
          <button type="button" className="signin-link" onClick={onSignInClick}>
            Sign In
          </button>
        </p>
      </div>
    </div>
  )
}
