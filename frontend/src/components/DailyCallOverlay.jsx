import { useEffect, useState } from 'react'
import Daily from '@daily-co/daily-js'
import {
  DailyProvider,
  useDaily,
  useDailyEvent,
  useParticipantIds,
  useLocalParticipant,
  DailyVideo,
  DailyAudio,
} from '@daily-co/daily-react'
import { DAILY_ROOM_URL, isDailyConfigured } from '../utils/dailyConfig'
import './DailyCallOverlay.css'

function XIcon() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
}
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

function ParticipantTile({ id, isLocal }) {
  return (
    <div className={`daily-tile ${isLocal ? 'local' : ''}`}>
      <DailyVideo sessionId={id} type="video" automirror className="daily-tile-video" />
      {isLocal && <span className="daily-tile-label">You</span>}
    </div>
  )
}

function CallUI({ onClose }) {
  const daily = useDaily()
  const participantIds = useParticipantIds()
  const localParticipant = useLocalParticipant()
  const [micOn, setMicOn] = useState(true)
  const [cameraOn, setCameraOn] = useState(true)
  const [joined, setJoined] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  useDailyEvent('joined-meeting', () => setJoined(true))
  useDailyEvent('error', (ev) => setErrorMsg(ev?.errorMsg || 'Something went wrong with the call.'))
  useDailyEvent('camera-error', () => setErrorMsg('Camera/microphone permission was blocked or unavailable.'))

  const toggleMic = () => {
    const next = !micOn
    setMicOn(next)
    daily?.setLocalAudio(next)
  }
  const toggleCamera = () => {
    const next = !cameraOn
    setCameraOn(next)
    daily?.setLocalVideo(next)
  }

  return (
    <div className="daily-call-overlay">
      <button className="daily-call-close" onClick={onClose} aria-label="Close call">
        <XIcon />
      </button>

      {errorMsg ? (
        <div className="daily-call-message">
          <p>{errorMsg}</p>
          <button className="daily-call-close-btn" onClick={onClose}>Close</button>
        </div>
      ) : !joined ? (
        <div className="daily-call-message">Connecting…</div>
      ) : (
        <>
          <div className="daily-tile-grid">
            {participantIds.map((id) => (
              <ParticipantTile key={id} id={id} isLocal={id === localParticipant?.session_id} />
            ))}
          </div>
          <DailyAudio />
        </>
      )}

      <div className="daily-call-controls">
        <button
          className={`daily-control-btn ${!micOn ? 'off' : ''}`}
          onClick={toggleMic}
          aria-label={micOn ? 'Mute microphone' : 'Unmute microphone'}
        >
          {micOn ? <MicIcon /> : <MicOffIcon />}
        </button>
        <button
          className={`daily-control-btn ${!cameraOn ? 'off' : ''}`}
          onClick={toggleCamera}
          aria-label={cameraOn ? 'Turn camera off' : 'Turn camera on'}
        >
          {cameraOn ? <CameraIcon /> : <CameraOffIcon />}
        </button>
        <button className="daily-control-btn daily-hangup" onClick={onClose} aria-label="End call">
          <HangUpIcon />
        </button>
      </div>
    </div>
  )
}

// Real Daily.co video/voice call. Uses a single public room (see dailyConfig.js) —
// no API key or backend token needed, since a public room accepts any joiner.
export default function DailyCallOverlay({ open, userName, onClose }) {
  const [callObject, setCallObject] = useState(null)

  useEffect(() => {
    if (!open || !isDailyConfigured()) return undefined

    // allowMultipleCallInstances guards against React StrictMode's dev-mode
    // double-effect-invocation creating two call objects back to back.
    const co = Daily.createCallObject({
      url: DAILY_ROOM_URL,
      userName,
      allowMultipleCallInstances: true,
    })
    setCallObject(co)
    co.join().catch(() => {})

    return () => {
      co.leave().catch(() => {})
      co.destroy().catch(() => {})
      setCallObject(null)
    }
  }, [open, userName])

  if (!open) return null

  if (!isDailyConfigured()) {
    return (
      <div className="daily-call-overlay">
        <div className="daily-call-message">
          <p>Video calling isn’t set up yet. Add your Daily.co room URL to .env (see .env.example).</p>
          <button className="daily-call-close-btn" onClick={onClose}>Close</button>
        </div>
      </div>
    )
  }

  if (!callObject) {
    return (
      <div className="daily-call-overlay">
        <div className="daily-call-message">Connecting…</div>
      </div>
    )
  }

  return (
    <DailyProvider callObject={callObject}>
      <CallUI onClose={onClose} />
    </DailyProvider>
  )
}
