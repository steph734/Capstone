// Per-branch tax & invoice details stored on the existing `branchs` collection:
//   tin, billing_email, website, payment_instructions, default_invoice_terms
// All five are OPTIONAL in the database (existing branches have none). A blank value is never written as "" (the
// collection validator's patterns reject it): it is omitted on insert and unset on update.
// The patterns and limits below mirror the live $jsonSchema validator exactly.
export const TIN_RE = /^\d{3}-\d{3}-\d{3}-\d{3,5}$/
export const BILLING_EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
export const LIMITS = { website: 200, paymentInstructions: 1000, defaultInvoiceTerms: 2000 }

// API (camelCase, like the rest of the admin branch API) -> database field
export const BILLING_FIELDS = {
  tin: 'tin',
  billingEmail: 'billing_email',
  website: 'website',
  paymentInstructions: 'payment_instructions',
  defaultInvoiceTerms: 'default_invoice_terms',
}
export const BILLING_API_KEYS = Object.keys(BILLING_FIELDS)
export const OWNER_EDITABLE = ['billingEmail', 'website', 'paymentInstructions', 'defaultInvoiceTerms']

const s = (v) => (v == null ? '' : String(v).trim())

// "456657670" + "00001" -> "456-657-670-00001": digits only, groups 3-3-3 then up to 5 (max 14 digits).
export function formatTin(input) {
  const d = String(input ?? '').replace(/\D/g, '').slice(0, 14)
  return [d.slice(0, 3), d.slice(3, 6), d.slice(6, 9), d.slice(9, 14)].filter(Boolean).join('-')
}

export const TIN_MESSAGE = 'Use the format 000-000-000-00000: a 9-digit TIN plus a 3 to 5 digit branch code.'
export const TIN_NEEDED_MESSAGE = 'Add a TIN before setting this branch to Active. Active branches can send invoices.'

// Validates the billing part of a request body. Only keys present in the body are touched (so an Owner editing the
// email does not disturb the TIN). Returns { fields, value, present } where value maps DATABASE keys to a trimmed
// string, or to undefined when the field is blank (meaning: omit / unset).
export function validateBilling(body, keys = BILLING_API_KEYS) {
  const fields = {}
  const value = {}
  const present = []
  for (const k of keys) {
    if (!(k in body)) continue
    present.push(k)
    const raw = s(body[k])
    const db = BILLING_FIELDS[k]
    if (raw === '') { value[db] = undefined; continue }
    if (k === 'tin') {
      if (!TIN_RE.test(raw)) fields.tin = TIN_MESSAGE
      else value[db] = raw
    } else if (k === 'billingEmail') {
      if (!BILLING_EMAIL_RE.test(raw)) fields.billingEmail = 'Enter a valid billing email address.'
      else value[db] = raw.toLowerCase()
    } else {
      if (raw.length > LIMITS[k]) fields[k] = `Keep this under ${LIMITS[k]} characters.`
      else value[db] = raw
    }
  }
  return { fields, value, present }
}

// Old -> new for every billing field that really changed (used for the audit trail).
export function billingChanges(before, after, keys = BILLING_API_KEYS) {
  const out = []
  for (const k of keys) {
    const db = BILLING_FIELDS[k]
    const oldV = before?.[db] ?? null
    const newV = after?.[db] ?? null
    if (oldV !== newV) out.push({ field: db, old: oldV, new: newV })
  }
  return out
}

// The five fields as the API returns them.
export function billingView(b) {
  return {
    tin: b.tin || '',
    billingEmail: b.billing_email || '',
    website: b.website || '',
    paymentInstructions: b.payment_instructions || '',
    defaultInvoiceTerms: b.default_invoice_terms || '',
  }
}

// Another branch already using this TIN? Returns that branch (so the message can name it) or null.
export async function branchUsingTin(db, tin, exceptId = null) {
  if (!tin) return null
  const f = { tin }
  if (exceptId) f._id = { $ne: exceptId }
  return db.collection('branchs').findOne(f, { projection: { branch_name: 1 } })
}

// MongoDB code 121 = the document failed the collection validator. Turn it into a readable message.
export function readableValidatorError(err) {
  const rules = err?.errInfo?.details?.schemaRulesNotSatisfied || []
  const names = []
  const walk = (n) => {
    for (const p of n?.propertiesNotSatisfied || []) names.push(p.propertyName)
    for (const r of n?.details || []) walk(r)
  }
  rules.forEach(walk)
  const missing = rules.flatMap((r) => r.missingProperties || [])
  const list = [...new Set([...names, ...missing])].filter(Boolean)
  return list.length
    ? `The database rejected these values: ${list.join(', ')}. Check their format and try again.`
    : 'The database rejected one of the values. Check the formats and try again.'
}

// Cross-checks that need the database: TIN required to set a branch Active, and TIN uniqueness across branches.
// Returns null when fine, else { status, body } ready to send.
export async function tinProblem(db, { tin, needTin, exceptId = null }) {
  if (needTin && !tin) {
    return { status: 422, body: { error: TIN_NEEDED_MESSAGE, code: 'TIN_REQUIRED_FOR_ACTIVE', fields: { tin: TIN_NEEDED_MESSAGE } } }
  }
  if (tin) {
    const other = await branchUsingTin(db, tin, exceptId)
    if (other) {
      const msg = `This TIN is already used by "${other.branch_name}".`
      return { status: 409, body: { error: msg, code: 'DUPLICATE_TIN', fields: { tin: msg } } }
    }
  }
  return null
}
