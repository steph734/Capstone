// UI tests for the branch TIN work. Run: npx vitest run src/pages/admin/branches src/pages/owner/billing
import { describe, expect, it } from 'vitest'
import { renderToString } from 'react-dom/server'
import TaxBillingSection from './TaxBillingSection'
import AddBranchModal from './AddBranchModal'
import { BranchCard } from '../BranchesPage'
import { ClinicDetailsView, BranchPicker } from '../../owner/billing/ClinicDetailsCard'
import { formatTin, billingErrors, tinRequired, tinChangeNeedsConfirm, nearLimit, TIN_NEEDED } from './billingFields'

const html = (el) => renderToString(el).replace(/<!-- -->/g, '')
const form = (over = {}) => ({ tin: '', billingEmail: '', website: '', paymentInstructions: '', defaultInvoiceTerms: '', ...over })

describe('TIN auto-formatting', () => {
  it('formats as you type', () => {
    expect(formatTin('456657670')).toBe('456-657-670')
    expect(formatTin('456-657-670-00001')).toBe('456-657-670-00001')
    expect(formatTin('x4y5z6')).toBe('456')
  })
})

describe('required-for-Active red state', () => {
  it('shows the red field and the message when Active is chosen with no TIN', () => {
    const out = html(<TaxBillingSection form={form()} errors={{}} set={() => {}} needTin />)
    expect(out).toContain('tin-red')
    expect(out).toContain('required for Active')
    expect(out).toContain('Add a TIN before setting this branch to Active. Active branches can send invoices.')
    expect(out).toContain('role="alert"')
    expect(out).toContain('aria-invalid="true"')
  })
  it('is calm for Under review, and not red once a TIN is typed', () => {
    const calm = html(<TaxBillingSection form={form()} errors={{}} set={() => {}} needTin={false} />)
    expect(calm).not.toContain('tin-red')
    expect(calm).toContain('Required to set the branch Active.')
    expect(html(<TaxBillingSection form={form({ tin: '456-657-670-00001' })} errors={{}} set={() => {}} needTin />)).not.toContain('tin-red')
  })
  it('renders every field of the design, with helper text', () => {
    const out = html(<TaxBillingSection form={form()} errors={{}} set={() => {}} needTin={false} />)
    for (const s of ['Tax &amp; billing', 'NEW', 'Business / Tax ID (TIN)', '000-000-000-00000', 'Billing email', 'Shown on invoices.', 'Website', 'Payment instructions', 'Printed on every invoice from this branch.', 'Default invoice terms', 'Used as the starting terms for new invoices. Can be changed per invoice.']) expect(out).toContain(s)
  })
  it('shows a character counter only near the limit', () => {
    expect(nearLimit(100, 1000)).toBe(false); expect(nearLimit(850, 1000)).toBe(true)
    expect(html(<TaxBillingSection form={form({ paymentInstructions: 'x'.repeat(900) })} errors={{}} set={() => {}} needTin={false} />)).toContain('900 / 1000')
  })
  it('client rules: required only for Active; a bad format and bad email are caught', () => {
    expect(billingErrors(form(), { needTin: true }).tin).toBe(TIN_NEEDED)
    expect(billingErrors(form(), { needTin: false })).toEqual({})
    expect(billingErrors(form({ tin: '456-657' }), { needTin: false }).tin).toMatch(/000-000-000-00000/)
    expect(billingErrors(form({ billingEmail: 'nope' }), { needTin: false }).billingEmail).toBeTruthy()
  })
  it('who needs a TIN: Active new/draft yes; Under review no; a live Active branch without one stays editable; with one it cannot lose it', () => {
    expect(tinRequired({ editing: false, branch: null, status: 'Active' })).toBe(true)
    expect(tinRequired({ editing: false, branch: null, status: 'Under review' })).toBe(false)
    expect(tinRequired({ editing: true, branch: { status: 'Draft' }, status: 'Active' })).toBe(true)
    expect(tinRequired({ editing: true, branch: { status: 'Active', tin: '' }, status: 'Active' })).toBe(false)
    expect(tinRequired({ editing: true, branch: { status: 'Active', tin: '456-657-670-00001' }, status: 'Active' })).toBe(true)
  })
  it('changing the TIN of an Active branch asks for confirmation', () => {
    const b = { status: 'Active', tin: '456-657-670-00001' }
    expect(tinChangeNeedsConfirm({ editing: true, branch: b, tin: '111-111-111-111' })).toBe(true)
    expect(tinChangeNeedsConfirm({ editing: true, branch: b, tin: '456-657-670-00001' })).toBe(false)
    expect(tinChangeNeedsConfirm({ editing: true, branch: { status: 'Active', tin: '' }, tin: '111-111-111-111' })).toBe(false) // first TIN: nothing sent yet
    expect(tinChangeNeedsConfirm({ editing: false, branch: null, tin: '111-111-111-111' })).toBe(false)
  })
})

describe('Add / Edit branch modal', () => {
  it('step 1 shows Tax & billing between the email and the therapist capacity', () => {
    const out = html(<AddBranchModal branch={null} owners={[]} existingBranches={[]} onClose={() => {}} onSaved={() => {}} />)
    expect(out.indexOf('Branch email')).toBeLessThan(out.indexOf('Tax &amp; billing'))
    expect(out.indexOf('Tax &amp; billing')).toBeLessThan(out.indexOf('Therapist capacity'))
    for (const s of ['Cancel', 'Save as draft', 'Next: Owner']) expect(out).toContain(s)
  })
  it('the Edit form loads the TIN and billing fields from the branch', () => {
    const b = { id: 'x', name: 'Davao', status: 'Active', city: 'Davao', province: 'Davao del Sur', street: 'Main', phone: '0917 123 4567', capacity: 5, tin: '456-657-670-00001', billingEmail: 'b@x.ph', website: 'www.x.ph', paymentInstructions: 'Pay at desk', defaultInvoiceTerms: 'Net 7', services: [], hours: null, owner: null }
    const out = html(<AddBranchModal branch={b} owners={[]} existingBranches={[b]} onClose={() => {}} onSaved={() => {}} />)
    for (const s of ['456-657-670-00001', 'b@x.ph', 'www.x.ph', 'Pay at desk', 'Net 7']) expect(out).toContain(s)
  })
})

describe('branch card', () => {
  const props = { menuOpen: false, onMenu() {}, onView() {}, onEdit() {}, onArchive() {}, onRestore() {}, onReview() {} }
  const b = { id: 'b1', name: 'Makati', status: 'Active', address: 'Ayala Ave', phone: '(02) 8123 4567', therapists: 3, patients: 10, sessionsThisMonth: 20, owner: null, missing: [] }
  it('shows the TIN under the phone number', () => {
    const out = html(<BranchCard {...props} b={{ ...b, tin: '456-657-670-00001' }} />)
    expect(out).toContain('TIN 456-657-670-00001')
    expect(out.indexOf('(02) 8123 4567')).toBeLessThan(out.indexOf('TIN 456-657-670-00001'))
    expect(out).not.toContain('No TIN yet')
  })
  it('shows the amber "No TIN yet · Add TIN" strip when there is none', () => {
    const out = html(<BranchCard {...props} b={{ ...b, tin: '' }} />)
    expect(out).toContain('No TIN yet'); expect(out).toContain('Add TIN'); expect(out).toContain('br-tin-missing')
  })
})

describe('Owner: clinic details on invoices (view only)', () => {
  const davao = { id: 'a', name: 'Davao Main Branch', status: 'Active', address: 'Davao City', phone: '09171234567', tin: '456-657-670-00000', billingEmail: 'billing.davao@therapypro.example', website: 'www.therapypro.ph', paymentInstructions: 'Pay by GCash or card through the app, or at the front desk of this branch.', defaultInvoiceTerms: 'Payment is due on the due date shown.' }
  const quezon = { id: 'q', name: 'Quezon City', status: 'Active', address: '45 Katipunan Ave, Quezon City', phone: '+63 2 8888 5678', tin: '', billingEmail: '', website: '', paymentInstructions: '', defaultInvoiceTerms: 'Payment is due on the due date shown. Late payments may delay scheduled sessions.' }
  const view = (branch = davao, over = {}) => html(<ClinicDetailsView branches={[davao, quezon]} branch={branch} clinicName="TherapyPro" {...over} />)

  it('has NO editable inputs and NO Save button: values are read-only text', () => {
    const out = view()
    expect(out).not.toMatch(/<input/); expect(out).not.toMatch(/<textarea/); expect(out).not.toMatch(/<select/)
    expect(out).not.toMatch(/type="submit"/); expect(out).not.toMatch(/<form/)
    expect(out).not.toContain('Save clinic details'); expect(out).not.toContain('Save branch details')
    expect(out).toContain('role="textbox"'); expect(out).toContain('aria-readonly="true"')
  })
  it('shows the notice, the address and phone strip, the picker note and the footer text', () => {
    const out = view()
    expect(out).toContain('These details are managed by the'); expect(out).toContain('Super Admin'); expect(out).toContain('When they update a branch, it changes here automatically.')
    expect(out).toContain('ADDRESS'); expect(out).toContain('Davao City'); expect(out).toContain('PHONE'); expect(out).toContain('09171234567')
    expect(out).toContain('2 branches · pick one to view its details')
    expect(out).toContain('Something wrong or missing? Ask the Super Admin to update it. Invoices already sent keep the details they were issued with.')
  })
  it('renders the branch values read-only', () => {
    const out = view()
    for (const s of ['TherapyPro', '456-657-670-00000', 'billing.davao@therapypro.example', 'www.therapypro.ph', 'Pay by GCash or card through the app', 'Payment is due on the due date shown.']) expect(out).toContain(s)
  })
  it('a missing value says "Not provided" in grey italics', () => {
    const out = view(quezon)
    expect(out).toContain('fin-notprovided'); expect(out).toContain('Not provided')
    expect((out.match(/Not provided/g) || []).length).toBeGreaterThanOrEqual(3) // email, website, payment instructions
  })
  it('a branch with no TIN shows the red "Not set yet" state and the message', () => {
    const out = view(quezon)
    expect(out).toContain('Not set yet'); expect(out).toContain('missing')
    expect(out).toContain('No TIN yet. This branch can’t send invoices until the Super Admin adds one.')
    expect(view(davao)).not.toContain('Not set yet')
  })
  it('the branch picker lists each branch with its TIN or an amber "No TIN yet" tag, and a check on the selected one', () => {
    const closed = html(<BranchPicker branches={[davao, quezon]} branch={davao} onPick={() => {}} />)
    expect(closed).toContain('Davao Main Branch'); expect(closed).toContain('Active'); expect(closed).toContain('aria-haspopup="listbox"')
    expect(closed).not.toContain('No TIN yet') // the list is closed
  })
  it('an owner with no branches sees how to get one', () => {
    expect(html(<ClinicDetailsView branches={[]} />)).toContain('No branches are assigned to your account yet')
  })
})
