import { Mail } from 'lucide-react'
import { useEffect, useState } from 'react'
import { authFetch } from '../../utils/session'
import ModalShell from './ModalShell'

const stamp = (d) => (d ? new Date(d).toLocaleString('en-US', { timeZone: 'Asia/Manila', month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }) : '')

// A read-only copy of an email that was sent for an appointment (subject + plain-text body; never rendered as HTML).
export default function ViewEmailModal({ item, onClose }) {
  const [email, setEmail] = useState(null)
  const [error, setError] = useState('')
  useEffect(() => {
    let live = true
    authFetch(`/api/appointments/${item.id}/emails`)
      .then((b) => { if (live) setEmail((b.emails || []).find((e) => e.id === item.email?.id) || b.emails?.[0] || null) })
      .catch((e) => { if (live) setError(e.message || 'Could not load the email.') })
    return () => { live = false }
  }, [item])

  return (
    <ModalShell labelledBy="vem-title" onClose={onClose} size="md">
      <h2 id="vem-title" className="m-0 flex items-center gap-2 text-xl font-extrabold text-[#111827]"><Mail size={20} aria-hidden="true" /> Email sent to the guardian</h2>
      <p className="m-0 mt-1 text-[13px] text-[#5B7469]">{item.patientName} · {item.sessionLabel}</p>
      {error && <p role="alert" className="mt-4 rounded-xl bg-[#FFF1F1] px-3 py-2.5 text-sm font-semibold text-[#B42318]">{error}</p>}
      {!email && !error && <p className="mt-4 text-sm text-[#5B7469]">Loading…</p>}
      {email && (
        <div className="mt-4 rounded-2xl border border-solid border-[#E3EDE8] bg-[#F7FAF8] p-4">
          <p className="m-0 text-xs text-[#5B7469]">{email.status === 'sent' ? `Sent ${stamp(email.sentAt)}` : email.status === 'failed' ? 'Not sent' : 'Waiting to be sent'}</p>
          <p className="m-0 mt-1 text-[15px] font-extrabold">{email.subject}</p>
          <pre className="m-0 mt-3 whitespace-pre-wrap break-words font-[Inter,system-ui,sans-serif] text-[13px] leading-relaxed text-[#1E3A31]">{email.text}</pre>
        </div>
      )}
      <div className="mt-5 flex justify-end">
        <button type="button" data-autofocus onClick={onClose} className="min-h-[44px] rounded-xl border border-solid border-[#D6E3DC] bg-white px-6 text-sm font-bold hover:bg-[#F6FAF8] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#16A34A]/50">Close</button>
      </div>
    </ModalShell>
  )
}
