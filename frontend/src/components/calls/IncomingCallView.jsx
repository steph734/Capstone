import { useEffect } from 'react'
import { MessageSquare, Phone, PhoneOff, Video } from 'lucide-react'
import { Avatar, CtrlBtn, roleLine } from './CallControls'

// Looped ringtone synthesised with WebAudio (no audio file needed); stops on unmount.
function useRingtone() {
  useEffect(() => {
    let ctx
    let timer
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext
      ctx = new Ctx()
      const burst = () => {
        const t = ctx.currentTime
        for (const [i, f] of [[0, 880], [0.25, 660]]) {
          const o = ctx.createOscillator(); const g = ctx.createGain()
          o.frequency.value = f; o.type = 'sine'
          g.gain.setValueAtTime(0.0001, t + i); g.gain.exponentialRampToValueAtTime(0.18, t + i + 0.03); g.gain.exponentialRampToValueAtTime(0.0001, t + i + 0.22)
          o.connect(g).connect(ctx.destination); o.start(t + i); o.stop(t + i + 0.25)
        }
      }
      ctx.resume?.().catch(() => {})
      burst(); timer = setInterval(burst, 2200)
    } catch { /* autoplay blocked: the screen still shows the call */ }
    return () => { clearInterval(timer); try { ctx?.close() } catch { /* ignore */ } }
  }, [])
}

export default function IncomingCallView({ other, video, onAccept, onAcceptVoice, onDecline, onMessage }) {
  useRingtone()
  return (
    <div className="cl-center-view">
      <p className="cl-kicker">{video ? <><Video size={16} aria-hidden="true" /> Incoming video call</> : <><Phone size={16} aria-hidden="true" /> Incoming voice call</>}</p>
      <Avatar user={other} rings pulsing />
      <h2 className="cl-name">{other?.name || 'Someone'}</h2>
      <p className="cl-role">{roleLine(other)}</p>
      <div className="cl-actions">
        <CtrlBtn icon={PhoneOff} label="Decline" danger big onClick={onDecline} />
        <CtrlBtn icon={MessageSquare} label="Message" big onClick={onMessage} />
        <CtrlBtn icon={video ? Video : Phone} label="Accept" big accept onClick={onAccept} />
      </div>
      {video && <button type="button" className="cl-link" onClick={onAcceptVoice}><Phone size={15} aria-hidden="true" /> Accept as voice only</button>}
    </div>
  )
}
