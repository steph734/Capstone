// Receipt images: checks and cleaning. Works on the bytes themselves (the MIME type a browser sends is never trusted).
import { MAX_RECEIPT_BYTES, detectImageType } from './paymentProofRules.js'

const bad = () => Object.assign(new Error('Only JPG or PNG images are allowed.'), { status: 400, code: 'INVALID_FILE_TYPE' })

// JPEG: drop EXIF/XMP (APP1), Photoshop (APP13) and comment segments. Everything needed to draw the picture stays.
function cleanJpeg(buf) {
  const out = [buf.subarray(0, 2)]
  let i = 2
  while (i < buf.length) {
    if (buf[i] !== 0xff) throw bad()
    let m = buf[i + 1]
    while (m === 0xff && i + 2 < buf.length) { i += 1; m = buf[i + 1] } // fill bytes
    if (m === 0xd9) { out.push(buf.subarray(i, i + 2)); return Buffer.concat(out) } // EOI
    if (m === 0x01 || (m >= 0xd0 && m <= 0xd8)) { out.push(buf.subarray(i, i + 2)); i += 2; continue } // no length
    if (i + 4 > buf.length) throw bad()
    const len = buf.readUInt16BE(i + 2)
    if (len < 2 || i + 2 + len > buf.length) throw bad()
    if (m === 0xda) { out.push(buf.subarray(i)); return Buffer.concat(out) } // SOS: the picture data follows, copy the rest
    if (!(m === 0xe1 || m === 0xed || m === 0xfe)) out.push(buf.subarray(i, i + 2 + len))
    i += 2 + len
  }
  throw bad()
}

// PNG: drop text chunks, the modified-time chunk and EXIF.
const PNG_DROP = new Set(['tEXt', 'zTXt', 'iTXt', 'eXIf', 'tIME'])
function cleanPng(buf) {
  const out = [buf.subarray(0, 8)]
  let i = 8
  let sawEnd = false
  while (i + 12 <= buf.length) {
    const len = buf.readUInt32BE(i)
    const type = buf.toString('latin1', i + 4, i + 8)
    const end = i + 12 + len
    if (end > buf.length) throw bad()
    if (!PNG_DROP.has(type)) out.push(buf.subarray(i, end))
    i = end
    if (type === 'IEND') { sawEnd = true; break }
  }
  if (!sawEnd) throw bad()
  return Buffer.concat(out)
}

// -> { buffer, type: "jpg" | "png", contentType }  or throws an Error with code INVALID_FILE_TYPE / FILE_TOO_LARGE / PROOF_REQUIRED
export function prepareReceipt(input) {
  if (!input || !input.length) throw Object.assign(new Error('Upload a screenshot of your receipt.'), { status: 400, code: 'PROOF_REQUIRED' })
  if (input.length > MAX_RECEIPT_BYTES) throw Object.assign(new Error('That image is larger than 5 MB. Choose a smaller screenshot.'), { status: 413, code: 'FILE_TOO_LARGE' })
  const type = detectImageType(input)
  if (!type) throw bad()
  const buffer = type === 'jpg' ? cleanJpeg(input) : cleanPng(input)
  return { buffer, type, contentType: type === 'jpg' ? 'image/jpeg' : 'image/png' }
}
