import { PhoneOff } from 'lucide-react'
import { Avatar, CtrlBtn, roleLine } from './CallControls'

export default function OutgoingCallView({ other, video, onCancel }) {
  return (
    <div className="cl-center-view">
      <p className="cl-kicker">{video ? 'Video call' : 'Voice call'}</p>
      <Avatar user={other} rings pulsing />
      <h2 className="cl-name">Calling {other?.name || ''}…</h2>
      <p className="cl-role">{roleLine(other)}</p>
      <div className="cl-actions"><CtrlBtn icon={PhoneOff} label="Cancel" danger big onClick={onCancel} /></div>
    </div>
  )
}
