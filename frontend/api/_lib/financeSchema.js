// Schema, indexes and seed data for the finance collections. Used by scripts/finance-setup.mjs and by the integration
// tests. Nothing here talks to a database by itself.

const money = { bsonType: ['int', 'long'], minimum: 0 }
const opt = (t) => ({ bsonType: t })

// `invoices` does not exist in the live database yet; this is the validator to create it with.
export const INVOICES_VALIDATOR = {
  $jsonSchema: {
    bsonType: 'object',
    required: ['invoice_no', 'branch_id', 'patient_id', 'invoice_type', 'issue_date', 'due_date', 'line_items', 'subtotal', 'total_amount', 'amount_paid', 'balance_due', 'status', 'created_by', 'created_at'],
    properties: {
      invoice_no: { bsonType: 'string', description: 'INV-1051 style, from the counters collection.' },
      branch_id: { bsonType: 'objectId' },
      patient_id: { bsonType: 'objectId' },
      billing_contact: {
        bsonType: 'object',
        properties: { name: opt('string'), phone: opt('string'), email: opt('string'), address: opt('string'), is_guardian: opt('bool') },
      },
      invoice_type: { enum: ['Session', 'Custom'] },
      issue_date: opt('date'),
      due_date: opt('date'),
      payment_terms: { enum: ['Due on receipt', 'Net 7', 'Net 15', 'Net 30', 'Custom'] },
      line_items: {
        bsonType: 'array',
        items: {
          bsonType: 'object',
          required: ['description', 'quantity', 'unit_price', 'amount'],
          properties: {
            service_date: opt('date'), description: opt('string'), service_code: opt('string'),
            quantity: { bsonType: ['int', 'long', 'double'] }, unit_price: money, amount: money, appointment_id: opt('objectId'),
          },
        },
      },
      billed_appointment_ids: { bsonType: 'array', items: { bsonType: 'objectId' }, description: 'Sessions on this invoice; unique across non-void invoices.' },
      subtotal: money, discount_amount: money, tax_amount: money, total_amount: money, amount_paid: money, balance_due: money,
      status: { enum: ['Draft', 'Pending', 'Paid', 'Void'], description: 'Overdue is never stored: it is derived from due_date.' },
      payment_instructions: opt('string'), notes: opt('string'), terms: opt('string'),
      // header details frozen when the invoice is created (TIN, billing email, website, branch name/address/phone)
      clinic_snapshot: { bsonType: 'object', properties: { clinic_name: opt('string'), tin: opt('string'), billing_email: opt('string'), website: opt('string'), branch_name: opt('string'), address: opt('string'), phone: opt('string'), snapshot_at: opt('date') } },
      sent_at: opt('date'), sent_to: opt('string'), paid_at: opt('date'), payment_id: opt('objectId'),
      void_reason: opt('string'), idempotency_key: opt('string'),
      created_by: opt('objectId'), created_at: opt('date'), updated_at: opt('date'),
    },
  },
}

// Indexes. The partial unique index on line_items.appointment_id is what makes "a session can be on only one
// non-void invoice" hold even for simultaneous requests.
export const INDEXES = {
  invoices: [
    { key: { invoice_no: 1 }, options: { unique: true, name: 'uniq_invoice_no' } },
    { key: { branch_id: 1, issue_date: -1 }, options: { name: 'branch_issue' } },
    { key: { patient_id: 1, issue_date: -1 }, options: { name: 'patient_issue' } },
    { key: { status: 1, due_date: 1 }, options: { name: 'status_due' } },
    { key: { idempotency_key: 1 }, options: { unique: true, sparse: true, name: 'uniq_idempotency_key' } },
    // billed_appointment_ids holds ONLY real appointment ids (never null), so a unique multikey index is safe.
    { key: { billed_appointment_ids: 1 }, options: { unique: true, name: 'uniq_billed_session', partialFilterExpression: { billed_appointment_ids: { $exists: true }, status: { $in: ['Draft', 'Pending', 'Paid'] } } } },
  ],
  expenses: [
    { key: { reference_no: 1 }, options: { unique: true, name: 'uniq_reference_no' } },
    { key: { branch_id: 1, bill_date: -1 }, options: { name: 'branch_bill_date' } },
    { key: { payment_status: 1, due_date: 1 }, options: { name: 'status_due' } },
    { key: { expense_type: 1, utility_type: 1, bill_date: -1 }, options: { name: 'type_utility_date' } },
  ],
  vendors: [{ key: { vendor_name: 1 }, options: { unique: true, name: 'uniq_vendor_name' } }],
  financial_audit_logs: [{ key: { entity: 1, entity_id: 1, created_at: -1 }, options: { name: 'entity_trail' } }],
}

export const VENDOR_SEED = [
  { vendor_name: 'Davao Light', vendor_type: 'Utility', utility_type: 'Electricity', status: 'Active' },
  { vendor_name: 'Davao City Water District', vendor_type: 'Utility', utility_type: 'Water', status: 'Active' },
]

// Counters start here so the first invoice is INV-1001 and the first bill number is BILL-0001.
export const COUNTER_SEED = { invoice_no: 1000, expense_BILL: 0, expense_INT: 0, expense_RENT: 0, expense_SUP: 0, expense_EXP: 0 }

export const CLINIC_SEED = {
  _id: 'clinic', clinic_name: 'TherapyPro Therapy Clinic', business_tin: '', email: '', website: '', logo_url: '',
  payment_instructions: '', default_terms: 'Payment is due by the date shown on this invoice.',
}

// The ONE change to an existing collection: let `payments` hold invoice payments. Run it in Compass / mongosh.
export const PAYMENTS_COLLMOD = (currentValidator) => {
  const v = JSON.parse(JSON.stringify(currentValidator))
  const props = v.$jsonSchema.properties
  if (!props.payment_for.enum.includes('invoice')) props.payment_for.enum.push('invoice')
  props.invoice_id = { bsonType: 'objectId', description: 'Reference to the invoice being paid for. Set when payment_for is invoice.' }
  return { collMod: 'payments', validator: v, validationLevel: 'moderate', validationAction: 'error' }
}
