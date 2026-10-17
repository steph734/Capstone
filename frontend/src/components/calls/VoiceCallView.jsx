import { useState } from 'react'
import { Ellipsis, Mic, MicOff, MessageSquare, Minimize2, PhoneOff, ScreenShare, Signal, Video, Volume2 } from 'lucide-react'
import { ParticipantView } from '@stream-io/video-react-sdk'
import { Avatar, CtrlBtn, roleLine } from './CallControls'
import DeviceMenu from './DeviceMenu'

export default function VoiceCallView({ m }) {
  const [menu, setMenu] = useState(null)
  const { other, remote, timer, quality, speaking, muted } = m
  const toggle = (k) => setMenu((x) => (x === k ? null : k))
  return (
    <div className="cl-voice">
      <div className="cl-top">
        <span className="cl-pill"><i className="cl-dot" /> Connected · {timer}</span>
        <span className="cl-pill soft"><Signal size={14} aria-hidden="true" /> {quality.label} connection</span>
        <span className="cl-spacer" />
        <button type="button" className="cl-icon-btn" onClick={m.minimize} aria-label="Minimize call" title="Minimize (Esc)"><Minimize2 size={18} /></button>
      </div>
      {m.reconnecting && <span className="cl-reconnect">Reconnecting…</span>}
      {remote && <div hidden><ParticipantView participant={remote} ParticipantViewUI={null} /></div>}
      <div className="cl-center-view cl-voice-center">
        <Avatar user={other} rings pulsing={speaking}>
          {speaking && <span className="cl-speaker-badge"><Volume2 size={16} aria-hidden="true" /></span>}
        </Avatar>
        <h2 className="cl-name">{other?.name || ''}</h2>
        <p className="cl-role">{roleLine(other)}</p>
        <div className={`cl-wave${speaking ? ' on' : ''}`} aria-hidden="true">{Array.from({ length: 9 }, (_, i) => <i key={i} style={{ '--i': i }} />)}</div>
        <p className="cl-speaking" aria-live="polite">{speaking ? 'Speaking…' : ' '}</p>
        {muted && <p className="cl-muted"><MicOff size={14} aria-hidden="true" /> You&apos;re muted</p>}
      </div>
      <div className={`cl-controls${m.isMobile ? ' grid' : ''}`}>
        <CtrlBtn icon={muted ? MicOff : Mic} label={muted ? 'Unmute' : 'Mute'} off={muted} onClick={m.toggleMic} />
        {m.speakerSupported && <CtrlBtn icon={Volume2} label="Speaker" active={menu === 'speaker'} onClick={() => toggle('speaker')} />}
        <CtrlBtn icon={Video} label={m.isMobile ? 'Video' : 'Turn on video'} onClick={m.turnOnVideo} />
        <CtrlBtn icon={MessageSquare} label="Chat" onClick={m.openChat} disabled={!m.channelId} />
        {m.isMobile && <CtrlBtn icon={Ellipsis} label="More" active={menu === 'more'} onClick={() => toggle('more')} />}
        {m.isMobile && m.canShare && <CtrlBtn icon={ScreenShare} label="Share" onClick={m.toggleShare} />}
        {!m.isMobile && <CtrlBtn icon={PhoneOff} label="End" danger onClick={m.end} />}
        {m.isMobile && <div className="cl-end-row"><CtrlBtn icon={PhoneOff} label="End" danger big showLabel={false} onClick={m.end} /></div>}
        {menu && <DeviceMenu media={m} only={menu === 'speaker' ? 'speaker' : undefined} onClose={() => setMenu(null)} />}
      </div>
    </div>
  )
}
