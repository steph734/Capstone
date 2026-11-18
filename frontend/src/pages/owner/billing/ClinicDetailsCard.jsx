import { useEffect, useState } from 'react'
import { Field, ErrorBanner, useToast } from './FinanceUi'
import { call, errMsg } from './financeApi'

// Clinic details used on invoice headers (stored in clinic_settings). Address and phone come from each branch.
export default function ClinicDetailsCard() {
  const [f, setF] = useState(null)
  const [errors, setErrors] = useState({})
  const [banner, setBanner] = useState('')
  const [busy, setBusy] = useState(false)
  const [toastEl, toast] = useToast()
  useEffect(() => { call('clinic').then((d) => setF(d.clinic)).catch((e) => setBanner(errMsg(e))) }, [])
  const save = async (e) => {
    e.preventDefault(); setBusy(true); setBanner(''); setErrors({})
    try {
      const { clinic_name, business_tin, email, website, payment_instructions, default_terms } = f
      const d = await call('clinic', { method: 'PUT', body: { clinic_name, business_tin, email, website, payment_instructions, default_terms } })
      setF(d.clinic); toast('Clinic details saved')
    } catch (ex) { setErrors(ex.fields || {}); setBanner(errMsg(ex)) } finally { setBusy(false) }
  }
  const text = (k, label, props = {}) => <Field label={label} error={errors[k]}>{(id, eid) => <input id={id} aria-describedby={eid} value={f?.[k] || ''} onChange={(e) => setF({ ...f, [k]: e.target.value })} {...props} />}</Field>
  return (
    <section className="sba-card fin-page" style={{ gridColumn: '1 / -1' }}>
      <h3 className="sba-card-title">Clinic details on invoices</h3>
      <p className="sba-card-sub">Shown in the header of every invoice. Address and phone come from the branch.</p>
      {!f ? <p className="fin-hint">{banner || 'Loading…'}</p> : (
        <form className="fin-form" onSubmit={save} noValidate>
          <ErrorBanner>{banner}</ErrorBanner>
          <div className="fin-grid3">
            {text('clinic_name', 'Clinic name')}{text('business_tin', 'Business / tax ID (TIN)')}{text('email', 'Billing email', { type: 'email' })}
            {text('website', 'Website')}
          </div>
          <Field label="Payment instructions">{(id) => <textarea id={id} rows={2} maxLength={500} value={f.payment_instructions || ''} onChange={(e) => setF({ ...f, payment_instructions: e.target.value })} />}</Field>
          <Field label="Default invoice terms">{(id) => <textarea id={id} rows={2} maxLength={500} value={f.default_terms || ''} onChange={(e) => setF({ ...f, default_terms: e.target.value })} />}</Field>
          <div><button type="submit" className="fin-btn fin-btn-primary" disabled={busy}>{busy ? 'Saving…' : 'Save clinic details'}</button></div>
        </form>
      )}
      {toastEl}
    </section>
  )
}
