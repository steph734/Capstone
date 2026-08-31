import { useEffect, useState } from 'react'
import './BillingModal.css'

function CloseIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  )
}

function formatAmount(amount, currency) {
  const value = (amount / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  const symbol = currency === 'PHP' ? '₱' : ''
  return symbol ? `${symbol}${value}` : `${value} ${currency}`
}

function formatDate(unixSeconds) {
  return new Date(unixSeconds * 1000).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

export default function PaymentHistoryModal({ email, onClose }) {
  const [state, setState] = useState({ status: 'loading', payments: [], error: '' })

  useEffect(() => {
    let cancelled = false
    setState({ status: 'loading', payments: [], error: '' })

    fetch(`/api/payment-history?email=${encodeURIComponent(email)}`)
      .then(async (res) => {
        let data
        try {
          data = await res.json()
        } catch {
          throw new Error(
            "Couldn't reach the payment server. If you're running `npm run dev`, the /api routes " +
            'are not served that way — run `vercel dev` instead.'
          )
        }
        if (!res.ok) throw new Error(data.error || 'Could not load payment history')
        if (!cancelled) setState({ status: 'ready', payments: data.payments || [], error: '' })
      })
      .catch((err) => {
        if (!cancelled) setState({ status: 'error', payments: [], error: err.message })
      })

    return () => {
      cancelled = true
    }
  }, [email])

  return (
    <div className="billing-modal-overlay" role="dialog" aria-modal="true" aria-labelledby="payment-history-title" onClick={onClose}>
      <div className="billing-modal" onClick={(e) => e.stopPropagation()}>
        <div className="billing-modal-header">
          <div>
            <h2 id="payment-history-title">Payment History</h2>
            <p>All payments on record with Stripe for {email}</p>
          </div>
          <button type="button" className="billing-modal-close" onClick={onClose} aria-label="Close">
            <CloseIcon />
          </button>
        </div>

        <div className="billing-modal-body">
          {state.status === 'loading' && (
            <div className="billing-modal-loading">Loading payments…</div>
          )}

          {state.status === 'error' && (
            <div className="billing-modal-error">{state.error}</div>
          )}

          {state.status === 'ready' && state.payments.length === 0 && (
            <div className="billing-modal-empty">No payments found for this account yet.</div>
          )}

          {state.status === 'ready' && state.payments.length > 0 && (
            <div className="payment-history-list">
              {state.payments.map((p) => (
                <div key={p.id} className="payment-row">
                  <span className="payment-row-main">{p.description}</span>
                  <span className="payment-row-amount">{formatAmount(p.amount, p.currency)}</span>
                  <span className="payment-row-sub">
                    {formatDate(p.created)}
                    {p.cardBrand && p.cardLast4 ? ` · ${p.cardBrand} ···· ${p.cardLast4}` : ''}
                  </span>
                  <span className="payment-row-meta">
                    <span className={`payment-status ${p.status}`}>{p.status}</span>
                    {p.receiptUrl && (
                      <a
                        className="payment-receipt-link"
                        href={p.receiptUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        Receipt
                      </a>
                    )}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
