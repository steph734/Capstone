import { PhoneOff } from 'lucide-react'

export default function CallEndedView({ title, detail }) {
  return (
    <div className="cl-overlay"><div className="cl-window cl-ended">
      <PhoneOff size={34} aria-hidden="true" />
      <h2>{title}</h2>
      {detail && <p>{detail}</p>}
    </div></div>
  )
}
