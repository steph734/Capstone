import { Clock } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { authFetch } from '../../utils/session'
import RequestReviewCard from './RequestReviewCard'
import RecentlyHandledCard from './RecentlyHandledCard'
import ConfirmPaymentModal from './ConfirmPaymentModal'
import PaymentNotReceivedModal from './PaymentNotReceivedModal'
import PaymentConfirmedModal from './PaymentConfirmedModal'
import AcceptModal from './AcceptModal'
import DeclineModal from './DeclineModal'
import ViewEmailModal from './ViewEmailModal'

// "Requests to review" on the therapist's Appointments page: the request cards, the five review modals, and "Recently handled".
// Flow: check the payment (Payment received -> confirm -> "Payment confirmed" -> step 2) or "Payment not received" (ask for new proof
// or decline), then Accept or Decline. Every action asks the SERVER (which re-checks everything); this only reflects the answer.
//
// The list refreshes without a reload: when the tab regains focus and every minute (a guardian may have sent new proof).
const post = (path, body) => authFetch(path, { method: 'POST', body: body || {} })

export default function RequestsSection({ therapistName, showToast, onChanged, onCount }) {
  const [data, setData] = useState(null) // { requests, recent }
  const [loadError, setLoadError] = useState('')
  const [modal, setModal] = useState(null) // { type, id } | { type: 'email', item }
  const [resendingId, setResendingId] = useState('')
  const alive = useRef(true)
  useEffect(() => { alive.current = true; return () => { alive.current = false } }, [])

  const load = useCallback(async () => {
    try {
      const d = await authFetch('/api/therapist/requests')
      if (alive.current) { setData(d); setLoadError('') }
    } catch (e) { if (alive.current) setLoadError(e.message || 'Could not load your requests.') }
  }, [])
  useEffect(() => {
    load()
    const onFocus = () => { if (document.visibilityState === 'visible') load() }
    window.addEventListener('focus', onFocus)
    document.addEventListener('visibilitychange', onFocus)
    const t = setInterval(load, 60000)
    return () => { window.removeEventListener('focus', onFocus); document.removeEventListener('visibilitychange', onFocus); clearInterval(t) }
  }, [load])

  const requests = data?.requests || []
  const recent = data?.recent || []
  useEffect(() => { if (data) onCount?.(requests.length) }, [data, requests.length, onCount])

  const open = modal && modal.id ? requests.find((r) => r.id === modal.id) : null
  const close = () => setModal(null)
  const patch = (id, fn) => setData((d) => ({ ...d, requests: d.requests.map((r) => (r.id === id ? fn(r) : r)) }))

  /* ── step 1: payment received ── */
  const verify = async () => {
    await post(`/api/appointments/${open.id}/payment/verify`, { checks: { amountSeen: true, referenceMatches: true } })
    patch(open.id, (r) => ({ ...r, phase: 'decide', payment: { ...r.payment, state: 'verified' } }))
    setModal({ type: 'confirmed', id: open.id })
  }

  /* ── step 1: payment NOT received ── */
  const reject = async (values) => {
    const out = await post(`/api/appointments/${open.id}/payment/reject`, values)
    close()
    showToast(out.nextAction === 'decline_request'
      ? (out.warning ? "Request declined, but the email couldn't be sent. You can resend it." : 'Request declined · Email sent to the guardian.')
      : (out.warning ? "Asked for new proof, but the email couldn't be sent." : 'Asked for new proof · Email sent to the guardian.'))
    await load(); onChanged?.()
  }

  /* ── step 2 ── */
  const accept = async () => {
    const out = await post(`/api/appointments/${open.id}/accept`)
    close()
    showToast(out.warning ? "Appointment accepted, but the email couldn't be sent. You can resend it." : 'Appointment accepted · Email sent to the guardian.')
    await load(); onChanged?.()
  }
  const decline = async (values) => {
    const out = await post(`/api/appointments/${open.id}/decline`, values)
    close()
    showToast(out.warning ? "Appointment declined, but the email couldn't be sent. You can resend it." : 'Appointment declined · Email sent to the guardian.')
    await load(); onChanged?.()
  }

  const resend = async (item) => {
    setResendingId(item.email.id)
    try {
      const out = await post(`/api/appointments/${item.id}/emails/resend`, { emailId: item.email.id })
      showToast(out.warning ? "The email still couldn't be sent." : 'Email sent to the guardian.')
      await load()
    } catch (e) { showToast(e.message || 'Could not resend the email.') } finally { setResendingId('') }
  }

  return (
    <section aria-label="Requests to review" className="mb-6">
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <h2 className="m-0 text-[22px] font-extrabold text-[#1E3A31]">Requests to review</h2>
        {requests.length > 0 && <span className="inline-flex items-center gap-1.5 rounded-full border border-[#FFE3A8] bg-[#FFF3DF] px-3 py-1 text-xs font-extrabold text-[#7A4A06]"><Clock size={13} aria-hidden="true" /> {requests.length} need{requests.length === 1 ? 's' : ''} your response</span>}
      </div>

      {loadError && !data && <p role="alert" className="rounded-xl bg-[#FFF1F1] px-3 py-2.5 text-sm font-semibold text-[#B42318]">{loadError} <button type="button" onClick={load} className="border-0 bg-transparent p-0 font-extrabold underline">Try again</button></p>}

      {requests.map((r) => (
        <RequestReviewCard
          key={r.id} request={r}
          onPaymentReceived={(x) => setModal({ type: 'confirmPayment', id: x.id })}
          onNotReceived={(x) => setModal({ type: 'notReceived', id: x.id })}
          onAccept={(x) => setModal({ type: 'accept', id: x.id })}
          onDecline={(x) => setModal({ type: 'decline', id: x.id })}
        />
      ))}

      {data && requests.length === 0 && (
        <div className="mb-4 flex flex-col items-center rounded-3xl border border-[#E3EDE8] bg-white px-4 py-8 text-center shadow-sm">
          <img src="/pao/pao-game-poses/pao-game-thumbsup.png" alt="" onError={(e) => { e.currentTarget.style.display = 'none' }} className="h-24 w-auto" />
          <h3 className="m-0 mt-2 text-xl font-extrabold text-[#1E3A31]">All caught up!</h3>
          <p className="m-0 mt-1 text-sm text-[#5B7469]">No requests need your response right now.</p>
        </div>
      )}

      <RecentlyHandledCard items={recent} resendingId={resendingId} onResend={resend} onViewEmail={(item) => setModal({ type: 'email', item })} />

      {open && modal.type === 'confirmPayment' && <ConfirmPaymentModal request={open} onCancel={close} onConfirm={verify} />}
      {open && modal.type === 'notReceived' && <PaymentNotReceivedModal request={open} onCancel={close} onSubmit={reject} />}
      {open && modal.type === 'confirmed' && <PaymentConfirmedModal request={open} onLater={close} onAccept={() => setModal({ type: 'accept', id: open.id })} onDecline={() => setModal({ type: 'decline', id: open.id })} />}
      {open && modal.type === 'accept' && <AcceptModal request={open} onCancel={close} onConfirm={accept} />}
      {open && modal.type === 'decline' && <DeclineModal request={open} therapist={therapistName} onCancel={close} onConfirm={decline} />}
      {modal?.type === 'email' && <ViewEmailModal item={modal.item} onClose={close} />}
    </section>
  )
}
