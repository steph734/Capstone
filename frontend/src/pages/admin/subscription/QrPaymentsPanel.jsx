import { useCallback, useEffect, useState } from 'react'
import { QrCode } from 'lucide-react'
import { API_BASE } from '../../../utils/api'
import { authFetch, getSessionToken } from '../../../utils/session'
import { peso } from './planConstants'

// GCash / Maya plan payments from clinic owners, waiting for the Super Admin. Hidden while there is nothing to check.
export default function QrPaymentsPanel({ onDone }) {
  const [rows, setRows] = useState([])
  const [busyId, setBusyId] = useState(null)

  const load = useCallback(async () => {
    try { setRows((await authFetch('/api/admin/subscription-payments')).payments || []) } catch (err) { console.error('qr payments:', err.message) }
  }, [])
  useEffect(() => { load() }, [load])

  const viewReceipt = async (id) => {
    const tab = window.open('', '_blank') // opened inside the click, so it is not blocked as a pop-up
    try {
      const res = await fetch(`${API_BASE}/api/admin/subscription-payments/${id}/receipt`, { headers: { Authorization: `Bearer ${getSessionToken()}` } })
      if (!res.ok) throw new Error('Could not load the receipt.')
      const url = URL.createObjectURL(await res.blob())
      if (tab) tab.location.href = url
    } catch (err) { tab?.close(); onDone?.(err.message) }
  }

  const decide = async (p, action) => {
    let reason = ''
    if (action === 'reject') {
      const typed = window.prompt('Why is this payment rejected? The owner will see this.', "Amount didn't arrive")
      if (typed === null) return
      reason = typed
    } else if (!window.confirm(`Confirm that ${peso(p.amount)} arrived? This activates the ${p.planName} plan.`)) return
    setBusyId(p.id)
    try {
      await authFetch(`/api/admin/subscription-payments/${p.id}/${action}`, { method: 'POST', body: { reason } })
      onDone?.(action === 'approve' ? `${p.planName} plan activated.` : 'Payment rejected.')
    } catch (err) { onDone?.(err.message) } finally { setBusyId(null); load() }
  }

  if (!rows.length) return null
  return (
    <section className="pcx-panel">
      <header className="pcx-panel-head">
        <div><h2><QrCode size={17} aria-hidden="true" /> QR payments to verify</h2><p>Check that the money arrived before approving</p></div>
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
                <td>{p.method === 'paymaya' ? 'Maya' : 'GCash'} {p.referenceDisplay}</td>
                <td>{new Date(p.submittedAt).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</td>
                <td>
                  <span style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    <button type="button" className="br-btn btn-line sm" onClick={() => viewReceipt(p.id)}>Receipt</button>
                    <button type="button" className="br-btn primary sm" disabled={busyId === p.id} onClick={() => decide(p, 'approve')}>Approve</button>
                    <button type="button" className="br-btn btn-line sm" disabled={busyId === p.id} onClick={() => decide(p, 'reject')}>Reject</button>
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
