import { useNavigate } from 'react-router-dom'

export const peso = (n) => `₱${Number(n).toLocaleString('en-US')}`

export const fmtDate = (iso) =>
  new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

// Shared "+ New Invoice" button shown in the header of every Sales / Billing
// sub-page. On pages other than Invoices it just routes there; the Invoices page
// passes its own `onClick` to open the create-invoice modal instead.
export function NewInvoiceButton({ onClick }) {
  const navigate = useNavigate()
  return (
    <button
      type="button"
      className="sb-newbtn"
      onClick={onClick || (() => navigate('/owner/billing/invoices'))}
    >
      + New Invoice
    </button>
  )
}

export const BILLING_SUBTITLE =
  'Everything about money in one place — revenue, invoices, payouts, and how you get paid.'
