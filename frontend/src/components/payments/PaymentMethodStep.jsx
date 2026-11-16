import { Check } from 'lucide-react'

// "Select payment method" on the booking page (Summary & Payment). The cards keep the page's existing classes, so the
// look does not change. Under them, when "Pay Online" is chosen, a four-step strip says what happens next.
export const ONLINE_STEPS = [
  { title: 'Pay at checkout', text: 'Card or GCash/Maya QR through secure Stripe checkout' },
  { title: 'Confirm your payment', text: 'Check the amount and details' },
  { title: 'Add proof', text: 'Reference number + receipt image (both required)' },
  { title: 'Therapist receives', text: 'Booking is confirmed after they verify' },
]

export default function PaymentMethodStep({ methods, value, onChange, error }) {
  return (
    <>
      <h3 className="book-section-title" style={{ marginTop: '22px' }}>
        Select Payment Method <span className="req">*</span>
      </h3>
      {error && <div className="step-error" role="alert">{error}</div>}
      <div className="payment-methods" role="radiogroup" aria-label="Payment method">
        {methods.map((pm) => (
          <button
            key={pm.id}
            type="button"
            role="radio"
            aria-checked={value === pm.id}
            className={`pay-option ${value === pm.id ? 'selected' : ''}`}
            onClick={() => onChange(pm.id)}
          >
            <span className={`pay-check ${value === pm.id ? 'visible' : ''}`}><Check size={13} strokeWidth={3.5} aria-hidden="true" /></span>
            <span className="pay-label">{pm.label}</span>
            <span className="pay-desc">{pm.desc}</span>
          </button>
        ))}
      </div>

      {value === 'stripe' && (
        <section aria-label="What happens next, online payment" className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50/60 p-4 text-left">
          <h4 className="m-0 text-[11px] font-bold uppercase tracking-wider text-emerald-800">What happens next · online payment</h4>
          <ol className="m-0 mt-3 grid list-none grid-cols-1 gap-3 p-0 sm:grid-cols-2 lg:grid-cols-4">
            {ONLINE_STEPS.map((s, i) => (
              <li key={s.title} className="flex items-start gap-2.5">
                <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-900 text-[13px] font-bold text-white" aria-hidden="true">{i + 1}</span>
                <span className="block">
                  <span className="block text-sm font-bold text-slate-800">{s.title}</span>
                  <span className="mt-0.5 block text-xs leading-snug text-slate-500">{s.text}</span>
                </span>
              </li>
            ))}
          </ol>
        </section>
      )}
    </>
  )
}
