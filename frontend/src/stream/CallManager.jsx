import { useEffect, useRef } from 'react'
import { useCalls, CallingState, useCallStateHooks, StreamCall, SpeakerLayout, CallControls } from '@stream-io/video-react-sdk'

// Fire-and-forget mirror of a call-state change into `call_logs`. Never
// blocks the call UI — this is logging, not the source of truth (Stream is).
function logCall(action, streamCallId, extra) {
  fetch('/api/stream/call-log', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, streamCallId, ...extra }),
  }).catch(() => {})
}

function RingingCall({ call }) {
  return (
    <StreamCall call={call}>
      <RingingBody call={call} />
    </StreamCall>
  )
}

// Rendered inside <StreamCall>, so useCallStateHooks() here is correctly
// bound to the active call — calling it one level higher (outside StreamCall)
// returns hooks with no call context, which crashes deep inside the SDK's
// own components reading call.state.recordingState etc.
function RingingBody({ call }) {
  const { useCallCallingState, useCallMembers, useLocalParticipant } = useCallStateHooks()
  const state = useCallCallingState()
  const members = useCallMembers()
  const localParticipant = useLocalParticipant()
  const loggedOngoingRef = useRef(false)

  useEffect(() => {
    if (state === CallingState.JOINED && !loggedOngoingRef.current) {
      loggedOngoingRef.current = true
      logCall('ongoing', call.id)
    }
  }, [state, call])

  if (state === CallingState.JOINED) {
    const audioOnly = call.state.custom?.audioOnly
    return (
      <div className="tp-call-overlay tp-call-active">
        <div className="tp-call-active-body">
          <SpeakerLayout />
          {audioOnly && <div className="tp-call-audio-note">Voice call — camera is off</div>}
          <CallControls onLeave={() => { logCall('end', call.id, { status: 'completed' }); call.leave() }} />
        </div>
      </div>
    )
  }

  const isMine = localParticipant?.userId === call.state.createdBy?.id
  const other = members.find((m) => m.user?.id !== call.state.createdBy?.id)?.user || members[0]?.user
  const videoCall = !call.state.custom?.audioOnly

  if (state === CallingState.RINGING && !isMine) {
    // Incoming call.
    return (
      <div className="tp-call-overlay tp-call-ringing">
        <div className="tp-call-ringing-card">
          {other?.image ? <img className="tp-call-avatar" src={other.image} alt="" /> : <div className="tp-call-avatar tp-call-avatar-fallback">{(other?.name || '?')[0]}</div>}
          <h3>{other?.name || 'Someone'}</h3>
          <p>Incoming {videoCall ? 'video' : 'voice'} call…</p>
          <div className="tp-call-ringing-actions">
            <button className="tp-call-btn tp-call-decline" onClick={() => { logCall('end', call.id, { status: 'declined' }); call.leave({ reject: true, reason: 'decline' }) }}>Decline</button>
            <button className="tp-call-btn tp-call-accept" onClick={() => call.join()}>Accept</button>
          </div>
        </div>
      </div>
    )
  }

  if (state === CallingState.RINGING && isMine) {
    // Outgoing call.
    return (
      <div className="tp-call-overlay tp-call-ringing">
        <div className="tp-call-ringing-card">
          {other?.image ? <img className="tp-call-avatar" src={other.image} alt="" /> : <div className="tp-call-avatar tp-call-avatar-fallback">{(other?.name || '?')[0]}</div>}
          <h3>{other?.name || 'Calling…'}</h3>
          <p>Ringing…</p>
          <div className="tp-call-ringing-actions">
            <button className="tp-call-btn tp-call-decline" onClick={() => { logCall('end', call.id, { status: 'cancelled' }); call.leave({ reject: true, reason: 'cancel' }) }}>Cancel</button>
          </div>
        </div>
      </div>
    )
  }

  return null
}

// Rendered once, inside StreamVideo. useCalls() reports every ringing/active
// call this user is part of (incoming or outgoing) — in practice there's at
// most one at a time for this app.
export default function CallManager() {
  const calls = useCalls()
  const relevant = calls.filter((c) => c.state.callingState !== CallingState.LEFT && c.state.callingState !== CallingState.IDLE)
  if (!relevant.length) return null
  return <RingingCall call={relevant[0]} />
}
