import { useEffect, useRef, useState } from 'react'
import { BrowserMultiFormatReader } from '@zxing/browser'
import { NotFoundException } from '@zxing/library'
import { apiPost } from '../utils/api'
import './ScanIdModal.css'

function ScanBadgeIcon({ size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 8V6a2 2 0 0 1 2-2h2" />
      <path d="M16 4h2a2 2 0 0 1 2 2v2" />
      <path d="M20 16v2a2 2 0 0 1-2 2h-2" />
      <path d="M8 20H6a2 2 0 0 1-2-2v-2" />
      <path d="M4 12h16" />
    </svg>
  )
}
function CheckCircleIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <path d="M8.5 12.5l2.5 2.5 4.5-5" />
    </svg>
  )
}
function ClockIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3.5 2" />
    </svg>
  )
}
function CameraOffIcon() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 2l20 20" />
      <path d="M9.5 5h5l1 1.6H17a2 2 0 0 1 2 2V16" />
      <path d="M4 8a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h11" />
      <circle cx="12" cy="13" r="3.5" />
    </svg>
  )
}

function initialsFromName(name) {
  return (
    (name || '')
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0].toUpperCase())
      .join('') || '?'
  )
}

// 'starting'  — camera permission requested / stream not yet playing
// 'scanning'  — live feed, decoding every frame
// 'checking'  — a barcode was decoded, awaiting the backend lookup
// 'success'   — attendance logged, showing the result card
// 'not-found' — decoded fine, but no employee matches that badge
// 'denied'    — camera permission was refused
// 'no-camera' — no camera device is available on this machine
function ScanIdModal({ onClose, onLogged }) {
  const videoRef = useRef(null)
  const controlsRef = useRef(null)
  const busyRef = useRef(false)
  const mountedRef = useRef(true)
  const [phase, setPhase] = useState('starting')
  const [notFoundCode, setNotFoundCode] = useState('')
  const [result, setResult] = useState(null)
  const [scanKey, setScanKey] = useState(0)

  useEffect(() => {
    mountedRef.current = true
    setPhase('starting')
    setResult(null)
    setNotFoundCode('')
    busyRef.current = false

    const reader = new BrowserMultiFormatReader()

    reader
      .decodeFromVideoDevice(undefined, videoRef.current, (decoded, err) => {
        if (!mountedRef.current || busyRef.current) return
        if (decoded) {
          busyRef.current = true
          const code = decoded.getText().trim()
          setPhase('checking')
          apiPost('/api/attendance/scan', { employee_id: code })
            .then((data) => {
              if (!mountedRef.current) return
              controlsRef.current?.stop()
              setResult(data)
              setPhase('success')
              onLogged?.(data)
            })
            .catch((apiErr) => {
              if (!mountedRef.current) return
              setNotFoundCode(apiErr.message || `No staff member matches badge "${code}".`)
              setPhase('not-found')
              // Give the owner a moment to read the message, then let the
              // still-running camera try again on the next held-up badge.
              setTimeout(() => {
                if (!mountedRef.current) return
                busyRef.current = false
                setPhase('scanning')
              }, 2200)
            })
          return
        }
        // A frame with no readable barcode isn't an error worth surfacing —
        // it's just most frames while the badge isn't lined up yet.
        if (err && !(err instanceof NotFoundException)) {
          console.error('barcode decode error:', err)
        }
      })
      .then((controls) => {
        if (!mountedRef.current) { controls.stop(); return }
        controlsRef.current = controls
      })
      .catch((err) => {
        if (!mountedRef.current) return
        console.error('camera start error:', err)
        setPhase(err?.name === 'NotFoundError' ? 'no-camera' : 'denied')
      })

    return () => {
      mountedRef.current = false
      controlsRef.current?.stop()
      controlsRef.current = null
    }
  }, [scanKey])

  const scanNext = () => {
    setResult(null)
    setScanKey((k) => k + 1)
  }

  const formatTime = (iso) => {
    const d = new Date(iso)
    return `${d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}, ${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`
  }

  const showCamera = phase === 'starting' || phase === 'scanning' || phase === 'checking' || phase === 'not-found'
  const showPermissionError = phase === 'denied' || phase === 'no-camera'

  return (
    <div className="sim-backdrop" onClick={onClose}>
      <div className="sim-modal" onClick={(e) => e.stopPropagation()}>
        {phase !== 'success' ? (
          <div className="sim-body">
            <div className="sim-top">
              <div className="sim-icon-badge"><ScanBadgeIcon /></div>
              <button className="sim-close" onClick={onClose} aria-label="Close">✕</button>
            </div>
            <h3 className="sim-title">Scan ID to log attendance</h3>
            <p className="sim-sub">Point the staff badge's barcode at the camera.</p>

            {showCamera && (
              <>
                <div className="sim-video-wrap">
                  <video
                    ref={videoRef}
                    className="sim-video"
                    muted
                    playsInline
                    autoPlay
                    onPlaying={() => setPhase((p) => (p === 'starting' ? 'scanning' : p))}
                  />
                  {phase !== 'starting' && <div className="sim-target-box" />}
                  {phase === 'starting' && (
                    <div className="sim-video-overlay">Starting camera…</div>
                  )}
                </div>

                <div className={`sim-status ${phase === 'not-found' ? 'error' : ''}`}>
                  <span className={`sim-status-dot ${phase === 'not-found' ? 'error' : ''}`} />
                  {phase === 'starting' && 'Connecting to camera…'}
                  {phase === 'scanning' && 'Waiting for scan…'}
                  {phase === 'checking' && 'Checking badge…'}
                  {phase === 'not-found' && notFoundCode}
                </div>
              </>
            )}

            {showPermissionError && (
              <>
                <div className="sim-video-wrap sim-video-wrap-error">
                  <CameraOffIcon />
                </div>
                <div className="sim-status error centered">
                  {phase === 'denied'
                    ? "Camera access was denied. Allow camera permissions for this site, then try again."
                    : 'No camera was found on this device. Connect a webcam and try again.'}
                </div>
                <button type="button" className="sim-retry-btn" onClick={scanNext}>Try again</button>
              </>
            )}
          </div>
        ) : (
          <>
            <div className="sim-body">
              <div className="sim-top">
                <div className="sim-success-check"><CheckCircleIcon /></div>
                <button className="sim-close" onClick={onClose} aria-label="Close">✕</button>
              </div>
              <h3 className="sim-title">Attendance logged</h3>

              <div className="sim-result-card">
                <div className="sim-result-avatar">{result.initials || initialsFromName(result.name)}</div>
                <div className="sim-result-info">
                  <div className="sim-result-name">{result.name}</div>
                  <div className="sim-result-sub">{result.specialty || 'Unassigned'} · {result.branch || '—'}</div>
                </div>
                <span className={`sim-pill ${result.type === 'Time In' ? 'green' : 'yellow'}`}>{result.type}</span>
              </div>

              <div className="sim-logged-time">
                <ClockIcon />
                Logged at {formatTime(result.loggedAt)}
              </div>
            </div>
            <div className="sim-footer">
              <button className="sim-btn-secondary" onClick={scanNext}>Scan next</button>
              <button className="sim-btn-dark" onClick={onClose}>Done</button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

export default ScanIdModal
