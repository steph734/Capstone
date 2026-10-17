import { useRef, useState } from 'react'
import { CameraOff, Ellipsis, Mic, MicOff, MessageSquare, Minimize2, PhoneOff, RefreshCw, ScreenShare, Signal, Video, VideoOff } from 'lucide-react'
import { ParticipantView } from '@stream-io/video-react-sdk'
import { Avatar, CtrlBtn, roleLine } from './CallControls'
import DeviceMenu from './DeviceMenu'

// Self view: draggable on desktop, snaps to the nearest corner of the call window.
function SelfView({ participant, muted, boundsRef, isMobile }) {
  const [corner, setCorner] = useState('tr')
  const [drag, setDrag] = useState(null)
  const start = useRef(null)
  const onDown = (e) => {
    if (isMobile) return
    const r = e.currentTarget.getBoundingClientRect()
    start.current = { dx: e.clientX - r.left, dy: e.clientY - r.top, w: r.width, h: r.height }
    e.currentTarget.setPointerCapture(e.pointerId)
  }
  const onMove = (e) => {
    if (!start.current) return
    const b = boundsRef.current.getBoundingClientRect()
    setDrag({ x: e.clientX - b.left - start.current.dx, y: e.clientY - b.top - start.current.dy })
  }
  const onUp = (e) => {
    if (!start.current) return
    const b = boundsRef.current.getBoundingClientRect()
    const cx = e.clientX - b.left - start.current.dx + start.current.w / 2
    const cy = e.clientY - b.top - start.current.dy + start.current.h / 2
    setCorner(`${cy < b.height / 2 ? 't' : 'b'}${cx < b.width / 2 ? 'l' : 'r'}`)
    start.current = null
    setDrag(null)
  }
  return (
    <div className={`cl-self ${corner}${drag ? ' dragging' : ''}`} style={drag ? { left: drag.x, top: drag.y, right: 'auto', bottom: 'auto' } : undefined}
      onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} aria-label="Your video">
      {participant && <ParticipantView participant={participant} ParticipantViewUI={null} VideoPlaceholder={() => <div className="cl-self-off"><CameraOff size={22} aria-hidden="true" /></div>} />}
      <span className="cl-self-label">You</span>
      <span className="cl-self-mic">{muted ? <MicOff size={13} aria-label="Muted" /> : <Mic size={13} aria-label="Mic on" />}</span>
    </div>
  )
}

export default function VideoCallView({ m }) {
  const [menu, setMenu] = useState(false)
  const boundsRef = useRef(null)
  const { other, remote, local, timer, quality, muted, camOff } = m
  const remoteMuted = remote ? !remote.publishedTracks?.includes(1) : false // 1 = audio track
  const RemoteOff = () => (
    <div className="cl-remote-off"><Avatar user={other} size={120} /><p><CameraOff size={15} aria-hidden="true" /> Camera is off</p></div>
  )
  return (
    <div className="cl-video" ref={boundsRef}>
      <div className="cl-remote">
        {remote ? <ParticipantView participant={remote} ParticipantViewUI={null} VideoPlaceholder={RemoteOff} /> : <RemoteOff />}
      </div>
      <div className="cl-video-top">
        <div className="cl-who">
          <Avatar user={other} size={38} />
          <div><strong>{other?.name}</strong><small>{m.isMobile ? timer : roleLine(other)}</small></div>
        </div>
        <span className="cl-spacer" />
        {!m.isMobile && <>
          <span className="cl-pill"><i className="cl-dot" /> {timer}</span>
          <span className="cl-pill soft"><Signal size={14} aria-hidden="true" /> {quality.hd ? 'HD' : 'SD'}</span>
        </>}
        <button type="button" className="cl-icon-btn" onClick={m.minimize} aria-label="Minimize call" title="Minimize (Esc)"><Minimize2 size={18} /></button>
      </div>
      <SelfView participant={local} muted={muted} boundsRef={boundsRef} isMobile={m.isMobile} />
      <span className="cl-nametag">{remoteMuted ? <MicOff size={14} aria-label="Muted" /> : <Mic size={14} aria-label="Mic on" />} {other?.name}</span>
      {m.reconnecting && <span className="cl-reconnect">Reconnecting…</span>}
      <div className={`cl-controls video${m.isMobile ? ' bar' : ''}`}>
        <CtrlBtn icon={muted ? MicOff : Mic} label={muted ? 'Unmute' : 'Mute'} off={muted} showLabel={!m.isMobile} onClick={m.toggleMic} />
        <CtrlBtn icon={camOff ? VideoOff : Video} label="Camera" off={camOff} showLabel={!m.isMobile} onClick={m.toggleCamera} />
        {!m.isMobile && m.canShare && <CtrlBtn icon={ScreenShare} label="Share screen" active={m.sharing} onClick={m.toggleShare} />}
        <CtrlBtn icon={MessageSquare} label="Chat" showLabel={!m.isMobile} onClick={m.openChat} disabled={!m.channelId} />
        {m.isMobile && m.canFlip && <CtrlBtn icon={RefreshCw} label="Flip camera" showLabel={false} onClick={m.flipCamera} />}
        {!m.isMobile && <CtrlBtn icon={Ellipsis} label="More" active={menu} onClick={() => setMenu((x) => !x)} />}
        <CtrlBtn icon={PhoneOff} label="End" danger showLabel={!m.isMobile} onClick={m.end} />
        {menu && <DeviceMenu media={m} onClose={() => setMenu(false)} />}
      </div>
    </div>
  )
}
