// One-off migration: encrypts SOAP notes written before encryption existed.
//
//   node api/_lib/seeders/encryptLegacyNotes.js          # dry run (counts only)
//   node api/_lib/seeders/encryptLegacyNotes.js --apply  # do it
//
// Needs MONGO_URI and SOAP_ENCRYPTION_KEY in frontend/.env. BACK UP the key
// first: encrypted notes cannot be read without it. For each legacy note this
// HTML-escapes + encrypts the four fields, sets enc/version, computes the
// SHA-256 content hash for signed notes, writes version 1 to
// soap_note_versions, and turns an old "shared with guardian" flag into a
// note_shares row (summary only — guardians no longer see full SOAP text
// unless a therapist shares chosen sections).
import { getMongo, getDb } from '../mongo.js'
import { SOAP_FIELDS, encryptField, contentHash, cleanText, isEncrypted } from '../soapCrypto.js'

process.loadEnvFile?.()
const apply = process.argv.includes('--apply')

await getMongo()
const db = await getDb()
const legacy = await db.collection('therapy_notes').find({ enc: { $ne: 1 } }).toArray()
console.log(`${legacy.length} legacy note(s) found${apply ? '' : ' (dry run — pass --apply to encrypt)'}`)

for (const n of legacy) {
  const id = String(n._id)
  const plain = Object.fromEntries(SOAP_FIELDS.map((f) => [f, n[f] ? cleanText(n[f]) : '']))
  const enc = Object.fromEntries(SOAP_FIELDS.map((f) => [f, plain[f] ? encryptField(plain[f], id, f) : null]))
  const hash = n.status === 'signed' ? contentHash(plain) : null
  console.log(`- ${id} ${n.status} ${n.patient_name || ''}`)
  if (!apply) continue
  await db.collection('therapy_notes').updateOne({ _id: n._id }, { $set: { ...enc, content_hash: hash, enc: 1, version: 1, voided: false } })
  await db.collection('soap_note_versions').insertOne({ note_id: n._id, version: 1, kind: 'migrated', ...enc, content_hash: hash, created_by: null, created_at: new Date() })
  if (n.shared_with_guardian && n.status === 'signed') {
    await db.collection('note_shares').insertOne({ note_id: n._id, patient_id: n.patient_id, sections: [], summary: n.shared_summary || null, domain: n.title || null, shared_by: null, shared_at: n.shared_at || new Date(), revoked_at: null })
  }
}
// Second pass: signature images saved as plain data URLs (notes and addenda) are encrypted too.
// Safe to run again: anything already encrypted is skipped.
const plainSigs = await db.collection('therapy_notes').find({ signature_image: { $type: 'string', $not: /^v1\./ } }, { projection: { signature_image: 1 } }).toArray()
console.log(`${plainSigs.length} plain signature image(s) found`)
if (apply) {
  for (const n of plainSigs) {
    if (isEncrypted(n.signature_image)) continue
    await db.collection('therapy_notes').updateOne({ _id: n._id }, { $set: { signature_image: encryptField(n.signature_image, String(n._id), 'signature_image') } })
  }
}
console.log(apply ? 'Done.' : 'Nothing changed.')
process.exit(0)
