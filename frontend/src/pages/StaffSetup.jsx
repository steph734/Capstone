import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import LogoCircle from '../components/LogoCircle'
import { apiGet, apiPostForm } from '../utils/api'
import './ForgotPassword.css'
import './ResetPassword.css'
import './StaffSetup.css'

const DOC_FIELDS = [
  { key: 'ptr', label: 'Professional License (PTR)' },
  { key: 'prc', label: 'PRC License' },
  { key: 'diploma', label: 'Diploma / Certificate' },
  { key: 'id', label: 'Valid ID' },
]

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

function UploadIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 16V4M7 9l5-5 5 5M5 20h14" />
    </svg>
  )
}

export default function StaffSetup() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const token = params.get('token') || ''

  const [status, setStatus] = useState('loading') // loading | ready | invalid
  const [info, setInfo] = useState(null)
  const [loadError, setLoadError] = useState('')

  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [files, setFiles] = useState({ ptr: null, prc: null, diploma: null, id: null })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  useEffect(() => {
    if (!token) {
      setLoadError('This setup link is missing its token.')
      setStatus('invalid')
      return
    }
    let cancelled = false
    apiGet(`/api/staff-setup/${token}`)
      .then((data) => {
        if (cancelled) return
        setInfo(data)
        setStatus('ready')
      })
      .catch((err) => {
        if (cancelled) return
        setLoadError(err.message || 'This setup link is invalid or has expired.')
        setStatus('invalid')
      })
    return () => { cancelled = true }
  }, [token])

  const setFile = (key, file) => setFiles((f) => ({ ...f, [key]: file }))
  const allFilesChosen = DOC_FIELDS.every((f) => files[f.key])
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
    if (!allFilesChosen) {
      setError('Please upload all 4 documents.')
      return
    }

    setSubmitting(true)
    try {
      const formData = new FormData()
      formData.append('password', password)
      DOC_FIELDS.forEach((f) => formData.append(f.key, files[f.key]))
      await apiPostForm(`/api/staff-setup/${token}/complete`, formData)
      setDone(true)
    } catch (err) {
      setError(err.message || 'Could not complete your account setup.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="forgot-page">
      <div className="forgot-container">
        <div className="forgot-header">
          <LogoCircle onClick={() => navigate('/')} size="small" label="Back to home" />
          <h1 className="forgot-title">Account Setup</h1>
          <p className="forgot-subtitle">Opening your secure setup form…</p>
        </div>
      </div>

      <div className="rp-modal-overlay" role="dialog" aria-modal="true" aria-labelledby="ss-modal-title">
        <div className="rp-modal ss-modal">
          {status === 'loading' && <p className="ss-loading">Checking your invite…</p>}

          {status === 'invalid' && (
            <div className="ss-invalid">
              <h2 id="ss-modal-title">Link invalid or expired</h2>
              <p>{loadError}</p>
              <button type="button" className="rp-btn primary" onClick={goToLogin}>Go to Sign In</button>
            </div>
          )}

          {status === 'ready' && !done && (
            <>
              <div className="rp-modal-header">
                <h2 id="ss-modal-title">Welcome, {info.name}</h2>
                <p>
                  {info.position}{info.branch_name ? ` · ${/\bbranch\b/i.test(info.branch_name) ? info.branch_name : `${info.branch_name} branch`}` : ''} — set your
                  password and upload your documents to activate your account.
                </p>
              </div>

              <form className="rp-form" onSubmit={handleSubmit}>
                <div className="rp-field">
                  <label htmlFor="ss-password">New Password</label>
                  <div className="rp-input-wrapper">
                    <span className="rp-input-icon"><LockIcon /></span>
                    <input
                      id="ss-password"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="At least 8 characters"
                      autoComplete="new-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                    <button type="button" className="rp-toggle" onClick={() => setShowPassword((v) => !v)}>
                      {showPassword ? 'Hide' : 'Show'}
                    </button>
                  </div>
                </div>

                <div className="rp-field">
                  <label htmlFor="ss-confirm">Confirm Password</label>
                  <div className="rp-input-wrapper">
                    <span className="rp-input-icon"><LockIcon /></span>
                    <input
                      id="ss-confirm"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="Re-enter your new password"
                      autoComplete="new-password"
                      value={confirm}
                      onChange={(e) => setConfirm(e.target.value)}
                    />
                  </div>
                </div>

                <div className="ss-docs">
                  <p className="ss-docs-title">Upload your documents</p>
                  {DOC_FIELDS.map((f) => (
                    <label key={f.key} className={`ss-doc-row ${files[f.key] ? 'chosen' : ''}`}>
                      <span className="ss-doc-icon"><UploadIcon /></span>
                      <span className="ss-doc-info">
                        <span className="ss-doc-label">{f.label}</span>
                        <span className="ss-doc-hint">
                          {files[f.key] ? files[f.key].name : 'PDF, JPG, PNG (max 5MB)'}
                        </span>
                      </span>
                      <span className="ss-doc-btn">{files[f.key] ? 'Replace' : 'Upload'}</span>
                      <input
                        type="file"
                        accept=".pdf,.jpg,.jpeg,.png"
                        hidden
                        onChange={(e) => setFile(f.key, e.target.files?.[0] || null)}
                      />
                    </label>
                  ))}
                </div>

                {error && <p className="rp-error">{error}</p>}

                <div className="rp-actions">
                  <button type="submit" className="rp-btn primary" disabled={submitting}>
                    {submitting ? 'Saving…' : 'Complete Setup'}
                  </button>
                </div>
              </form>
            </>
          )}

          {done && (
            <div className="rp-success">
              <div className="rp-success-check"><CheckIcon /></div>
              <h2>Account activated</h2>
              <p>Your password is set and your documents are on file. You can now sign in.</p>
              <button type="button" className="rp-btn primary" onClick={goToLogin}>Go to Sign In</button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
