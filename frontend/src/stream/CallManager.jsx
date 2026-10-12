import { useCalls, CallingState, useCallStateHooks, StreamCall, SpeakerLayout, CallControls } from '@stream-io/video-react-sdk'

function RingingCall({ call }) {
  const { useCallCallingState, useCallMembers, useLocalParticipant } = useCallStateHooks()
  return (
    <StreamCall call={call}>
      <RingingBody state={useCallCallingState()} members={useCallMembers()} localParticipant={useLocalParticipant()} call={call} />
    </StreamCall>
  )
}

function RingingBody({ state, members, localParticipant, call }) {
  if (state === CallingState.JOINED) {
    const audioOnly = call.state.custom?.audioOnly
    return (
      <div className="tp-call-overlay tp-call-active">
        <div className="tp-call-active-body">
          <SpeakerLayout />
          {audioOnly && <div className="tp-call-audio-note">Voice call — camera is off</div>}
          <CallControls onLeave={() => call.leave()} />
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
            <button className="tp-call-btn tp-call-decline" onClick={() => call.leave({ reject: true, reason: 'decline' })}>Decline</button>
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
            <button className="tp-call-btn tp-call-decline" onClick={() => call.leave({ reject: true, reason: 'cancel' })}>Cancel</button>
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
