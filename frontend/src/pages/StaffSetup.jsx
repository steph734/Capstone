import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import LogoCircle from '../components/LogoCircle'
import { apiGet, apiPostForm } from '../utils/api'
import './Splash.css'
import './ResetPassword.css'
import './StaffSetup.css'

const DOC_FIELDS = [
  { key: 'ptr', label: 'Professional License (PTR)' },
  { key: 'prc', label: 'PRC License' },
  { key: 'diploma', label: 'Diploma / Certificate' },
  { key: 'id', label: 'Valid ID' },
]

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

  const [showUpload, setShowUpload] = useState(false)
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
        setShowUpload(true)
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

    if (!allFilesChosen) {
      setError('Please upload all 4 documents.')
      return
    }

    setSubmitting(true)
    try {
      const formData = new FormData()
      DOC_FIELDS.forEach((f) => formData.append(f.key, files[f.key]))
      await apiPostForm(`/api/staff-setup/${token}/complete`, formData)
      setShowUpload(false)
      setDone(true)
    } catch (err) {
      setError(err.message || 'Could not complete your account setup.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="splash-container">
      <LogoCircle onClick={() => navigate('/')} size="large" label="Go to home" />
      <h1 className="app-title">Therapy Pro</h1>

      {status === 'loading' && <p className="ss-loading">Checking your invite…</p>}

      {status === 'invalid' && (
        <div className="rp-modal-overlay" role="dialog" aria-modal="true" aria-labelledby="ss-modal-title">
          <div className="rp-modal ss-modal">
            <div className="ss-invalid">
              <h2 id="ss-modal-title">Link invalid or expired</h2>
              <p>{loadError}</p>
              <button type="button" className="rp-btn primary" onClick={goToLogin}>Go to Sign In</button>
            </div>
          </div>
        </div>
      )}

      {status === 'ready' && !done && !showUpload && (
        <button type="button" className="rp-btn primary" onClick={() => setShowUpload(true)}>
          Upload Documents
        </button>
      )}

      {done && (
        <div className="rp-modal-overlay" role="dialog" aria-modal="true" aria-labelledby="ss-done-title">
          <div className="rp-modal ss-modal">
            <div className="rp-success">
              <div className="rp-success-check"><CheckIcon /></div>
              <h2 id="ss-done-title">Documents submitted</h2>
              <p>Your documents are on file and awaiting the owner's review. You'll be notified once your account is approved.</p>
              <button type="button" className="rp-btn primary" onClick={goToLogin}>Go to Sign In</button>
            </div>
          </div>
        </div>
      )}

      {showUpload && (
        <div className="rp-modal-overlay" role="dialog" aria-modal="true" aria-labelledby="ss-upload-title" onClick={() => !submitting && setShowUpload(false)}>
          <div className="rp-modal ss-modal" onClick={(e) => e.stopPropagation()}>
            <div className="rp-modal-header">
              <h2 id="ss-upload-title">Upload your documents</h2>
              <p>PTR, PRC license, diploma, and a valid ID — PDF, JPG, or PNG, up to 5MB each.</p>
            </div>

            <form className="rp-form" onSubmit={handleSubmit}>
              <div className="ss-docs">
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
                <button type="button" className="rp-btn secondary" onClick={() => setShowUpload(false)} disabled={submitting}>
                  Cancel
                </button>
                <button type="submit" className="rp-btn primary" disabled={submitting}>
                  {submitting ? 'Saving…' : 'Submit Documents'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
