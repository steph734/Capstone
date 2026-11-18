// Server-side invoice document, built only from the saved invoice and clinic settings. It never contains a diagnosis
// or any clinical data: just who is billed, what for, and how much.
import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import { dateToDay } from './finance.js'

const clean = (s) => String(s ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ')
const peso = (c) => `PHP ${(Number(c) / 100).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` // no peso glyph in PDF fonts

export function buildInvoicePdf(inv, clinic = {}) {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' })
  const W = doc.internal.pageSize.getWidth()
  const M = 40
  let y = 50
  doc.setFont('helvetica', 'bold'); doc.setFontSize(18); doc.setTextColor(46, 94, 78)
  doc.text(clean(clinic.clinic_name || 'TherapyPro'), M, y)
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(90)
  const head = [clinic.branch_name, clinic.address, clinic.phone && `Tel ${clinic.phone}`, clinic.email, clinic.website, clinic.business_tin && `TIN ${clinic.business_tin}`].filter(Boolean)
  head.forEach((l) => { y += 12; doc.text(clean(l), M, y) })

  doc.setFont('helvetica', 'bold'); doc.setFontSize(22); doc.setTextColor(27, 42, 36)
  doc.text('INVOICE', W - M, 50, { align: 'right' })
  doc.setFontSize(10); doc.setFont('helvetica', 'normal'); doc.setTextColor(60)
  const meta = [['Invoice no.', inv.invoice_no], ['Issue date', dateToDay(inv.issue_date)], ['Due date', dateToDay(inv.due_date)], ['Terms', inv.payment_terms], ['Status', inv.status]]
  meta.forEach(([k, v], i) => { doc.text(`${k}:`, W - M - 120, 70 + i * 14); doc.text(clean(v), W - M, 70 + i * 14, { align: 'right' }) })

  y = Math.max(y, 70 + meta.length * 14) + 24
  doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(46, 94, 78)
  doc.text('BILL TO', M, y)
  doc.setFont('helvetica', 'normal'); doc.setTextColor(40)
  const bc = inv.billing_contact || {}
  const bill = [bc.name, bc.address, bc.phone, bc.email, inv.patient_name && `Patient: ${inv.patient_name}${inv.patient_record_no ? ` (${inv.patient_record_no})` : ''}`].filter(Boolean)
  bill.forEach((l) => { y += 13; doc.text(clean(l), M, y) })

  autoTable(doc, {
    startY: y + 20,
    head: [['Date', 'Description', 'Qty', 'Unit price', 'Amount']],
    body: (inv.line_items || []).map((l) => [dateToDay(l.service_date) || '', clean(l.description), String(l.quantity), peso(l.unit_price), peso(l.amount)]),
    styles: { fontSize: 9, cellPadding: 6 }, headStyles: { fillColor: [46, 94, 78], textColor: 255 }, alternateRowStyles: { fillColor: [243, 247, 245] },
    columnStyles: { 2: { halign: 'right' }, 3: { halign: 'right' }, 4: { halign: 'right' } }, margin: { left: M, right: M },
  })
  y = doc.lastAutoTable.finalY + 16
  const row = (k, v, bold) => { doc.setFont('helvetica', bold ? 'bold' : 'normal'); doc.setFontSize(bold ? 12 : 10); doc.text(k, W - M - 170, y); doc.text(v, W - M, y, { align: 'right' }); y += bold ? 18 : 14 }
  doc.setTextColor(40)
  row('Subtotal', peso(inv.subtotal)); if (Number(inv.discount_amount)) row('Discount', `- ${peso(inv.discount_amount)}`); row('Tax', peso(inv.tax_amount))
  row('Total', peso(inv.total_amount), true); if (Number(inv.amount_paid)) row('Paid', peso(inv.amount_paid)); row('Balance due', peso(inv.balance_due), true)

  y += 10
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(80)
  for (const [label, text] of [['Payment instructions', inv.payment_instructions], ['Notes', inv.notes], ['Terms', inv.terms]]) {
    if (!text) continue
    doc.setFont('helvetica', 'bold'); doc.text(label, M, y); y += 12
    doc.setFont('helvetica', 'normal')
    const lines = doc.splitTextToSize(clean(text), W - M * 2); doc.text(lines, M, y); y += lines.length * 11 + 8
  }
  return doc.output('arraybuffer')
}
