import { useEffect, useRef, useState } from 'react'
import { BarcodeScanner } from 'react-barcode-scanner'
// ZBar-wasm polyfill for the Barcode Detection API — see
// https://reactbarcodescanner.vercel.app/docs/install. Picked over the
// alternative ZXing polyfill because it's ~1/4 the wasm payload and covers
// the code_128 + qr_code formats a staff badge actually uses.
import 'react-barcode-scanner/polyfill'
import { apiPost } from '../utils/api'
import { formatManilaTime } from '../utils/manilaTime'
import './ScanIdModal.css'

// Restricting formats (vs. every format the detector supports) keeps the
// scan loop cheap and avoids false positives from unrelated codes in frame.
const SCAN_OPTIONS = { formats: ['code_128', 'qr_code'], delay: 350 }

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

// 'starting'  — camera permission requested / stream not yet playing
// 'scanning'  — live feed, decoding every frame
// 'checking'  — a barcode was decoded, awaiting the backend lookup
// 'not-found' — decoded fine, but no employee matches that badge
// 'denied'    — camera permission was refused
// 'no-camera' — no camera device is available on this machine
//
// On a successful scan this modal closes itself (calling onClose) right
// after handing the result to onLogged — the "attendance logged" confirmation
// is a separate popup (AttendanceConfirmModal) the parent shows once the
// camera/scanner is fully torn down, not a phase rendered in here.
function ScanIdModal({ onClose, onLogged }) {
  const busyRef = useRef(false)
  const mountedRef = useRef(true)
  const [phase, setPhase] = useState('starting')
  const [notFoundCode, setNotFoundCode] = useState('')
  const [scanKey, setScanKey] = useState(0)
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    mountedRef.current = true
    return () => { mountedRef.current = false }
  }, [])

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [])

  // Resets for every (re)try. The library doesn't expose a "camera is now
  // playing" callback, so as a fallback we assume streaming has started if
  // no error shows up shortly — the video itself is already visible either
  // way, this only affects how long the "Starting camera…" caption lingers.
  useEffect(() => {
    setPhase('starting')
    setNotFoundCode('')
    busyRef.current = false
    const fallback = setTimeout(() => {
      setPhase((p) => (p === 'starting' ? 'scanning' : p))
    }, 1200)
    return () => clearTimeout(fallback)
  }, [scanKey])

  const handleCapture = (barcodes) => {
    if (busyRef.current || !barcodes?.length) return
    const code = (barcodes[0].rawValue || '').trim()
    if (!code) return

    busyRef.current = true
    setPhase('checking')
    apiPost('/api/attendance/scan', { employee_id: code })
      .then((data) => {
        if (!mountedRef.current) return
        onLogged?.(data)
        onClose?.()
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
  }

  const handleCameraError = (err) => {
    if (!mountedRef.current) return
    console.error('camera start error:', err)
    setPhase(err?.name === 'NotFoundError' ? 'no-camera' : 'denied')
  }

  const retryCamera = () => {
    setScanKey((k) => k + 1)
  }

  const showCamera = phase === 'starting' || phase === 'scanning' || phase === 'checking' || phase === 'not-found'
  const showPermissionError = phase === 'denied' || phase === 'no-camera'
  const scanningPaused = phase === 'checking' || phase === 'not-found'

  return (
    <div className="sim-backdrop" onClick={onClose}>
      <div className="sim-modal" onClick={(e) => e.stopPropagation()}>
        <div className="sim-body">
          <div className="sim-top">
            <div className="sim-icon-badge"><ScanBadgeIcon /></div>
            <div className="sim-live-clock">
              <ClockIcon />
              {formatManilaTime(now, { second: '2-digit' })}
            </div>
            <button className="sim-close" onClick={onClose} aria-label="Close">✕</button>
          </div>
          <h3 className="sim-title">Scan ID to log attendance</h3>
          <p className="sim-sub">Point the staff badge's barcode at the camera.</p>

          {showCamera && (
            <>
              <div className="sim-video-wrap">
                <BarcodeScanner
                  key={scanKey}
                  className="sim-video"
                  options={SCAN_OPTIONS}
                  paused={scanningPaused}
                  onCapture={handleCapture}
                  onCameraError={handleCameraError}
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
              <button type="button" className="sim-retry-btn" onClick={retryCamera}>Try again</button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export default ScanIdModal
