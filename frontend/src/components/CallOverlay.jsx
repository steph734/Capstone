import { useState, useEffect, useRef } from 'react'
import './CallOverlay.css'

function MicIcon() {
  return <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M12 14a3 3 0 0 0 3-3V5a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.92V21h2v-3.08A7 7 0 0 0 19 11h-2z" /></svg>
}
function MicOffIcon() {
  return <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M19 11h-2a5 5 0 0 1-.34 1.8l1.45 1.45A6.97 6.97 0 0 0 19 11zM15 11.16V5a3 3 0 0 0-5.94-.6L15 10.83V11.16zM4.27 3L3 4.27l6.01 6.01V11a3 3 0 0 0 4.2 2.75l1.03 1.03A4.98 4.98 0 0 1 7 11H5a7 7 0 0 0 6 6.92V21h2v-3.08c.91-.13 1.76-.45 2.5-.93L19.73 21 21 19.73 4.27 3z" /></svg>
}
function CameraIcon() {
  return <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z" /></svg>
}
function CameraOffIcon() {
  return <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M21 6.5l-4 4V7c0-.55-.45-1-1-1H9.83l-2-2H16c.55 0 1 .45 1 1v3.5l4-4v11l-2.17-2.17L21 17.5v-11zM3.27 2L2 3.27 4.73 6H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.28 0 .53-.11.71-.29L19.73 21 21 19.73 3.27 2z" /></svg>
}
function HangUpIcon() {
  return <svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor"><path d="M12 9c-1.6 0-3.15.25-4.6.72v3.1c0 .39-.23.74-.56.9-.98.49-1.87 1.12-2.66 1.85-.18.18-.43.28-.7.28-.28 0-.53-.11-.71-.29L.29 13.08a1.003 1.003 0 0 1 0-1.42C3.34 8.78 7.46 7 12 7s8.66 1.78 11.71 4.66c.19.18.29.43.29.71 0 .28-.1.53-.29.71l-2.48 2.48c-.18.18-.43.29-.71.29-.27 0-.52-.11-.7-.28-.79-.73-1.68-1.36-2.66-1.85a.996.996 0 0 1-.56-.9v-3.1C15.15 9.25 13.6 9 12 9z" /></svg>
}

function ContactAvatar({ name, avatarUrl, initials, color, size = 96 }) {
  if (avatarUrl) {
    return <img src={avatarUrl} alt={name} className="call-avatar-img" style={{ width: size, height: size }} />
  }
  return (
    <div className="call-avatar-fallback" style={{ width: size, height: size, background: color || '#4a6b5d', fontSize: size * 0.36 }}>
      {initials || name?.charAt(0) || '?'}
    </div>
  )
}

function formatDuration(totalSeconds) {
  const m = String(Math.floor(totalSeconds / 60)).padStart(2, '0')
  const s = String(totalSeconds % 60).padStart(2, '0')
  return `${m}:${s}`
}

export default function CallOverlay({ open, type, contactName, avatarUrl, initials, color, onClose }) {
  const [status, setStatus] = useState('calling') // 'calling' | 'connected'
  const [elapsed, setElapsed] = useState(0)
  const [micOn, setMicOn] = useState(true)
  const [cameraOn, setCameraOn] = useState(type === 'video')
  const [mediaError, setMediaError] = useState('')

  const videoRef = useRef(null)
  const streamRef = useRef(null)
  const timeoutRef = useRef(null)
  const intervalRef = useRef(null)

  useEffect(() => {
    if (!open) return undefined

    setStatus('calling')
    setElapsed(0)
    setMicOn(true)
    setCameraOn(type === 'video')
    setMediaError('')

    // Real local mic/camera preview — the "other side" of the call is mocked
    // (there is no signaling server), but the local media controls are genuine.
    navigator.mediaDevices?.getUserMedia?.({ video: type === 'video', audio: true })
      .then((stream) => {
        streamRef.current = stream
        if (videoRef.current) videoRef.current.srcObject = stream
      })
      .catch(() => {
        setMediaError(type === 'video' ? 'Camera/mic unavailable' : 'Mic unavailable')
      })

    timeoutRef.current = setTimeout(() => {
      setStatus('connected')
      intervalRef.current = setInterval(() => setElapsed((s) => s + 1), 1000)
    }, 1500)

    return () => {
      clearTimeout(timeoutRef.current)
      clearInterval(intervalRef.current)
      streamRef.current?.getTracks().forEach((t) => t.stop())
      streamRef.current = null
    }
  }, [open, type])

  if (!open) return null

  const toggleMic = () => {
    const next = !micOn
    setMicOn(next)
    streamRef.current?.getAudioTracks().forEach((t) => { t.enabled = next })
  }
  const toggleCamera = () => {
    const next = !cameraOn
    setCameraOn(next)
    streamRef.current?.getVideoTracks().forEach((t) => { t.enabled = next })
  }

  return (
    <div className="call-overlay">
      <div className="call-overlay-main">
        <ContactAvatar name={contactName} avatarUrl={avatarUrl} initials={initials} color={color} size={112} />
        <h2 className="call-contact-name">{contactName}</h2>
        <p className="call-status">
          {status === 'calling' ? 'Calling…' : `Connected · ${formatDuration(elapsed)}`}
        </p>
        {mediaError && <p className="call-media-error">{mediaError}</p>}
      </div>

      {type === 'video' && (
        <div className="call-self-view">
          {cameraOn && !mediaError ? (
            <video ref={videoRef} autoPlay playsInline muted className="call-self-video" />
          ) : (
            <div className="call-self-video-off">Camera off</div>
          )}
        </div>
      )}

      <div className="call-controls">
        <button
          className={`call-control-btn ${!micOn ? 'off' : ''}`}
          onClick={toggleMic}
          aria-label={micOn ? 'Mute microphone' : 'Unmute microphone'}
          aria-pressed={!micOn}
        >
          {micOn ? <MicIcon /> : <MicOffIcon />}
        </button>
        {type === 'video' && (
          <button
            className={`call-control-btn ${!cameraOn ? 'off' : ''}`}
            onClick={toggleCamera}
            aria-label={cameraOn ? 'Turn camera off' : 'Turn camera on'}
            aria-pressed={!cameraOn}
          >
            {cameraOn ? <CameraIcon /> : <CameraOffIcon />}
          </button>
        )}
        <button className="call-control-btn call-hangup" onClick={onClose} aria-label="End call">
          <HangUpIcon />
        </button>
      </div>
    </div>
  )
}
