import { useEffect, useState } from 'react'
import {
  StreamVideo,
  StreamVideoClient,
  StreamCall,
  SpeakerLayout,
  CallControls,
} from '@stream-io/video-react-sdk'
import '@stream-io/video-react-sdk/dist/css/styles.css'
import { STREAM_API_KEY, STREAM_CALL_TYPE, STREAM_CALL_ID, isStreamConfigured } from '../utils/streamConfig'
import './StreamCallOverlay.css'

function XIcon() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
}

// Real GetStream Video call between the two demo identities (see streamConfig.js).
// Auth here uses Stream Dashboard "Developer Tokens" — fine for this project since
// there's no backend to mint real signed tokens, but insecure for production use.
export default function StreamCallOverlay({ open, localUser, onClose }) {
  const [client, setClient] = useState(null)
  const [call, setCall] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open) return undefined

    if (!isStreamConfigured()) {
      setError('Video calling isn’t set up yet. Add your GetStream API key and developer tokens to .env (see .env.example).')
      return undefined
    }

    let cancelled = false
    setError('')

    const videoClient = new StreamVideoClient({
      apiKey: STREAM_API_KEY,
      user: { id: localUser.id, name: localUser.name },
      token: localUser.token,
    })

    const streamCall = videoClient.call(STREAM_CALL_TYPE, STREAM_CALL_ID)
    streamCall.join({ create: true })
      .then(() => {
        if (cancelled) return
        setClient(videoClient)
        setCall(streamCall)
      })
      .catch((err) => {
        if (!cancelled) setError(err?.message || 'Could not connect to the call.')
      })

    return () => {
      cancelled = true
      streamCall.leave().catch(() => {})
      videoClient.disconnectUser().catch(() => {})
      setClient(null)
      setCall(null)
    }
  }, [open, localUser])

  if (!open) return null

  return (
    <div className="stream-call-overlay">
      <button className="stream-call-close" onClick={onClose} aria-label="Close call">
        <XIcon />
      </button>

      {error ? (
        <div className="stream-call-message">
          <p>{error}</p>
          <button className="stream-call-close-btn" onClick={onClose}>Close</button>
        </div>
      ) : !call ? (
        <div className="stream-call-message">Connecting…</div>
      ) : (
        <StreamVideo client={client}>
          <StreamCall call={call}>
            <div className="stream-call-body">
              <SpeakerLayout />
              <CallControls onLeave={onClose} />
            </div>
          </StreamCall>
        </StreamVideo>
      )}
    </div>
  )
}
