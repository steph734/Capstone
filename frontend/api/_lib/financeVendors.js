import { COL, FinanceError, validationError, rejectUnknown, str, escapeRegex, financeAudit } from './finance.js'

const VENDOR_TYPES = ['Utility', 'Supplier', 'Landlord', 'Other']
const UTILITY_TYPES = ['Electricity', 'Water', 'Internet', 'Rent', 'Other']

const serialize = (v) => ({ id: String(v._id), vendor_name: v.vendor_name, vendor_type: v.vendor_type, utility_type: v.utility_type || null, contact_number: v.contact_number || null, address: v.address || null, status: v.status })

// Active vendors for the biller dropdown, optionally filtered by type / utility type / search text.
export async function listVendors(db, q) {
  const f = { status: 'Active' }
  if (q.vendor_type) { if (!VENDOR_TYPES.includes(q.vendor_type)) throw validationError({ vendor_type: 'Unknown vendor type.' }); f.vendor_type = q.vendor_type }
  if (q.utility_type) { if (!UTILITY_TYPES.includes(q.utility_type)) throw validationError({ utility_type: 'Unknown utility type.' }); f.utility_type = q.utility_type }
  if (q.q) f.vendor_name = new RegExp(escapeRegex(str(q.q, 80)), 'i')
  const list = await db.collection(COL.vendors).find(f).sort({ vendor_name: 1 }).limit(200).toArray()
  return list.map(serialize)
}

export async function createVendor(db, ctx, body) {
  const e = {}
  rejectUnknown(body, ['vendor_name', 'vendor_type', 'utility_type', 'contact_number', 'address'], e)
  const name = str(body.vendor_name, 120)
  if (!name) e.vendor_name = 'Enter the vendor name.'
  if (!VENDOR_TYPES.includes(body.vendor_type)) e.vendor_type = 'Choose a vendor type.'
  if (body.vendor_type === 'Utility' && !UTILITY_TYPES.includes(body.utility_type)) e.utility_type = 'Choose the type of utility.'
  if (body.vendor_type !== 'Utility' && body.utility_type) e.utility_type = 'Only utility vendors have a utility type.'
  if (Object.keys(e).length) throw validationError(e)
  // Names are unique ignoring case, so "davao light" cannot be added next to "Davao Light".
  const dup = await db.collection(COL.vendors).findOne({ vendor_name: new RegExp(`^${escapeRegex(name)}$`, 'i') }, { projection: { _id: 1 } })
  if (dup) throw new FinanceError('VALIDATION_ERROR', 'A vendor with that name already exists.', 422, { fields: { vendor_name: 'Already exists.' } })
  const doc = {
    vendor_name: name, vendor_type: body.vendor_type, ...(body.vendor_type === 'Utility' ? { utility_type: body.utility_type } : {}),
    ...(str(body.contact_number, 40) ? { contact_number: str(body.contact_number, 40) } : {}), ...(str(body.address, 200) ? { address: str(body.address, 200) } : {}),
    status: 'Active', created_at: new Date(),
  }
  const { insertedId } = await db.collection(COL.vendors).insertOne(doc)
  await financeAudit(db, ctx, { action: 'vendor.create', entity: 'vendor', entityId: insertedId })
  return serialize({ ...doc, _id: insertedId })
}
