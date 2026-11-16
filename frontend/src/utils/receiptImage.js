// Browser-side checks for the receipt screenshot. The server checks again (by the file's bytes); this is only so the
// patient hears about a problem before sending anything.
import { MAX_RECEIPT_BYTES, detectImageType, validateReceiptMeta } from '../../api/_lib/paymentProofRules'

// -> { ok, file, error, code }   (type is read from the file's first bytes, not from its name or MIME type)
export async function checkReceiptFile(file) {
  if (!file) return { ok: false, code: 'PROOF_REQUIRED', error: 'Upload a screenshot of your receipt.' }
  let bytes = null
  try { bytes = new Uint8Array(await file.slice(0, 12).arrayBuffer()) } catch { /* unreadable: the size check below still runs */ }
  const meta = validateReceiptMeta({ size: file.size, bytes: bytes || undefined })
  if (!meta.ok) return { ok: false, code: meta.code, error: meta.error, file }
  if (!bytes) return { ok: false, code: 'INVALID_FILE_TYPE', error: 'We could not read that file. Choose another screenshot.', file }
  return { ok: true, file, type: detectImageType(bytes) }
}

// Vercel rejects request bodies over about 4.5 MB. A 4.5 to 5 MB screenshot is therefore re-saved as a smaller JPEG
// before upload (still readable, EXIF is dropped by the server anyway). Anything smaller is sent untouched.
const UPLOAD_SAFE_BYTES = 4 * 1024 * 1024
export async function prepareForUpload(file) {
  if (file.size <= UPLOAD_SAFE_BYTES || typeof createImageBitmap !== 'function') return file
  try {
    const bitmap = await createImageBitmap(file)
    const scale = Math.min(1, 2600 / Math.max(bitmap.width, bitmap.height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(bitmap.width * scale)
    canvas.height = Math.round(bitmap.height * scale)
    const ctx = canvas.getContext('2d')
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
    for (const q of [0.88, 0.75, 0.6]) {
      const blob = await new Promise((r) => canvas.toBlob(r, 'image/jpeg', q))
      if (blob && blob.size <= UPLOAD_SAFE_BYTES) return new File([blob], file.name.replace(/\.\w+$/, '') + '.jpg', { type: 'image/jpeg' })
    }
  } catch { /* fall through: send the original and let the server answer */ }
  return file
}

export { MAX_RECEIPT_BYTES }
