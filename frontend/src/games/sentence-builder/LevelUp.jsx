import { Sparkles } from 'lucide-react'

export default function LevelUp({ text }) {
  return (
    <div className="sb-levelup" role="status" aria-live="polite">
      <div className="sb-levelup-box"><Sparkles size={34} aria-hidden="true" /><strong>{text}</strong></div>
    </div>
  )
}
