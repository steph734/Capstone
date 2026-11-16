import { useCallback, useEffect, useRef, useState } from 'react'
import { CheckCircle2 } from 'lucide-react'
import { authFetch } from '../utils/session'
import PaymentsToVerifyCard from './payments/PaymentsToVerifyCard'
import ReceiptLightbox from './payments/ReceiptLightbox'
import useDialogA11y from './payments/useDialogA11y'

// "Payments to verify (N)" on the therapist's Appointments page. GCash / Maya payments cannot be checked automatically, so
// the therapist who received the booking checks their own wallet and presses "Mark as paid" or "Not received".
// Until then the patient's slot stays held and the booking is NOT confirmed.
//
// The list refreshes without a page reload: when the tab regains focus and every minute.
const peso = (n) => `₱${Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const REASONS = ["Amount didn't arrive", 'Wrong amount', 'Reference not found', 'Other']

function ConfirmPaid({ row, busy, onCancel, onConfirm }) {
  const ref = useDialogA11y({ onEscape: onCancel, locked: busy })
  return (
    <div className="fixed inset-0 z-[100000] flex items-center justify-center bg-slate-900/55 p-4" onMouseDown={() => !busy && onCancel()}>
      <div ref={ref} role="alertdialog" aria-modal="true" aria-labelledby="mp-title" tabIndex={-1} onMouseDown={(e) => e.stopPropagation()} className="w-full max-w-[420px] rounded-2xl bg-white p-6 text-slate-800 shadow-2xl outline-none [color-scheme:light]">
        <h2 id="mp-title" className="m-0 text-lg font-extrabold">Mark as paid?</h2>
        <p className="mt-2 text-sm text-slate-600">Mark {peso(row.amount)} from {row.patient || 'this patient'} as paid? The booking will be confirmed.</p>
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" disabled={busy} onClick={onCancel} className="min-h-[42px] rounded-lg border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50">Cancel</button>
          <button type="button" data-autofocus disabled={busy} onClick={onConfirm} className="min-h-[42px] rounded-lg bg-green-600 px-4 text-sm font-bold text-white hover:bg-green-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-green-400 disabled:opacity-50">{busy ? 'Saving…' : 'Mark as paid'}</button>
        </div>
      </div>
    </div>
  )
}

function RejectDialog({ row, busy, onCancel, onConfirm }) {
  const [choice, setChoice] = useState('')
  const [other, setOther] = useState('')
  const ref = useDialogA11y({ onEscape: onCancel, locked: busy })
  const reason = choice === 'Other' ? other.trim() : choice
  return (
    <div className="fixed inset-0 z-[100000] flex items-center justify-center bg-slate-900/55 p-4" onMouseDown={() => !busy && onCancel()}>
      <div ref={ref} role="dialog" aria-modal="true" aria-labelledby="nr-title" tabIndex={-1} onMouseDown={(e) => e.stopPropagation()} className="w-full max-w-[440px] rounded-2xl bg-white p-6 text-slate-800 shadow-2xl outline-none [color-scheme:light]">
        <h2 id="nr-title" className="m-0 text-lg font-extrabold">Payment not received</h2>
        <p className="mt-2 text-sm text-slate-600">{row.patient || 'The patient'} will be told, and can send new proof while the slot is still held. The reason is optional.</p>
        <fieldset className="m-0 mt-3 border-0 p-0">
          <legend className="sr-only">Reason</legend>
          {REASONS.map((r, i) => (
            <label key={r} className="flex min-h-[40px] cursor-pointer items-center gap-2 text-sm">
              <input type="radio" name="nr-reason" value={r} checked={choice === r} onChange={() => setChoice(choice === r ? '' : r)} data-autofocus={i === 0 ? true : undefined} className="h-4 w-4 accent-red-600" style={{ appearance: 'auto', width: 16, height: 16 }} />
              {r}
            </label>
          ))}
        </fieldset>
        {choice === 'Other' && <textarea aria-label="Other reason" rows={2} maxLength={200} value={other} onChange={(e) => setOther(e.target.value)} placeholder="Tell the patient what went wrong" className="mt-2 w-full rounded-lg border border-slate-300 bg-white p-2 text-sm text-slate-900" />}
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" disabled={busy} onClick={onCancel} className="min-h-[42px] rounded-lg border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50">Cancel</button>
          <button type="button" disabled={busy} onClick={() => onConfirm(reason)} className="min-h-[42px] rounded-lg bg-red-600 px-4 text-sm font-bold text-white hover:bg-red-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-300 disabled:opacity-50">{busy ? 'Saving…' : 'Mark not received'}</button>
        </div>
      </div>
    </div>
  )
}

export default function PaymentVerificationPanel({ onChanged }) {
  const [rows, setRows] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [zoom, setZoom] = useState(null) // { src, title }
  const [ask, setAsk] = useState(null) // { kind: 'paid' | 'reject', row }
  const [toast, setToast] = useState('')
  const alive = useRef(true)
  useEffect(() => { alive.current = true; return () => { alive.current = false } }, [])

  const load = useCallback(() => {
    authFetch('/api/therapist/payments', { query: { status: 'proof_submitted' } })
      .then((b) => { if (alive.current) setRows(b.payments || []) })
      .catch(() => { if (alive.current) setRows((r) => r || []) })
  }, [])
  useEffect(() => {
    load()
    const onFocus = () => { if (document.visibilityState === 'visible') load() }
    window.addEventListener('focus', onFocus)
    document.addEventListener('visibilitychange', onFocus)
    const t = setInterval(load, 60000)
    return () => { window.removeEventListener('focus', onFocus); document.removeEventListener('visibilitychange', onFocus); clearInterval(t) }
  }, [load])

  const flash = (msg) => { setToast(msg); setTimeout(() => alive.current && setToast(''), 3500) }

  const decide = async (kind, row, reason) => {
    setBusy(true); setError('')
    try {
      await authFetch(`/api/therapist/payments/${row.attemptId}/${kind === 'paid' ? 'verify' : 'reject'}`, { method: 'POST', body: kind === 'reject' ? { reason } : {} })
      setRows((r) => (r || []).filter((x) => x.attemptId !== row.attemptId))
      setAsk(null)
      flash(kind === 'paid' ? 'Payment verified' : 'Marked as not received')
      onChanged?.()
    } catch (err) {
      setAsk(null)
      setError(err.message || 'Could not save your decision.')
      load()
    } finally { if (alive.current) setBusy(false) }
  }

  const list = rows || []
  return (
    <>
      {list.length > 0 && (
        <section aria-label="Payments to verify" className="mb-5 rounded-2xl border border-amber-300 bg-[#fff8e6] p-4">
          <h2 className="m-0 mb-1 text-[17px] font-extrabold text-amber-900">Payments to verify ({list.length})</h2>
          <p className="m-0 mb-3 text-[13px] text-amber-900/70">Check your GCash / Maya for the amount below. Confirm only after you see it, and the booking is confirmed for the patient.</p>
          {error && <p role="alert" className="mb-2 text-[13px] text-red-700">{error}</p>}
          {list.map((r) => (
            <PaymentsToVerifyCard key={r.attemptId} row={r} busy={busy} onVerify={(row) => setAsk({ kind: 'paid', row })} onReject={(row) => setAsk({ kind: 'reject', row })} onOpenReceipt={(src, row) => setZoom({ src, title: `Receipt from ${row.patient || 'patient'}` })} />
          ))}
        </section>
      )}
      {ask?.kind === 'paid' && <ConfirmPaid row={ask.row} busy={busy} onCancel={() => setAsk(null)} onConfirm={() => decide('paid', ask.row)} />}
      {ask?.kind === 'reject' && <RejectDialog row={ask.row} busy={busy} onCancel={() => setAsk(null)} onConfirm={(reason) => decide('reject', ask.row, reason)} />}
      {zoom && <ReceiptLightbox src={zoom.src} title={zoom.title} onClose={() => setZoom(null)} />}
      {toast && <div role="status" aria-live="polite" className="fixed bottom-6 left-1/2 z-[100001] flex -translate-x-1/2 items-center gap-2 rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white shadow-xl"><CheckCircle2 size={16} className="text-green-400" aria-hidden="true" /> {toast}</div>}
    </>
  )
}
