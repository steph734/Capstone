import { Globe, Mail, Receipt, TriangleAlert } from 'lucide-react'
import { LIMITS, TIN_NEEDED, formatTin, nearLimit } from './billingFields'

// Shared bits of the Add / Edit branch form (same markup as the other fields in the modal).
function Field({ label, optional, error, hint, children, htmlFor }) {
  return (
    <div className="br-field">
      <div className="br-field-head">
        <label htmlFor={htmlFor}>{label}</label>
        {optional && <span className="br-optional">optional</span>}
      </div>
      {children}
      {error ? <p className="br-error" role="alert">{error}</p> : hint ? <p className="br-hint">{hint}</p> : null}
    </div>
  )
}
function IconInput({ icon: Icon, error, ...props }) {
  return (
    <div className={`br-input${error ? ' has-error' : ''}`}>
      {Icon && <Icon size={16} aria-hidden="true" />}
      <input {...props} aria-invalid={Boolean(error)} />
    </div>
  )
}

// "Tax & billing": TIN (auto-formatted), billing email, website, payment instructions, default invoice terms.
// `needTin` = the branch is being set Active, so the TIN is required (the red state of the design).
export default function TaxBillingSection({ form, errors, set, needTin, sectionRef }) {
  const tinRed = needTin && !form.tin.trim()
  return (
  <section className="br-tax" ref={sectionRef} aria-labelledby="br-tax-title">
    <div className="br-tax-head">
      <h3 id="br-tax-title">Tax &amp; billing</h3>
      <span className="br-new">NEW</span>
    </div>
    <p className="br-tax-sub">Printed on the header and footer of this branch&apos;s invoices.</p>

    <div className={`br-field${tinRed || errors.tin ? ' tin-red' : ''}`}>
      <div className="br-field-head">
        <label htmlFor="br-tin">Business / Tax ID (TIN)</label>
        <span className={needTin ? 'br-req' : 'br-optional'}>{needTin ? 'required for Active' : 'required to set Active'}</span>
      </div>
      <IconInput icon={Receipt} id="br-tin" inputMode="numeric" autoComplete="off" value={form.tin} error={tinRed || errors.tin}
        aria-describedby="br-tin-msg" onChange={(e) => set('tin', formatTin(e.target.value))} placeholder="000-000-000-00000" maxLength={17} />
      {errors.tin || tinRed ? (
        <p className="br-error" id="br-tin-msg" role="alert"><TriangleAlert size={14} aria-hidden="true" /> {errors.tin || 'Add a TIN before setting this branch to Active. Active branches can send invoices.'}</p>
      ) : (
        <p className="br-hint" id="br-tin-msg">9-digit TIN + branch code, printed on every invoice from this branch. Required to set the branch Active.</p>
      )}
    </div>

    <div className="br-grid-2">
      <Field label="Billing email" optional htmlFor="br-billing-email" error={errors.billingEmail} hint="Shown on invoices.">
        <IconInput icon={Mail} id="br-billing-email" type="email" value={form.billingEmail} error={errors.billingEmail} onChange={(e) => set('billingEmail', e.target.value)} placeholder="billing.iloilo@therapypro.ph" />
      </Field>
      <Field label="Website" optional htmlFor="br-website" error={errors.website}>
        <IconInput icon={Globe} id="br-website" value={form.website} error={errors.website} maxLength={LIMITS.website} onChange={(e) => set('website', e.target.value)} placeholder="www.therapypro.ph" />
      </Field>
    </div>

    <Field label="Payment instructions" optional htmlFor="br-pay" error={errors.paymentInstructions} hint="Printed on every invoice from this branch.">
      <textarea id="br-pay" className="br-textarea" rows={3} maxLength={LIMITS.paymentInstructions} value={form.paymentInstructions}
        aria-invalid={Boolean(errors.paymentInstructions)} onChange={(e) => set('paymentInstructions', e.target.value)}
        placeholder="Pay by GCash or card through the app, or at the front desk of this branch." />
      {nearLimit(form.paymentInstructions.length, LIMITS.paymentInstructions) && <span className="br-counter">{form.paymentInstructions.length} / {LIMITS.paymentInstructions}</span>}
    </Field>
    <Field label="Default invoice terms" optional htmlFor="br-terms" error={errors.defaultInvoiceTerms} hint="Used as the starting terms for new invoices. Can be changed per invoice.">
      <textarea id="br-terms" className="br-textarea" rows={3} maxLength={LIMITS.defaultInvoiceTerms} value={form.defaultInvoiceTerms}
        aria-invalid={Boolean(errors.defaultInvoiceTerms)} onChange={(e) => set('defaultInvoiceTerms', e.target.value)}
        placeholder="Payment is due on the due date shown. Late payments may delay scheduled sessions." />
      {nearLimit(form.defaultInvoiceTerms.length, LIMITS.defaultInvoiceTerms) && <span className="br-counter">{form.defaultInvoiceTerms.length} / {LIMITS.defaultInvoiceTerms}</span>}
    </Field>
  </section>
  )
}
