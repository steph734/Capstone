import { Check, Mail, RotateCw, X } from 'lucide-react'

const stamp = (d) => (d ? new Date(d).toLocaleString('en-US', { timeZone: 'Asia/Manila', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : '')

// "Recently handled": the last requests this therapist accepted or declined, with the status of the email that went out.
// A failed email shows a warning and a "Resend email" action; "View email" opens a read-only copy of what was sent.
export default function RecentlyHandledCard({ items, resendingId, onViewEmail, onResend }) {
  if (!items.length) return null
  return (
    <section aria-label="Recently handled" className="mb-6 rounded-3xl border border-solid border-[#E3EDE8] bg-white p-4 shadow-sm sm:p-5">
      <h3 className="m-0 mb-3 text-lg font-extrabold text-[#1E3A31]">Recently handled</h3>
      <ul className="m-0 list-none space-y-3 p-0">
        {items.map((it) => {
          const accepted = it.outcome === 'accepted'
          const failed = it.email?.status === 'failed'
          return (
            <li key={it.id} className="rounded-2xl border border-solid border-[#EEF4F1] p-3.5">
              <div className="flex flex-wrap items-center gap-3">
                <div className="min-w-[180px] flex-1">
                  <p className="m-0 text-[15px] font-extrabold text-[#1E3A31]">{it.patientName}</p>
                  <p className="m-0 text-[13px] text-[#5B7469]">{it.sessionLabel}</p>
                </div>
                <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-extrabold ${accepted ? 'bg-[#E7F7EC] text-[#15803D]' : 'bg-[#FFECEC] text-[#B42318]'}`}>
                  {accepted ? <Check size={13} strokeWidth={3.5} aria-hidden="true" /> : <X size={13} strokeWidth={3.5} aria-hidden="true" />} {accepted ? 'Accepted' : 'Declined'}
                </span>
              </div>
              {!accepted && it.reasonLabel && (
                <p className="m-0 mt-2 text-[13px] text-[#4B5F56]"><strong>Reason:</strong> {it.reasonLabel}{it.message ? ` — “${it.message}”` : ''}</p>
              )}
              <div className={`mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl px-3 py-2 text-[13px] ${failed ? 'bg-[#FFF3DF] text-[#7A4A06]' : 'bg-[#F3F7F5] text-[#2E5E4E]'}`}>
                <Mail size={14} aria-hidden="true" />
                {!it.email ? <span>No email was sent.</span>
                  : failed ? <span className="font-bold">The email couldn&apos;t be sent.</span>
                  : <span>{it.email.status === 'sent' ? `Email sent ${stamp(it.email.sentAt || it.handledAt)}` : 'Email is on its way'}</span>}
                {it.email && (
                  <span className="ml-auto flex items-center gap-3">
                    {failed && (
                      <button type="button" disabled={resendingId === it.email.id} onClick={() => onResend(it)} className="inline-flex items-center gap-1 border-0 border-solid bg-transparent p-0 text-[13px] font-extrabold text-[#B45309] underline disabled:opacity-60">
                        <RotateCw size={12} className={resendingId === it.email.id ? 'animate-spin motion-reduce:animate-none' : ''} aria-hidden="true" /> {resendingId === it.email.id ? 'Sending…' : 'Resend email'}
                      </button>
                    )}
                    <button type="button" onClick={() => onViewEmail(it)} className="border-0 border-solid bg-transparent p-0 text-[13px] font-extrabold text-[#2E5E4E] underline">View email</button>
                  </span>
                )}
              </div>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
