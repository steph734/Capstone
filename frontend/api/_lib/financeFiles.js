// Bill / receipt copies for expenses. PDF, JPG or PNG only, max 5 MB each, max 5 per expense. The file type is decided
// from the file's first bytes, never from its name or the browser-supplied MIME type. Files live in GridFS under a random
// name and are served only through an authenticated route; the expense stores a reference, never a public URL.
import crypto from 'node:crypto'
import mongoose from 'mongoose'
import { COL, FinanceError, toOid, financeAudit } from './finance.js'
import { getExpense } from './expensesCore.js'

export const MAX_FILE_BYTES = 5 * 1024 * 1024
export const MAX_FILES_PER_EXPENSE = 5
export const BUCKET = 'expense_attachments'
const EXT = { 'application/pdf': 'pdf', 'image/jpeg': 'jpg', 'image/png': 'png' }

export function sniffMime(buf) {
  if (!buf || buf.length < 4) return null
  if (buf.subarray(0, 4).toString('latin1') === '%PDF') return 'application/pdf'
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg'
  if (buf.length >= 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png'
  return null
}

// Display name only; the stored name is random.
export const safeName = (n) => String(n || 'file').replace(/[\\/\0\r\n"]/g, '_').replace(/\s+/g, ' ').trim().slice(0, 120) || 'file'

export function checkFile(file) {
  if (!file) throw new FinanceError('VALIDATION_ERROR', 'Choose a file to upload.', 422, { fields: { file: 'Required.' } })
  if (file.size > MAX_FILE_BYTES) throw new FinanceError('FILE_TOO_LARGE', 'Each file must be 5 MB or smaller.', 413)
  const mime = sniffMime(file.buffer)
  if (!mime) throw new FinanceError('UNSUPPORTED_FILE', 'Only PDF, JPG or PNG files are accepted.', 415)
  return mime
}

export async function addAttachment(db, ctx, id, file) {
  const exp = await getExpense(db, id)
  if (exp.record_status === 'Voided') throw new FinanceError('ALREADY_VOID', 'A voided expense cannot be changed.', 409)
  if ((exp.attachments || []).length >= MAX_FILES_PER_EXPENSE) throw new FinanceError('VALIDATION_ERROR', `At most ${MAX_FILES_PER_EXPENSE} files per expense.`, 422, { fields: { file: 'Too many files.' } })
  const mime = checkFile(file)
  const storedName = `${crypto.randomBytes(16).toString('hex')}.${EXT[mime]}`
  const bucket = new mongoose.mongo.GridFSBucket(db, { bucketName: BUCKET })
  const fileId = new mongoose.Types.ObjectId()
  await new Promise((resolve, reject) => {
    const s = bucket.openUploadStreamWithId(fileId, storedName, { metadata: { contentType: mime, expense_id: exp._id } })
    s.on('error', reject).on('finish', resolve)
    s.end(file.buffer)
  })
  const att = { file_name: safeName(file.originalname), file_url: `gridfs:${BUCKET}/${fileId}`, mime_type: mime, size_bytes: file.size, file_id: fileId }
  // The count guard makes "max 5" hold even for simultaneous uploads.
  const res = await db.collection(COL.expenses).updateOne(
    { _id: exp._id, record_status: 'Active', [`attachments.${MAX_FILES_PER_EXPENSE - 1}`]: { $exists: false } },
    { $push: { attachments: att }, $set: { updated_at: new Date() } },
  )
  if (!res.matchedCount) {
    await bucket.delete(fileId).catch(() => {})
    throw new FinanceError('VALIDATION_ERROR', `At most ${MAX_FILES_PER_EXPENSE} files per expense.`, 422, { fields: { file: 'Too many files.' } })
  }
  await financeAudit(db, ctx, { action: 'expense.attach', entity: 'expense', entityId: exp._id })
  return { index: (exp.attachments || []).length, file_name: att.file_name, mime_type: mime, size_bytes: file.size }
}

export async function streamAttachment(db, id, index, res) {
  const exp = await getExpense(db, id)
  const att = (exp.attachments || [])[Number(index)]
  if (!att?.file_id) throw new FinanceError('NOT_FOUND', 'File not found.', 404)
  const bucket = new mongoose.mongo.GridFSBucket(db, { bucketName: BUCKET })
  res.set('Content-Type', att.mime_type || 'application/octet-stream')
  res.set('Content-Disposition', `inline; filename="${safeName(att.file_name)}"`)
  res.set('X-Content-Type-Options', 'nosniff')
  res.set('Cache-Control', 'private, no-store')
  bucket.openDownloadStream(toOid(att.file_id)).on('error', () => { if (!res.headersSent) res.status(404).end(); else res.end() }).pipe(res)
}
