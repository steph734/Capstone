import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import LogoCircle from '../components/LogoCircle'
import SocialAuthModal from '../components/SocialAuthModal'
import './SignUp.css'

function FacebookIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="#1877F2" aria-hidden="true">
      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
    </svg>
  )
}

function GoogleIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
    </svg>
  )
}

function PersonIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <circle cx="12" cy="8" r="4" />
      <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
    </svg>
  )
}

function AtIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <circle cx="12" cy="12" r="4" />
      <path d="M16 12v1a4 4 0 0 1-8 0v-1" />
      <path d="M12 16v2M8 20h8" />
      <path d="M12 4v4" />
    </svg>
  )
}

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

export default function SignUp({ onLogoClick, onLoginClick }) {
  const navigate = useNavigate()
  const [showPassword, setShowPassword] = useState(false)
  const [socialProvider, setSocialProvider] = useState(null)

  const handleSocialSuccess = () => {
    setSocialProvider(null)
    navigate('/')
  }

  const handleSubmit = (e) => {
    e.preventDefault()
  }

  return (
    <div className="signup-page">
      <div className="signup-container">
        <div className="signup-header">
          <LogoCircle onClick={() => navigate('/')} size="small" label="Back to home" />
          <h1 className="signup-title">Create your account</h1>
          <p className="signup-subtitle">Let&apos;s get you started</p>
        </div>

        <form className="signup-form" onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="fullName">Full Name</label>
            <div className="input-wrapper">
              <span className="input-icon"><PersonIcon /></span>
              <input
                id="fullName"
                type="text"
                placeholder="Enter your full name"
                autoComplete="name"
              />
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="username">Username</label>
            <div className="input-wrapper">
              <span className="input-icon"><AtIcon /></span>
              <input
                id="username"
                type="text"
                placeholder="Choose a username"
                autoComplete="username"
              />
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="email">Email</label>
            <div className="input-wrapper">
              <span className="input-icon"><EnvelopeIcon /></span>
              <input
                id="email"
                type="email"
                placeholder="Enter your email"
                autoComplete="email"
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
                placeholder="Create a password"
                autoComplete="new-password"
              />
              <button
                type="button"
                className="password-toggle"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                  {showPassword ? (
                    <>
                      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" />
                      <circle cx="12" cy="12" r="3" />
                    </>
                  ) : (
                    <>
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-10-8-10-8a18.45 18.45 0 0 1 5.06-5.94" />
                      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 10 8 10 8a18.5 18.5 0 0 1-2.16 3.19" />
                      <line x1="1" y1="1" x2="23" y2="23" />
                    </>
                  )}
                </svg>
              </button>
            </div>
          </div>

          <button type="submit" className="signup-btn">Sign up</button>
        </form>

        <p className="su-divider-text">or continue with</p>

        <div className="su-social-buttons">
          <button
            type="button"
            className="su-social-btn"
            aria-label="Continue with Facebook"
            onClick={() => setSocialProvider('facebook')}
          >
            <FacebookIcon />
          </button>
          <button
            type="button"
            className="su-social-btn"
            aria-label="Continue with Google"
            onClick={() => setSocialProvider('google')}
          >
            <GoogleIcon />
          </button>
        </div>

        {socialProvider && (
          <SocialAuthModal
            provider={socialProvider}
            onSuccess={handleSocialSuccess}
            onClose={() => setSocialProvider(null)}
          />
        )}

        <p className="login-text">
          Already have an account?{' '}
          <button type="button" className="login-link" onClick={() => navigate('/login')}>
            Login
          </button>
        </p>
      </div>
    </div>
  )
}
