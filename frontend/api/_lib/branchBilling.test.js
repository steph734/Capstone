// Unit tests for the per-branch tax & billing rules (no database). Run: npx vitest run api/_lib/branchBilling.test.js
import { describe, expect, it } from 'vitest'
import { ObjectId } from 'mongodb'
import { formatTin, validateBilling, billingChanges, billingView, tinProblem, readableValidatorError, TIN_RE, OWNER_EDITABLE } from './branchBilling.js'
import { validateBranchInput, serializeBranch } from './adminBranches.js'

const base = { name: 'Therapy Pro - Iloilo', city: 'Iloilo City', province: 'Iloilo', street: '2F Atrium Bldg', phone: '(033) 000 0000', capacity: 10, services: ['Speech'], hours: { mon: { open: true, from: '08:00', to: '17:00' } } }

describe('TIN format (same pattern as the live validator)', () => {
  it('accepts 9 digits + a 3 to 5 digit branch code', () => {
    for (const ok of ['456-657-670-00001', '123-456-789-123', '123-456-789-1234']) expect(TIN_RE.test(ok)).toBe(true)
  })
  it('rejects everything else', () => {
    for (const bad of ['456657670', '456-657-670', '456-657-670-1', '456-657-670-123456', 'abc-def-ghi-jkl', '45665767', '456 657 670 00001', '']) expect(TIN_RE.test(bad)).toBe(false)
  })
  it('auto-formats while typing and drops non-digits', () => {
    expect(formatTin('456')).toBe('456')
    expect(formatTin('4566')).toBe('456-6')
    expect(formatTin('456657670')).toBe('456-657-670')
    expect(formatTin('45665767000001')).toBe('456-657-670-00001')
    expect(formatTin('a4b5c6-657/670 00001')).toBe('456-657-670-00001')
    expect(formatTin('1234567890123456789')).toBe('123-456-789-01234') // capped at 14 digits
    expect(formatTin('')).toBe('')
  })
})

describe('validateBilling', () => {
  it('trims, lower-cases the email, and accepts all five fields', () => {
    const { fields, value } = validateBilling({ tin: ' 456-657-670-00001 ', billingEmail: ' Billing@TherapyPro.ph ', website: ' www.therapypro.ph ', paymentInstructions: ' Pay by GCash ', defaultInvoiceTerms: ' Due in 7 days ' })
    expect(fields).toEqual({})
    expect(value).toEqual({ tin: '456-657-670-00001', billing_email: 'billing@therapypro.ph', website: 'www.therapypro.ph', payment_instructions: 'Pay by GCash', default_invoice_terms: 'Due in 7 days' })
  })
  it('a blank field is never an empty string: it becomes undefined (omit on insert, unset on update)', () => {
    const { value, present } = validateBilling({ tin: '', billingEmail: '   ', website: '', paymentInstructions: '', defaultInvoiceTerms: '' })
    expect(present).toHaveLength(5)
    for (const v of Object.values(value)) expect(v).toBeUndefined()
    expect(Object.keys(value)).toHaveLength(5)
  })
  it('only touches the keys that were sent', () => {
    const { value, present } = validateBilling({ website: 'x.ph' })
    expect(present).toEqual(['website']); expect(value).toEqual({ website: 'x.ph' })
  })
  it('rejects bad formats and over-long text', () => {
    const { fields } = validateBilling({ tin: '45665767', billingEmail: 'nope', website: 'w'.repeat(201), paymentInstructions: 'p'.repeat(1001), defaultInvoiceTerms: 't'.repeat(2001) })
    expect(Object.keys(fields).sort()).toEqual(['billingEmail', 'defaultInvoiceTerms', 'paymentInstructions', 'tin', 'website'])
    expect(validateBilling({ website: 'w'.repeat(200), paymentInstructions: 'p'.repeat(1000), defaultInvoiceTerms: 't'.repeat(2000) }).fields).toEqual({})
  })
  it('the old clinic-level TIN (8 digits) is not a valid branch TIN', () => {
    expect(validateBilling({ tin: '45665767' }).fields.tin).toMatch(/000-000-000-00000/)
  })
})

describe('branch input (Add / Edit branch)', () => {
  it('stores the street address in `address` (required by the live validator) and keeps the existing mapping', () => {
    const { fields, value } = validateBranchInput({ ...base, email: 'iloilo@therapypro.ph' }, { draft: false })
    expect(fields).toEqual({})
    expect(value).toMatchObject({ branch_name: 'Therapy Pro - Iloilo', address: '2F Atrium Bldg, Iloilo City, Iloilo', contact_number: '(033) 000 0000', email: 'iloilo@therapypro.ph', therapist_capacity: 10 })
  })
  it('rejects unknown fields', () => {
    expect(validateBranchInput({ ...base, is_admin: true }, { draft: false }).fields.is_admin).toBe('Unknown field.')
  })
  it('carries the billing fields next to the old ones; blanks are undefined', () => {
    const { value } = validateBranchInput({ ...base, tin: '', billingEmail: '', website: 'www.x.ph' }, { draft: false })
    expect(value.tin).toBeUndefined(); expect(value.billing_email).toBeUndefined(); expect(value.website).toBe('www.x.ph')
    expect('tin' in value).toBe(true) // present (so an update unsets it) but never ""
  })
  it('serializes the new fields, and old branches without them still load', () => {
    const old = { _id: new ObjectId(), branch_name: 'Cebu', status: 'Active', address: 'x', contact_number: '0917 123 4567' }
    expect(serializeBranch(old, { stats: null, owner: null })).toMatchObject({ tin: '', billingEmail: '', website: '', paymentInstructions: '', defaultInvoiceTerms: '' })
    expect(serializeBranch({ ...old, tin: '456-657-670-00001', billing_email: 'a@b.ph' }, { stats: null, owner: null })).toMatchObject({ tin: '456-657-670-00001', billingEmail: 'a@b.ph' })
  })
})

describe('audit diff', () => {
  it('lists only fields that really changed, with old and new values', () => {
    const before = { tin: '111-111-111-111', website: 'a.ph', billing_email: 'x@y.ph' }
    const after = { tin: '222-222-222-222', website: 'a.ph', payment_instructions: 'Pay' }
    expect(billingChanges(before, after)).toEqual([
      { field: 'tin', old: '111-111-111-111', new: '222-222-222-222' },
      { field: 'billing_email', old: 'x@y.ph', new: null },
      { field: 'payment_instructions', old: null, new: 'Pay' },
    ])
    expect(billingChanges(before, before)).toEqual([])
    expect(billingView({})).toEqual({ tin: '', billingEmail: '', website: '', paymentInstructions: '', defaultInvoiceTerms: '' })
    expect(OWNER_EDITABLE).not.toContain('tin')
  })
})

describe('TIN rules that need the database', () => {
  const db = (existing) => ({ collection: () => ({ findOne: async () => existing }) })
  it('TIN_REQUIRED_FOR_ACTIVE (422) when a branch is set Active without one', async () => {
    const r = await tinProblem(db(null), { tin: undefined, needTin: true })
    expect(r.status).toBe(422); expect(r.body.code).toBe('TIN_REQUIRED_FOR_ACTIVE'); expect(r.body.fields.tin).toMatch(/Add a TIN before setting this branch to Active/)
  })
  it('no problem when the TIN is optional and blank, or present and unique', async () => {
    expect(await tinProblem(db(null), { tin: undefined, needTin: false })).toBeNull()
    expect(await tinProblem(db(null), { tin: '456-657-670-00001', needTin: true })).toBeNull()
  })
  it('DUPLICATE_TIN (409) names the branch that already uses it', async () => {
    const r = await tinProblem(db({ branch_name: 'Makati' }), { tin: '456-657-670-00001', needTin: false })
    expect(r.status).toBe(409); expect(r.body.code).toBe('DUPLICATE_TIN'); expect(r.body.error).toContain('Makati')
  })
  it('a MongoDB validator error (121) becomes a readable message naming the fields', () => {
    const err = { code: 121, errInfo: { details: { schemaRulesNotSatisfied: [{ operatorName: 'properties', propertiesNotSatisfied: [{ propertyName: 'billing_email' }, { propertyName: 'tin' }] }] } } }
    expect(readableValidatorError(err)).toMatch(/billing_email, tin/)
    expect(readableValidatorError({ code: 121 })).toMatch(/rejected/)
  })
})
