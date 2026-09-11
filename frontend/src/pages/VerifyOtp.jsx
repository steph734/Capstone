import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import LogoCircle from '../components/LogoCircle'
import './VerifyOtp.css'

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000'
const CODE_LEN = 6
const RESEND_COOLDOWN = 60 // seconds

function ShieldIcon() {
  return (
    <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  )
}

export default function VerifyOtp() {
  const navigate = useNavigate()
  const location = useLocation()
  const email = (location.state?.email || '').trim().toLowerCase()

  const [digits, setDigits] = useState(() => Array(CODE_LEN).fill(''))
  const [status, setStatus] = useState('idle') // idle | verifying | error
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [cooldown, setCooldown] = useState(RESEND_COOLDOWN)
  const inputsRef = useRef([])

  const code = useMemo(() => digits.join(''), [digits])

  // No email in navigation state — the page was opened directly. Send them back.
  useEffect(() => {
    if (!email) {
      const t = setTimeout(() => navigate('/signup', { replace: true }), 2500)
      return () => clearTimeout(t)
    }
  }, [email, navigate])

  // Resend cooldown tick.
  useEffect(() => {
    if (cooldown <= 0) return
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000)
    return () => clearTimeout(t)
  }, [cooldown])

  useEffect(() => {
    inputsRef.current[0]?.focus()
  }, [])

  const setDigit = (idx, value) => {
    const clean = value.replace(/\D/g, '')
    setError('')
    if (status === 'error') setStatus('idle')

    if (clean.length > 1) {
      // Pasted / multi-char: spread across the boxes from here.
      setDigits((prev) => {
        const next = [...prev]
        for (let i = 0; i < clean.length && idx + i < CODE_LEN; i++) {
          next[idx + i] = clean[i]
        }
        return next
      })
      const landed = Math.min(idx + clean.length, CODE_LEN - 1)
      inputsRef.current[landed]?.focus()
      return
    }

    setDigits((prev) => {
      const next = [...prev]
      next[idx] = clean
      return next
    })
    if (clean && idx < CODE_LEN - 1) inputsRef.current[idx + 1]?.focus()
  }

  const handleKeyDown = (idx, e) => {
    if (e.key === 'Backspace' && !digits[idx] && idx > 0) {
      inputsRef.current[idx - 1]?.focus()
    }
    if (e.key === 'ArrowLeft' && idx > 0) inputsRef.current[idx - 1]?.focus()
    if (e.key === 'ArrowRight' && idx < CODE_LEN - 1) inputsRef.current[idx + 1]?.focus()
  }

  const submit = async (e) => {
    e?.preventDefault()
    if (code.length !== CODE_LEN) {
      setError('Enter all 6 digits.')
      setStatus('error')
      return
    }
    setStatus('verifying')
    setError('')
    setNotice('')
    try {
      const res = await fetch(`${API_BASE}/api/auth/verify-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Could not verify the code.')

      navigate('/login', {
        replace: true,
        state: { signupEmail: email, notice: 'Email verified! Sign in with your new account.' },
      })
    } catch (err) {
      setStatus('error')
      setError(
        err instanceof TypeError
          ? 'Cannot reach the server. Is the backend running on port 5000?'
          : err.message
      )
      setDigits(Array(CODE_LEN).fill(''))
      inputsRef.current[0]?.focus()
    }
  }

  const resend = async () => {
    if (cooldown > 0) return
    setError('')
    setNotice('')
    try {
      const res = await fetch(`${API_BASE}/api/auth/resend-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setCooldown(data.retryAfter || RESEND_COOLDOWN)
        throw new Error(data.error || 'Could not resend the code.')
      }
      setNotice('A fresh code is on its way. Check your inbox.')
      setCooldown(RESEND_COOLDOWN)
    } catch (err) {
      setError(err.message || 'Could not resend the code.')
    }
  }

  return (
    <div className="otp-page">
      <div className="otp-container">
        <div className="otp-header">
          <LogoCircle onClick={() => navigate('/')} size="small" label="Back to home" />
          <div className="otp-icon"><ShieldIcon /></div>
          <h1 className="otp-title">Verify your email</h1>
          <p className="otp-subtitle">
            {email ? (
              <>Enter the 6-digit code we sent to <strong>{email}</strong>. It expires in 10 minutes.</>
            ) : (
              <>We couldn&rsquo;t tell which email to verify. Taking you back to sign up&hellip;</>
            )}
          </p>
        </div>

        {email && (
          <form className="otp-form" onSubmit={submit}>
            <div className="otp-inputs" role="group" aria-label="Verification code">
              {digits.map((d, i) => (
                <input
                  key={i}
                  ref={(el) => { inputsRef.current[i] = el }}
                  type="text"
                  inputMode="numeric"
                  autoComplete={i === 0 ? 'one-time-code' : 'off'}
                  maxLength={CODE_LEN}
                  value={d}
                  aria-label={`Digit ${i + 1}`}
                  className={status === 'error' ? 'otp-box err' : 'otp-box'}
                  onChange={(e) => setDigit(i, e.target.value)}
                  onKeyDown={(e) => handleKeyDown(i, e)}
                  onFocus={(e) => e.target.select()}
                />
              ))}
            </div>

            {error && <p className="otp-error" role="alert">{error}</p>}
            {notice && <p className="otp-notice">{notice}</p>}

            <button type="submit" className="otp-btn" disabled={status === 'verifying'}>
              {status === 'verifying' ? 'Verifying…' : 'Verify'}
            </button>
          </form>
        )}

        {email && (
          <p className="otp-resend-text">
            Didn&rsquo;t get it?{' '}
            <button
              type="button"
              className="otp-resend-link"
              onClick={resend}
              disabled={cooldown > 0}
            >
              {cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend code'}
            </button>
          </p>
        )}

        <p className="otp-back-text">
          <button type="button" className="otp-resend-link" onClick={() => navigate('/login')}>
            Back to Sign In
          </button>
        </p>
      </div>
    </div>
  )
}
