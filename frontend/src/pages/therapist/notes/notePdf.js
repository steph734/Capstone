import { unescapeHtml } from '../../../utils/session'

// Export / print of ONE open note. Both carry a watermark naming the
// recipient and the date, so a copy that ends up somewhere it shouldn't can be
// traced. (Guardians read in-app only and have no export.)
const LABELS = [['subjective', 'Subjective'], ['objective', 'Objective'], ['assessment', 'Assessment'], ['plan', 'Plan']]
const longDate = () => new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
export const watermarkText = (recipient) => `CONFIDENTIAL · ${recipient} · ${longDate()}`

export async function exportNotePdf(note, recipient) {
  const { jsPDF } = await import('jspdf')
  const doc = new jsPDF()
  const mark = watermarkText(recipient)
  const w = doc.internal.pageSize.getWidth()
  const h = doc.internal.pageSize.getHeight()
  const stamp = () => {
    doc.saveGraphicsState()
    doc.setGState(new doc.GState({ opacity: 0.12 }))
    doc.setTextColor(35, 76, 64)
    doc.setFontSize(26)
    for (let y = 40; y < h + 60; y += 80) doc.text(mark, w / 2, y, { angle: 35, align: 'center' })
    doc.restoreGraphicsState()
    doc.setTextColor(30)
  }
  stamp()
  doc.setFontSize(18); doc.text('SOAP Session Note', 14, 18)
  doc.setFontSize(10); doc.setTextColor(90)
  doc.text(`Patient: ${note.patientName || ''}   ·   Diagnosis: ${unescapeHtml(note.diagnosis) || '—'}   ·   Session date: ${note.date}`, 14, 25)
  doc.text(`Signed: ${note.signedAt ? new Date(note.signedAt).toLocaleString() : 'not signed'}${note.signedByName ? ` by ${note.signedByName}` : ''}`, 14, 30)
  doc.setTextColor(30)
  let y = 40
  const block = (title, text) => {
    doc.setFontSize(12); doc.setFont(undefined, 'bold')
    if (y > h - 30) { doc.addPage(); stamp(); y = 20 }
    doc.text(title, 14, y); y += 6
    doc.setFont(undefined, 'normal'); doc.setFontSize(10.5)
    for (const line of doc.splitTextToSize(unescapeHtml(text) || '—', w - 28)) {
      if (y > h - 18) { doc.addPage(); stamp(); y = 20 }
      doc.text(line, 14, y); y += 5.2
    }
    y += 5
  }
  LABELS.forEach(([k, label]) => block(label, note[k]))
  note.addenda?.forEach((a, i) => block(`Addendum ${i + 1} — ${a.reason ? unescapeHtml(a.reason) : ''}`, a.text))
  doc.setFontSize(8); doc.setTextColor(120)
  doc.text(`Exported for ${recipient} on ${longDate()}. Contains confidential health information.`, 14, h - 8)
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
