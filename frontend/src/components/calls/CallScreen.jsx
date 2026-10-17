import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { LoaderCircle, MicOff, Phone, Maximize2, PhoneOff } from 'lucide-react'
import { CallingState, SfuModels, useCallStateHooks, ParticipantView } from '@stream-io/video-react-sdk'
import VoiceCallView from './VoiceCallView'
import VideoCallView from './VideoCallView'
import IncomingCallView from './IncomingCallView'
import OutgoingCallView from './OutgoingCallView'
import { Avatar } from './CallControls'
import useCallTimer from './useCallTimer'
import { logCall } from './callLog'
import './calls.css'

const RING_TIMEOUT_MS = 45000
const hasVideo = (p) => Boolean(p?.publishedTracks?.includes(SfuModels.TrackType.VIDEO))
const useIsMobile = () => {
  const q = '(max-width: 767px)'
  const [m, setM] = useState(() => window.matchMedia(q).matches)
  useEffect(() => {
    const mq = window.matchMedia(q)
    const on = () => setM(mq.matches)
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [])
  return m
}

function qualityOf(p) {
  const q = p?.connectionQuality
  if (q === SfuModels.ConnectionQuality.POOR) return { label: 'Poor', hd: false }
  if (q === SfuModels.ConnectionQuality.UNSPECIFIED || q == null) return { label: 'Fair', hd: false }
  return { label: 'Good', hd: true }
}

// Mini window (desktop): drag anywhere, tap the expand button to restore.
function MiniWindow({ m }) {
  const [pos, setPos] = useState({ x: window.innerWidth - 300, y: window.innerHeight - 200 })
  const drag = useRef(null)
  const down = (e) => { if (e.target.closest('button')) return; drag.current = { dx: e.clientX - pos.x, dy: e.clientY - pos.y }; e.currentTarget.setPointerCapture(e.pointerId) }
  const move = (e) => {
    if (!drag.current) return
    setPos({ x: Math.min(window.innerWidth - 280, Math.max(0, e.clientX - drag.current.dx)), y: Math.min(window.innerHeight - 180, Math.max(0, e.clientY - drag.current.dy)) })
  }
  return (
    <div className="cl-mini" style={{ left: pos.x, top: pos.y }} onPointerDown={down} onPointerMove={move} onPointerUp={() => { drag.current = null }} role="dialog" aria-label="Call in progress">
      {m.videoMode && m.remote && hasVideo(m.remote) ? <div className="cl-mini-video"><ParticipantView participant={m.remote} ParticipantViewUI={null} /></div> : (
        <div className="cl-mini-avatar"><Avatar user={m.other} size={64} /></div>
      )}
      {!m.videoMode && m.remote && <div hidden><ParticipantView participant={m.remote} ParticipantViewUI={null} /></div>}
      <div className="cl-mini-bar">
        <span className="cl-mini-name"><i className="cl-dot" /> {m.other?.name} · {m.timer}</span>
        <button type="button" className="cl-icon-btn sm" onClick={m.toggleMic} aria-label={m.muted ? 'Unmute' : 'Mute'}>{m.muted ? <MicOff size={15} /> : <Phone size={15} />}</button>
        <button type="button" className="cl-icon-btn sm" onClick={m.restore} aria-label="Restore call"><Maximize2 size={15} /></button>
        <button type="button" className="cl-icon-btn sm end" onClick={m.end} aria-label="End call"><PhoneOff size={15} /></button>
      </div>
    </div>
  )
}

// Rendered inside <StreamCall>. Picks the view from the call state and owns every call action.
export default function CallScreen({ call, report, openChat }) {
  const {
    useCallCallingState, useMicrophoneState, useCameraState, useSpeakerState, useScreenShareState,
    useParticipants, useLocalParticipant, useRemoteParticipants, useCallMembers,
  } = useCallStateHooks()
  const state = useCallCallingState()
  const mic = useMicrophoneState()
  const cam = useCameraState()
  const spk = useSpeakerState()
  const share = useScreenShareState()
  const members = useCallMembers()
  const local = useLocalParticipant()
  const remotes = useRemoteParticipants()
  useParticipants()
  const isMobile = useIsMobile()
  const [minimized, setMinimized] = useState(false)
  const [error, setError] = useState('')
  const [leftNote, setLeftNote] = useState('')
  const startedAt = useRef(0)
  const everRemote = useRef(false)
  const channelId = call.state.custom?.channelId || ''
  const isMine = Boolean(call.isCreatedByMe)
  const other = useMemo(() => {
    const me = call.currentUserId
    return members.find((x) => x.user_id !== me && x.user?.id !== me)?.user || members.find((x) => x.user?.id !== call.state.createdBy?.id)?.user || members[0]?.user
  }, [members, call])
  const remote = remotes[0]
  const joined = state === CallingState.JOINED
  const reconnecting = state === CallingState.RECONNECTING || state === CallingState.MIGRATING || state === CallingState.OFFLINE
  const audioOnlyCall = Boolean(call.state.custom?.audioOnly)
  const ringingVideo = !audioOnlyCall

  if (joined && !startedAt.current) startedAt.current = Date.now()
  if (remote) everRemote.current = true
  const timer = useCallTimer(joined ? startedAt.current : 0)

  // Keep the manager informed (it logs the call and shows the "ended" screen).
  useEffect(() => {
    report({ callId: call.id, name: other?.name || '', isMine, joined, startedAt: startedAt.current, video: !audioOnlyCall, channelId, seconds: timer.seconds })
  })

  // The caller writes the call log; the first 'ongoing' marks the moment the call was answered.
  useEffect(() => { if (joined && isMine) logCall('ongoing', call.id) }, [joined, isMine, call.id])

  const localReason = useCallback((reason) => report({ reason }), [report])

  const end = useCallback((reason = 'completed') => {
    localReason(reason)
    if (state === CallingState.RINGING) call.leave({ reject: true, reason: reason === 'cancelled' ? 'cancel' : 'decline' }).catch(() => {})
    else call.leave().catch(() => {})
  }, [call, state, localReason])

  const accept = useCallback(async (withVideo) => {
    setError('')
    try {
      if (!withVideo || audioOnlyCall) await call.camera.disable()
      await call.join()
    } catch (e) {
      setError(e?.name === 'NotFoundError' ? 'device' : 'permission')
    }
  }, [call, audioOnlyCall])

  // Ring timeout: 45s without an answer is a missed call (both sides stop ringing).
  useEffect(() => {
    if (state !== CallingState.RINGING) return undefined
    const t = setTimeout(() => end('missed'), RING_TIMEOUT_MS)
    return () => clearTimeout(t)
  }, [state, end])

  // The other person left a call that was already connected: say so, then leave too.
  useEffect(() => {
    if (!joined || remote || !everRemote.current) return undefined
    setLeftNote(`${other?.name || 'The other person'} left the call`)
    const t = setTimeout(() => end('completed'), 2500)
    return () => clearTimeout(t)
  }, [joined, remote, other, end])
  useEffect(() => { if (remote) setLeftNote('') }, [remote])

  // Mic/camera permission problems while connected.
  const videoMode = joined && (hasVideo(remote) || cam.camera.state.status === 'enabled' || !cam.isMute)
  useEffect(() => {
    if (!joined) return
    if (mic.hasBrowserPermission === false) setError('permission')
    else if (videoMode && cam.hasBrowserPermission === false) setError('permission')
  }, [joined, mic.hasBrowserPermission, cam.hasBrowserPermission, videoMode])

  const turnOnVideo = async () => { try { await call.camera.enable() } catch { setError('permission') } }
  const toggleCamera = async () => { try { await call.camera.toggle() } catch { setError('permission') } }
  const toggleShare = async () => { try { await share.screenShare.toggle() } catch { /* cancelled by the user */ } }

  // Keyboard: M = mute, V = camera, Esc = minimise (never ends the call).
  useEffect(() => {
    if (!joined) return undefined
    const onKey = (e) => {
      if (e.target.closest?.('input, textarea, select, [contenteditable]') || e.ctrlKey || e.metaKey || e.altKey) return
      const k = e.key.toLowerCase()
      if (k === 'm') call.microphone.toggle().catch(() => {})
      else if (k === 'v') call.camera.toggle().catch(() => {})
      else if (e.key === 'Escape' && !isMobile) setMinimized(true)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [joined, call, isMobile])

  // Leave and release devices if the page is closed mid-call.
  useEffect(() => {
    const bye = () => { try { call.leave() } catch { /* ignore */ } }
    window.addEventListener('pagehide', bye)
    return () => window.removeEventListener('pagehide', bye)
  }, [call])

  const media = {
    isMobile, other, remote, local, timer: timer.label, quality: qualityOf(remote), speaking: Boolean(remote?.isSpeaking),
    muted: mic.isMute, camOff: cam.isMute, videoMode, reconnecting, channelId, sharing: !share.isMute,
    canShare: !isMobile && Boolean(navigator.mediaDevices?.getDisplayMedia),
    canFlip: isMobile && (cam.devices?.length || 0) > 1,
    microphone: call.microphone, camera: call.camera, speaker: call.speaker,
    micDevices: mic.devices, micSelected: mic.selectedDevice, camDevices: cam.devices, camSelected: cam.selectedDevice,
    speakerDevices: spk.devices, speakerSelected: spk.selectedDevice, speakerSupported: Boolean(spk.isDeviceSelectionSupported),
    toggleMic: () => call.microphone.toggle().catch(() => setError('permission')),
    toggleCamera, turnOnVideo, toggleShare, flipCamera: () => call.camera.flip().catch(() => {}),
    openChat: () => { setMinimized(true); openChat(channelId) },
    minimize: () => setMinimized(true), restore: () => setMinimized(false), end: () => end('completed'),
  }

  if (error) {
    return (
      <div className="cl-overlay"><div className="cl-window cl-error">
        <MicOff size={34} aria-hidden="true" />
        <h2>{error === 'device' ? 'No microphone or camera found' : 'Allow microphone access'}</h2>
        <p>TherapyPro needs your microphone{ringingVideo ? ' (and camera)' : ''} to call. Allow it in your browser settings.</p>
        <div className="cl-actions-row">
          <button type="button" className="cl-text-btn" onClick={() => { setError(''); if (state === CallingState.RINGING && !isMine) end('declined') }}>Cancel</button>
          <button type="button" className="cl-text-btn primary" onClick={() => { setError(''); if (!joined && !isMine) accept(ringingVideo); else call.microphone.enable().catch(() => setError('permission')) }}>Try again</button>
        </div>
      </div></div>
    )
  }

  if (state === CallingState.RINGING) {
    const body = isMine
      ? <OutgoingCallView other={other} video={ringingVideo} onCancel={() => end('cancelled')} />
      : <IncomingCallView other={other} video={ringingVideo} onAccept={() => accept(true)} onAcceptVoice={() => accept(false)} onDecline={() => end('declined')}
        onMessage={() => { openChat(channelId); end('declined') }} />
    return <div className={`cl-overlay${isMobile ? ' mobile' : ''}`}><div className="cl-window">{body}</div></div>
  }

  if (!joined && !reconnecting) {
    return <div className="cl-overlay"><div className="cl-window cl-error"><LoaderCircle className="cl-spin" size={34} aria-hidden="true" /><h2>Connecting…</h2></div></div>
  }

  if (minimized && !isMobile) return <MiniWindow m={media} />
  if (minimized && isMobile) return <MiniWindow m={media} />

  return (
    <div className={`cl-overlay${isMobile ? ' mobile' : ''}`}>
      <div className="cl-window" role="dialog" aria-label="Call">
        {videoMode ? <VideoCallView m={media} /> : <VoiceCallView m={media} />}
        {leftNote && <div className="cl-left-note" role="status">{leftNote}</div>}
      </div>
    </div>
  )
}
