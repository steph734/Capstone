// Tax & billing fields of a branch (Add / Edit branch, step 1). Pure helpers so they can be unit tested.
// The pattern and limits are the same as the live `branchs` collection validator and the server.
export const TIN_RE = /^\d{3}-\d{3}-\d{3}-\d{3,5}$/
export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
export const LIMITS = { website: 200, paymentInstructions: 1000, defaultInvoiceTerms: 2000 }
export const TIN_NEEDED = 'Add a TIN before setting this branch to Active. Active branches can send invoices.'
export const TIN_FORMAT = 'Use the format 000-000-000-00000: a 9-digit TIN plus a 3 to 5 digit branch code.'

// Auto-inserts hyphens while typing (3-3-3 then 3 to 5 digits) and drops anything that is not a digit.
export function formatTin(input) {
  const d = String(input ?? '').replace(/\D/g, '').slice(0, 14)
  return [d.slice(0, 3), d.slice(3, 6), d.slice(6, 9), d.slice(9, 14)].filter(Boolean).join('-')
}

// Show a character counter once the text is within 20% of its limit.
export const nearLimit = (len, max) => len >= Math.floor(max * 0.8)

export const billingFromBranch = (b) => ({
  tin: b?.tin || '', billingEmail: b?.billingEmail || '', website: b?.website || '',
  paymentInstructions: b?.paymentInstructions || '', defaultInvoiceTerms: b?.defaultInvoiceTerms || '',
})

// `needTin`: the branch is being set Active (or is Active and already has a TIN), so the TIN is required.
export function billingErrors(f, { needTin }) {
  const e = {}
  const tin = f.tin.trim()
  if (!tin) { if (needTin) e.tin = TIN_NEEDED } else if (!TIN_RE.test(tin)) e.tin = TIN_FORMAT
  const email = f.billingEmail.trim()
  if (email && !EMAIL_RE.test(email)) e.billingEmail = 'Enter a valid billing email address.'
  if (f.website.trim().length > LIMITS.website) e.website = `Keep the website under ${LIMITS.website} characters.`
  if (f.paymentInstructions.length > LIMITS.paymentInstructions) e.paymentInstructions = `Keep this under ${LIMITS.paymentInstructions} characters.`
  if (f.defaultInvoiceTerms.length > LIMITS.defaultInvoiceTerms) e.defaultInvoiceTerms = `Keep this under ${LIMITS.defaultInvoiceTerms} characters.`
  return e
}

// Whether the TIN is required right now. New branches and drafts need it only for Active; a live branch that already has
// a TIN cannot lose it; the older Active branches without one stay editable.
export function tinRequired({ editing, branch, status }) {
  const isDraftOrNew = !editing || branch?.status === 'Draft'
  if (isDraftOrNew) return status === 'Active'
  return branch?.status === 'Active' && Boolean(branch?.tin)
}

// Changing the TIN of an Active branch needs a confirmation (invoices already sent keep the old TIN).
export const tinChangeNeedsConfirm = ({ editing, branch, tin }) =>
  editing && branch?.status === 'Active' && Boolean(branch?.tin) && tin.trim() !== branch.tin

export const payloadBilling = (f) => ({
  tin: f.tin.trim(), billingEmail: f.billingEmail.trim(), website: f.website.trim(),
  paymentInstructions: f.paymentInstructions.trim(), defaultInvoiceTerms: f.defaultInvoiceTerms.trim(),
})
