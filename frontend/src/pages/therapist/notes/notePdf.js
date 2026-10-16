import { unescapeHtml } from '../../../utils/session'

// Export / print of ONE open note. Both carry a watermark naming the
// recipient and the date, so a copy that ends up somewhere it shouldn't can be
// traced. (Guardians read in-app only and have no export.)
const LABELS = [['subjective', 'Subjective'], ['objective', 'Objective'], ['assessment', 'Assessment'], ['plan', 'Plan']]
const longDate = () => new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
export const watermarkText = (recipient) => `CONFIDENTIAL · ${recipient} · ${longDate()}`

// A4 page laid out like the on-screen notebook: spiral binding on the left, pink margin line,
// serif italic title, purple field labels, colored section pills and ruled writing lines.
const SECTION_STYLE = {
  subjective: { label: 'Subjective', fill: [178, 232, 192] },
  objective: { label: 'Objective', fill: [178, 200, 245] },
  assessment: { label: 'Assessment', fill: [245, 178, 203] },
  plan: { label: 'Plan', fill: [255, 232, 122] },
}
const PURPLE = [92, 53, 160]
const INK = [44, 44, 46]
const RULE = [200, 222, 248]

export async function exportNotePdf(note, recipient) {
  const { jsPDF } = await import('jspdf')
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const W = doc.internal.pageSize.getWidth()
  const H = doc.internal.pageSize.getHeight()
  const SPIRAL = 14 // binding strip width
  const MARGIN_X = 27 // pink margin line
  const LEFT = 33
  const RIGHT = W - 14
  const LINE_H = 7.2
  const mark = watermarkText(recipient)

  const paper = () => {
    doc.setFillColor(255, 254, 248); doc.rect(0, 0, W, H, 'F')
    doc.setFillColor(255, 240, 240); doc.rect(SPIRAL, 0, MARGIN_X - SPIRAL, H, 'F') // faint pink band
    doc.setDrawColor(255, 196, 196); doc.setLineWidth(0.7); doc.line(MARGIN_X, 0, MARGIN_X, H)
    doc.setFillColor(200, 200, 200); doc.rect(0, 0, SPIRAL, H, 'F') // binding
    doc.setFillColor(176, 176, 176); doc.rect(SPIRAL / 2 - 1.8, 0, 3.6, H, 'F')
    doc.setDrawColor(153, 153, 153); doc.setFillColor(240, 240, 240); doc.setLineWidth(0.9)
    for (let y = 16; y < H - 8; y += 26) doc.circle(SPIRAL / 2, y, 3.6, 'FD')
    doc.saveGraphicsState()
    doc.setGState(new doc.GState({ opacity: 0.08 }))
    doc.setTextColor(35, 76, 64); doc.setFont('helvetica', 'bold'); doc.setFontSize(24)
    for (let y = 50; y < H + 60; y += 80) doc.text(mark, W / 2 + 8, y, { angle: 35, align: 'center' })
    doc.restoreGraphicsState()
  }

  const ink = () => { doc.setTextColor(...INK); doc.setFont('helvetica', 'normal') }
  const newPage = () => { doc.addPage(); paper(); return 18 }

  paper()
  let y = 22
  // Title + date
  doc.setFont('times', 'bolditalic'); doc.setFontSize(23); doc.setTextColor(...INK)
  doc.text('Session Note', LEFT, y)
  const dateText = String(note.date || '')
  doc.setFont('helvetica', 'normal'); doc.setFontSize(10.5)
  const dateW = doc.getTextWidth(dateText)
  doc.setFont('helvetica', 'bold'); doc.setFontSize(9.5)
  const labelW = doc.getTextWidth('Date: ')
  const dx = RIGHT - dateW - labelW
  doc.setTextColor(...PURPLE); doc.text('Date:', dx, y)
  doc.setFont('helvetica', 'normal'); doc.setFontSize(10.5); doc.setTextColor(51, 51, 51); doc.text(dateText, dx + labelW, y)
  doc.setDrawColor(176, 176, 176); doc.setLineWidth(0.3); doc.line(dx + labelW, y + 1.5, RIGHT, y + 1.5)
  y += 12

  // Patient / Diagnosis rows
  const fieldRow = (label, value) => {
    doc.setFont('helvetica', 'bold'); doc.setFontSize(9.5); doc.setTextColor(...PURPLE); doc.text(`${label}:`, LEFT, y)
    const lw = doc.getTextWidth(`${label}: `)
    doc.setFont('helvetica', 'normal'); doc.setFontSize(10.5); doc.setTextColor(51, 51, 51); doc.text(String(value || '—'), LEFT + lw + 1, y)
    doc.setDrawColor(176, 176, 176); doc.setLineWidth(0.3); doc.line(LEFT + lw + 1, y + 1.5, RIGHT, y + 1.5)
    y += 9
  }
  fieldRow('Patient', note.patientName)
  fieldRow('Diagnosis', unescapeHtml(note.diagnosis))
  doc.setDrawColor(228, 212, 252); doc.setLineWidth(0.6); doc.line(LEFT, y, RIGHT, y)
  y += 9

  // Section pill + ruled text
  const pill = (style) => {
    doc.setFont('helvetica', 'bold'); doc.setFontSize(9.5)
    const w = doc.getTextWidth(style.label) + 9
    doc.setFillColor(...style.fill); doc.roundedRect(LEFT, y - 4.6, w, 6.6, 3.3, 3.3, 'F')
    doc.setTextColor(51, 51, 51); doc.text(style.label, LEFT + 4.5, y)
  }
  const ruled = (text, min = 2) => {
    ink(); doc.setFontSize(10.5)
    const lines = doc.splitTextToSize(unescapeHtml(text) || '', RIGHT - LEFT - 2)
    const count = Math.max(lines.length, min)
    for (let i = 0; i < count; i += 1) {
      if (y > H - 22) y = newPage()
      doc.setDrawColor(...RULE); doc.setLineWidth(0.25); doc.line(LEFT, y + 1.6, RIGHT, y + 1.6)
      if (lines[i]) { ink(); doc.setFontSize(10.5); doc.text(lines[i], LEFT + 1, y) }
      y += LINE_H
    }
  }
  const section = (style, text) => {
    if (y > H - 40) y = newPage()
    pill(style); y += 8
    ruled(text)
    y += 5
  }
  Object.keys(SECTION_STYLE).forEach((k) => section(SECTION_STYLE[k], note[k]))
  ;(note.addenda || []).forEach((a, i) => section({ label: `Addendum ${i + 1}`, fill: [228, 212, 252] }, `${a.reason ? `${unescapeHtml(a.reason)}: ` : ''}${a.text}`))

  // Therapist signature
  if (y > H - 62) y = newPage()
  doc.setDrawColor(190, 170, 230); doc.setLineDashPattern([1.5, 1.5], 0); doc.setLineWidth(0.3); doc.line(LEFT, y, RIGHT, y); doc.setLineDashPattern([], 0)
  y += 8
  doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.setTextColor(...PURPLE); doc.text('Therapist Signature', LEFT, y)
  y += 5
  if (note.signatureImage) {
    try { doc.addImage(note.signatureImage, 'PNG', LEFT, y, 52, 18) } catch { /* unreadable image: leave the line */ }
  }
  y += 21
  doc.setDrawColor(150, 150, 150); doc.setLineWidth(0.3); doc.line(LEFT, y, LEFT + 70, y)
  y += 5
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(90, 90, 90)
  doc.text(note.signedAt ? `Signed ${new Date(note.signedAt).toLocaleString('en-PH', { timeZone: 'Asia/Manila' })}${note.signedByName ? ` by ${note.signedByName}` : ''}` : 'Not signed yet', LEFT, y)

  // Footer on every page
  const pages = doc.getNumberOfPages()
  for (let p = 1; p <= pages; p += 1) {
    doc.setPage(p)
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor(130, 130, 130)
    doc.text(`Exported for ${recipient} on ${longDate()}. Contains confidential health information.   Page ${p} of ${pages}`, LEFT, H - 7)
  }
  doc.save(`SOAP-${(note.patientName || 'note').replace(/[^\w-]+/g, '_')}-${note.date}.pdf`)
}

// Opens a print-ready page with a repeating diagonal watermark. The note text
// is already HTML-escaped by the server, so it can go into the markup as-is.
export function printNote(note, recipient) {
  const win = window.open('', '_blank', 'width=820,height=900')
  if (!win) throw new Error('Allow pop-ups for this site to print.')
  const mark = watermarkText(recipient).replace(/[<>&]/g, '')
  const marks = Array.from({ length: 24 }, () => `<span>${mark}</span>`).join('')
  const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  win.document.write(`<!doctype html><html><head><title>SOAP note</title><style>
    body{font-family:Arial,sans-serif;color:#1f3d36;margin:32px;line-height:1.5}
    h1{font-size:20px;margin:0 0 4px} h2{font-size:14px;margin:18px 0 4px} p{white-space:pre-wrap;margin:0;font-size:13px}
    .meta{color:#5d7770;font-size:12px}
    .wm{position:fixed;inset:-20%;display:flex;flex-wrap:wrap;gap:60px 40px;transform:rotate(-30deg);pointer-events:none;z-index:0;opacity:.11;font-size:22px;font-weight:700;color:#234c40;align-content:flex-start}
    .wm span{white-space:nowrap} .content{position:relative;z-index:1}
    @media print{.noprint{display:none}}
  </style></head><body><div class="wm">${marks}</div><div class="content">
    <h1>SOAP Session Note</h1>
    <div class="meta">Patient: ${esc(note.patientName)} · Session date: ${esc(note.date)} · Signed: ${note.signedAt ? esc(new Date(note.signedAt).toLocaleString()) : 'not signed'}</div>
    ${LABELS.map(([k, label]) => `<h2>${label}</h2><p>${note[k] || '—'}</p>`).join('')}
    ${(note.addenda || []).map((a, i) => `<h2>Addendum ${i + 1} — ${a.reason || ''}</h2><p>${a.text}</p>`).join('')}
    <p class="meta" style="margin-top:24px">Printed for ${esc(recipient)} on ${esc(longDate())}. Confidential health information.</p>
  </div></body></html>`)
  win.document.close()
  win.focus()
  setTimeout(() => win.print(), 300)
}
