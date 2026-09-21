import { useEffect, useRef, useState } from 'react'
import { BrowserMultiFormatReader } from '@zxing/browser'
import { NotFoundException, ChecksumException, FormatException, BarcodeFormat, DecodeHintType } from '@zxing/library'

// NotFoundException/ChecksumException/FormatException each extend zxing's
// base Exception directly (not ReaderException, despite that class's name
// suggesting otherwise) — checking `instanceof ReaderException` here always
// misses them, which is why every single frame without a barcode used to log
// a "No MultiFormat Readers..." error and flood devtools.
function isNoBarcodeInFrame(err) {
  return err instanceof NotFoundException || err instanceof ChecksumException || err instanceof FormatException
}

// Restricting to the formats a staff badge would actually use (vs. zxing's
// full default list of ~15) cuts out most of the internal sub-readers that
// otherwise fire on every single video frame — with all formats enabled,
// mismatched readers routinely throw a non-NotFoundException error internally
// that zxing logs as a console warning on nearly every frame, flooding devtools.
const SCAN_HINTS = new Map([
  [DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.CODE_128, BarcodeFormat.QR_CODE]],
])
import { apiPost } from '../utils/api'
import './ScanIdModal.css'

// Keep this in sync with the `.sim-target-box` inset in ScanIdModal.css and
// the `.sim-video` object-fit: cover in the same file — the goal is for the
// decoder to only ever look at the exact region the green guide box shows
// the user, so a badge has to actually be lined up in the box (not just
// somewhere in the camera's field of view) before its barcode is read.
const TARGET_BOX_INSET = { top: 0.16, bottom: 0.16, left: 0.12, right: 0.12 }
const VIDEO_DISPLAY_ASPECT = 4 / 3
const SCAN_RETRY_DELAY_MS = 120

// Computes, in native video-pixel coordinates, the sub-rectangle the green
// guide box covers — first replicating the `object-fit: cover` crop the
// video element applies to fit its native resolution into the 4:3 display
// box, then applying the same inset percentages as `.sim-target-box`.
function getTargetBoxRect(videoWidth, videoHeight) {
  if (!videoWidth || !videoHeight) return null
  const videoAspect = videoWidth / videoHeight
  let coverW = videoWidth
  let coverH = videoHeight
  let offsetX = 0
  let offsetY = 0
  if (videoAspect > VIDEO_DISPLAY_ASPECT) {
    coverW = videoHeight * VIDEO_DISPLAY_ASPECT
    offsetX = (videoWidth - coverW) / 2
  } else {
    coverH = videoWidth / VIDEO_DISPLAY_ASPECT
    offsetY = (videoHeight - coverH) / 2
  }
  const sx = offsetX + coverW * TARGET_BOX_INSET.left
  const sy = offsetY + coverH * TARGET_BOX_INSET.top
  const sw = coverW * (1 - TARGET_BOX_INSET.left - TARGET_BOX_INSET.right)
  const sh = coverH * (1 - TARGET_BOX_INSET.top - TARGET_BOX_INSET.bottom)
  return { sx, sy, sw, sh }
}

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
  const videoRef = useRef(null)
  const busyRef = useRef(false)
  const mountedRef = useRef(true)
  const [phase, setPhase] = useState('starting')
  const [notFoundCode, setNotFoundCode] = useState('')
  const [scanKey, setScanKey] = useState(0)
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    mountedRef.current = true
    setPhase('starting')
    setNotFoundCode('')
    busyRef.current = false

    const reader = new BrowserMultiFormatReader(SCAN_HINTS)
    const cropCanvas = document.createElement('canvas')
    const cropCtx = cropCanvas.getContext('2d', { willReadFrequently: true })
    let stream = null
    let retryTimeoutId = null

    const stopStream = () => {
      stream?.getTracks().forEach((t) => t.stop())
      stream = null
    }

    const scheduleNextAttempt = () => {
      retryTimeoutId = setTimeout(attemptDecode, SCAN_RETRY_DELAY_MS)
    }

    const attemptDecode = () => {
      if (!mountedRef.current) return
      const video = videoRef.current
      if (busyRef.current || !video || video.readyState < 2) {
        scheduleNextAttempt()
        return
      }
      const box = getTargetBoxRect(video.videoWidth, video.videoHeight)
      if (!box) {
        scheduleNextAttempt()
        return
      }
      cropCanvas.width = box.sw
      cropCanvas.height = box.sh
      cropCtx.drawImage(video, box.sx, box.sy, box.sw, box.sh, 0, 0, box.sw, box.sh)

      try {
        const decoded = reader.decodeFromCanvas(cropCanvas)
        const code = decoded.getText().trim()
        busyRef.current = true
        setPhase('checking')
        apiPost('/api/attendance/scan', { employee_id: code })
          .then((data) => {
            if (!mountedRef.current) return
            stopStream()
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
              scheduleNextAttempt()
            }, 2200)
          })
        return
      } catch (err) {
        // A decode failure here just means "no valid barcode in this frame"
        // — completely normal whenever the badge isn't lined up inside the
        // guide box, not worth surfacing.
        if (!isNoBarcodeInFrame(err)) {
          console.error('barcode decode error:', err)
        }
      }
      scheduleNextAttempt()
    }

    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: 'environment' } })
      .then((s) => {
        if (!mountedRef.current) { s.getTracks().forEach((t) => t.stop()); return }
        stream = s
        const video = videoRef.current
        video.srcObject = s
        video.play().catch(() => {})
        attemptDecode()
      })
      .catch((err) => {
        if (!mountedRef.current) return
        console.error('camera start error:', err)
        setPhase(err?.name === 'NotFoundError' ? 'no-camera' : 'denied')
      })

    return () => {
      mountedRef.current = false
      clearTimeout(retryTimeoutId)
      stopStream()
    }
  }, [scanKey])

  const retryCamera = () => {
    setScanKey((k) => k + 1)
  }

  const showCamera = phase === 'starting' || phase === 'scanning' || phase === 'checking' || phase === 'not-found'
  const showPermissionError = phase === 'denied' || phase === 'no-camera'

  return (
    <div className="sim-backdrop" onClick={onClose}>
      <div className="sim-modal" onClick={(e) => e.stopPropagation()}>
        <div className="sim-body">
          <div className="sim-top">
            <div className="sim-icon-badge"><ScanBadgeIcon /></div>
            <div className="sim-live-clock">
              <ClockIcon />
              {now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', second: '2-digit' })}
            </div>
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
              <button type="button" className="sim-retry-btn" onClick={retryCamera}>Try again</button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export default ScanIdModal
