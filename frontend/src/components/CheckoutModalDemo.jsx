import { useState } from 'react'
import CheckoutModal from './CheckoutModal'

// Drop-in demo: render <CheckoutModalDemo /> from any route to try the flow.
// e.g. in App.jsx:  <Route path="/checkout-demo" element={<CheckoutModalDemo />} />
export default function CheckoutModalDemo() {
  const [open, setOpen] = useState(false)

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-slate-100 p-6">
      <h1 className="text-lg font-bold text-slate-800">Checkout modal demo</h1>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-lg bg-pm-green px-6 py-2.5 text-sm font-semibold text-white hover:bg-pm-green-dark"
      >
        Pay ₱ 7,125.00
      </button>

      <CheckoutModal
        open={open}
        onClose={() => setOpen(false)}
        merchantName="JBRB Booking"
        lineItems={[{ name: 'JBRB Booking - Downpayment', qty: 1, unitCentavos: 712500 }]}
        redirectSeconds={5}
        onSuccess={(meta) => console.log('paid', meta)}
        onRedirect={() => setOpen(false)}
      />
    </div>
  )
}
