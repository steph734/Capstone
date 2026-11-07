import { useCallback, useEffect, useState } from 'react'
import { authFetch } from '../utils/session'

// Shown on the therapist's Appointments page. GCash / Maya QR payments cannot be checked automatically, so the
// therapist who received the booking checks their own wallet and presses "Mark as paid" or "Not received".
// Until then the patient's time slot stays reserved and the booking is NOT confirmed.
const peso = (n) => `₱ ${Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const when = (d) => (d ? new Date(d).toLocaleDateString('en-US', { timeZone: 'UTC', weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }) : '')

export default function PaymentVerificationPanel() {
  const [rows, setRows] = useState(null)
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
  const [zoom, setZoom] = useState('')

  const load = useCallback(() => {
    authFetch('/api/payments/awaiting-verification').then((b) => setRows(b.payments || [])).catch(() => setRows([]))
  }, [])
  useEffect(() => { load() }, [load])

  const decide = async (row, action) => {
    if (action === 'reject' && !window.confirm('Mark this payment as NOT received? The time slot will be released and the patient will be told.')) return
    setBusy(row.attemptId); setError('')
    try {
      await authFetch(`/api/payments/${row.attemptId}/review`, { method: 'POST', body: { action } })
      setRows((r) => r.filter((x) => x.attemptId !== row.attemptId))
    } catch (err) {
      setError(err.message || 'Could not save your decision.')
    } finally { setBusy('') }
  }

  if (!rows || !rows.length) return null
  return (
    <section aria-label="Payments to verify" style={{ background: '#fff8e6', border: '1px solid #f3d284', borderRadius: 16, padding: 16, marginBottom: 18 }}>
      <h2 style={{ margin: '0 0 4px', fontSize: 17, color: '#7a4b00' }}>Payments to verify ({rows.length})</h2>
      <p style={{ margin: '0 0 12px', fontSize: 13, color: '#6b5a2e' }}>Check your GCash / Maya for the amount below. Confirm only after you see it, and the booking is confirmed for the patient.</p>
      {error && <p role="alert" style={{ color: '#b91c1c', fontSize: 13 }}>{error}</p>}
      {rows.map((r) => (
        <div key={r.attemptId} style={{ background: '#fff', border: '1px solid #ead9a8', borderRadius: 12, padding: 12, marginBottom: 10, display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ minWidth: 220 }}>
            <strong>{r.patient || 'Patient'}</strong> <span style={{ color: '#6b7c75' }}>· {r.method}</span>
            <div style={{ fontSize: 13, color: '#4b5563' }}>{when(r.date)} · {r.timeLabel}</div>
            <div style={{ fontSize: 14, fontWeight: 700 }}>{peso(r.amount)}</div>
            <div style={{ fontSize: 12, color: '#6b7c75' }}>Reference: {r.reference || 'not given'}{r.guardian ? ` · Guardian: ${r.guardian}` : ''}{r.contact ? ` · ${r.contact}` : ''}</div>
          </div>
          {r.screenshot && (
            <button type="button" onClick={() => setZoom(r.screenshot)} aria-label="Open the payment screenshot" style={{ border: 'none', background: 'none', padding: 0, cursor: 'pointer' }}>
              <img src={r.screenshot} alt="Payment screenshot from the patient" style={{ height: 64, borderRadius: 8, border: '1px solid #e5e7eb' }} />
            </button>
          )}
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" disabled={busy === r.attemptId} onClick={() => decide(r, 'approve')} style={{ minHeight: 44, padding: '0 16px', borderRadius: 10, border: 'none', background: '#16a34a', color: '#fff', fontWeight: 700, cursor: 'pointer' }}>Mark as paid</button>
            <button type="button" disabled={busy === r.attemptId} onClick={() => decide(r, 'reject')} style={{ minHeight: 44, padding: '0 16px', borderRadius: 10, border: '1px solid #e5b4b4', background: '#fff', color: '#b91c1c', fontWeight: 700, cursor: 'pointer' }}>Not received</button>
          </div>
        </div>
      ))}
      {zoom && (
        <div role="dialog" aria-modal="true" aria-label="Payment screenshot" onClick={() => setZoom('')} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.7)', zIndex: 100000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <img src={zoom} alt="Payment screenshot" style={{ maxWidth: '100%', maxHeight: '100%', borderRadius: 12 }} />
        </div>
      )}
    </section>
  )
}
