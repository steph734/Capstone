import { useCallback, useEffect, useState } from 'react'
import { CircleCheck, CircleX, Eye, QrCode, ReceiptText } from 'lucide-react'
import { API_BASE } from '../../../utils/api'
import { authFetch, getSessionToken } from '../../../utils/session'
import { REJECT_REASONS } from '../../../../api/_lib/paymentProofRules'
import { Dialog } from './PlanDialogs'
import { peso } from './planConstants'

const wallet = (m) => (m === 'paymaya' ? 'Maya' : 'GCash')
const when = (d) => new Date(d).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })

function Details({ p }) {
  const rows = [['Owner', `${p.ownerName}${p.ownerEmail && p.ownerEmail !== p.ownerName ? ` (${p.ownerEmail})` : ''}`], ['Plan', `${p.planName} · ${p.period}`], ['Amount', peso(p.amount)], ['Paid with', `${wallet(p.method)} QR`], ['Reference no.', p.referenceDisplay], ['Sent', when(p.submittedAt)]]
  return (
    <dl className="pcx-qr-details">
      {rows.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}
    </dl>
  )
}

// The receipt image is private: it is fetched with the Super Admin's session and shown from a temporary blob URL.
function Receipt({ id }) {
  const [state, setState] = useState({ url: '', error: '' })
  useEffect(() => {
    let url = ''
    let alive = true
    fetch(`${API_BASE}/api/admin/subscription-payments/${id}/receipt`, { headers: { Authorization: `Bearer ${getSessionToken()}` } })
      .then(async (res) => {
        if (!res.ok) throw new Error('Could not load the receipt.')
        url = URL.createObjectURL(await res.blob())
        if (alive) setState({ url, error: '' })
        else URL.revokeObjectURL(url)
      })
      .catch((err) => alive && setState({ url: '', error: err.message }))
    return () => { alive = false; if (url) URL.revokeObjectURL(url) }
  }, [id])
  if (state.error) return <p className="br-form-error" role="alert">{state.error}</p>
  if (!state.url) return <p className="br-hint">Loading receipt…</p>
  return (
    <a href={state.url} target="_blank" rel="noreferrer" className="pcx-qr-receipt" title="Open full size">
      <img src={state.url} alt="Receipt sent by the owner" />
    </a>
  )
}

function ViewDialog({ p, onClose, onChoose }) {
  return (
    <Dialog title="Check the receipt" icon={ReceiptText} onClose={onClose} wide>
      <div className="br-modal-body pcx-qr-view">
        <Receipt id={p.id} />
        <div>
          <Details p={p} />
          <p className="br-hint">Check that the amount and reference number on the receipt match these details, and that the money arrived in your {wallet(p.method)} account. Click the image to see it full size.</p>
        </div>
      </div>
      <footer className="br-modal-foot">
        <button type="button" className="br-btn btn-line" onClick={onClose}>Close</button>
        <span className="br-spacer" />
        <button type="button" className="br-btn pcx-qr-danger" onClick={() => onChoose('reject')}>Reject</button>
        <button type="button" className="br-btn primary" onClick={() => onChoose('approve')}>Approve</button>
      </footer>
    </Dialog>
  )
}

function ConfirmDialog({ p, action, onClose, onDecided }) {
  const approve = action === 'approve'
  const [checked, setChecked] = useState(false)
  const [reason, setReason] = useState('')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const finalReason = reason === 'Other' ? note.trim() : reason
  const ready = approve ? checked : Boolean(finalReason)
  const close = useCallback(() => { if (!busy) onClose() }, [busy, onClose])

  const submit = async () => {
    setBusy(true); setError('')
    try {
      await authFetch(`/api/admin/subscription-payments/${p.id}/${action}`, { method: 'POST', body: { reason: approve ? '' : finalReason } })
      onDecided({ p, action, reason: finalReason })
    } catch (err) { setError(err.message); setBusy(false) }
  }

  return (
    <Dialog title={approve ? 'Approve this payment?' : 'Reject this payment?'} icon={approve ? CircleCheck : CircleX} onClose={close}>
      <div className="br-modal-body">
        <p className="br-hint" style={{ marginTop: 0 }}>{approve ? `This activates the ${p.planName} plan for the clinic right away. It cannot be undone here.` : 'The plan stays inactive. The owner sees your reason and can send the payment again.'}</p>
        <Details p={p} />
        {approve ? (
          <label className="pcx-qr-check">
            <input type="checkbox" checked={checked} onChange={(e) => setChecked(e.target.checked)} />
            <span>I checked the receipt and confirmed that {peso(p.amount)} arrived.</span>
          </label>
        ) : (
          <fieldset className="pcx-qr-reasons">
            <legend>Reason for rejecting</legend>
            {REJECT_REASONS.map((r) => (
              <label key={r}><input type="radio" name="reject-reason" checked={reason === r} onChange={() => setReason(r)} /><span>{r}</span></label>
            ))}
            {reason === 'Other' && <textarea value={note} onChange={(e) => setNote(e.target.value)} maxLength={200} rows={3} placeholder="Tell the owner what is wrong" aria-label="Reason details" autoFocus />}
          </fieldset>
        )}
        {error && <p className="br-form-error" role="alert">{error}</p>}
      </div>
      <footer className="br-modal-foot">
        <span className="br-spacer" />
        <button type="button" className="br-btn btn-line" onClick={close} disabled={busy}>Cancel</button>
        <button type="button" className={`br-btn ${approve ? 'primary' : 'pcx-qr-danger solid'}`} onClick={submit} disabled={!ready || busy}>
          {busy ? 'Saving…' : approve ? 'Yes, approve' : 'Yes, reject'}
        </button>
      </footer>
    </Dialog>
  )
}

function SuccessDialog({ result, onClose }) {
  const { p, action, reason } = result
  const approve = action === 'approve'
  return (
    <Dialog title={approve ? 'Payment approved' : 'Payment rejected'} onClose={onClose}>
      <div className="br-modal-body pcx-qr-success" role="status">
        <span className={approve ? 'ok' : 'no'}>{approve ? <CircleCheck size={36} aria-hidden="true" /> : <CircleX size={36} aria-hidden="true" />}</span>
        <p>{approve
          ? `The ${p.planName} plan is now active. ${p.ownerName} paid ${peso(p.amount)} with ${wallet(p.method)}.`
          : `${p.ownerName}'s payment of ${peso(p.amount)} was rejected${reason ? `: ${reason}` : ''}. They can send it again.`}</p>
      </div>
      <footer className="br-modal-foot"><span className="br-spacer" /><button type="button" className="br-btn primary" onClick={onClose} autoFocus>Done</button></footer>
    </Dialog>
  )
}

// GCash / Maya plan payments from clinic owners, waiting for the Super Admin. The list is hidden while there is nothing to check.
export default function QrPaymentsPanel({ onDone }) {
  const [rows, setRows] = useState([])
  const [dialog, setDialog] = useState(null) // { type: 'view' | 'approve' | 'reject', p } | { type: 'success', result }

  const load = useCallback(async () => {
    try { setRows((await authFetch('/api/admin/subscription-payments')).payments || []) } catch (err) { console.error('qr payments:', err.message) }
  }, [])
  useEffect(() => { load() }, [load])

  const close = useCallback(() => { setDialog(null); load() }, [load])
  const decided = (result) => { setDialog({ type: 'success', result }); load(); onDone?.() }

  return (
    <>
      {rows.length > 0 && (
        <section className="pcx-panel">
          <header className="pcx-panel-head">
            <div><h2><QrCode size={17} aria-hidden="true" /> QR payments to verify</h2><p>View the receipt and check that the money arrived before approving</p></div>
          </header>
          <div className="pcx-table-wrap">
            <table className="pcx-table">
              <thead><tr><th scope="col">Owner</th><th scope="col">Plan</th><th scope="col">Amount</th><th scope="col">Reference</th><th scope="col">Sent</th><th scope="col">Actions</th></tr></thead>
              <tbody>
                {rows.map((p) => (
                  <tr key={p.id}>
                    <th scope="row">{p.ownerName}<small>{p.ownerEmail}</small></th>
                    <td>{p.planName} · {p.period}</td>
                    <td>{peso(p.amount)}</td>
                    <td>{wallet(p.method)} {p.referenceDisplay}</td>
                    <td>{when(p.submittedAt)}</td>
                    <td>
                      <span style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        <button type="button" className="br-btn btn-line sm" onClick={() => setDialog({ type: 'view', p })}><Eye size={15} aria-hidden="true" /> View receipt</button>
                        <button type="button" className="br-btn primary sm" onClick={() => setDialog({ type: 'approve', p })}>Approve</button>
                        <button type="button" className="br-btn sm pcx-qr-danger" onClick={() => setDialog({ type: 'reject', p })}>Reject</button>
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {dialog?.type === 'view' && <ViewDialog p={dialog.p} onClose={close} onChoose={(type) => setDialog({ type, p: dialog.p })} />}
      {(dialog?.type === 'approve' || dialog?.type === 'reject') && <ConfirmDialog key={dialog.type} p={dialog.p} action={dialog.type} onClose={close} onDecided={decided} />}
      {dialog?.type === 'success' && <SuccessDialog result={dialog.result} onClose={close} />}
    </>
  )
}
