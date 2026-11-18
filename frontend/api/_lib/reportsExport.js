// Turns report tables ({ title, cols, rows }) into CSV / PDF bytes for the Owner Reports exports.
import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'

export const MAX_EXPORT_ROWS = 10000

// CSV / formula injection: a text cell that starts with = + - @ (or a tab / CR) would run as a formula when the
// file is opened in Excel or Sheets, so it is prefixed with a single quote. Numbers we format ourselves are safe.
export function sanitizeCell(value) {
  const s = String(value ?? '')
  return /^[=+\-@\t\r]/.test(s) ? `'${s}` : s
}
const csvEscape = (s) => (/[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s)

const pesos = (c) => (c / 100).toFixed(2)
const group = (n) => Number(n).toLocaleString('en-PH')
const moneyDisplay = (c) => `PHP ${(c / 100).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` // no peso glyph in PDF fonts

function cell(c, row, forPdf) {
  const v = row[c.key]
  if (v === null || v === undefined) return forPdf ? '-' : ''
  switch (c.kind) {
    case 'money': return forPdf ? moneyDisplay(v) : pesos(v)
    case 'number': return forPdf ? group(v) : String(v)
    case 'pct': return `${v}%`
    case 'pct1': return `${v}%`
    default: return sanitizeCell(v)
  }
}

export function toCsv(tables, range) {
  const lines = []
  tables.forEach((t, i) => {
    if (tables.length > 1) lines.push(csvEscape(sanitizeCell(t.title)))
    lines.push(t.cols.map((c) => csvEscape(sanitizeCell(c.label))).join(','))
    for (const r of t.rows.slice(0, MAX_EXPORT_ROWS)) lines.push(t.cols.map((c) => csvEscape(cell(c, r, false))).join(','))
    if (i < tables.length - 1) lines.push('')
  })
  // BOM so Excel reads UTF-8 names correctly
  return Buffer.from(`﻿${lines.join('\r\n')}\r\n`, 'utf8')
}

const clean = (s) => String(s ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ')

export function toPdf(tables, range) {
  const doc = new jsPDF({ orientation: 'landscape' })
  const heading = tables.length > 1 ? 'TherapyPro - Full report' : `TherapyPro - ${tables[0].title}`
  doc.setFontSize(18); doc.setTextColor(44, 74, 62)
  doc.text(clean(heading), 14, 18)
  doc.setFontSize(10); doc.setTextColor(100)
  doc.text(`Range: ${range.from} to ${range.to}`, 14, 26)
  let y = 34
  for (const t of tables) {
    if (tables.length > 1) {
      if (y > 170) { doc.addPage(); y = 20 }
      doc.setFontSize(13); doc.setTextColor(44, 74, 62)
      doc.text(clean(t.title), 14, y)
      y += 4
    }
    autoTable(doc, {
      head: [t.cols.map((c) => clean(c.label))],
      body: t.rows.slice(0, MAX_EXPORT_ROWS).map((r) => t.cols.map((c) => clean(cell(c, r, true)))),
      startY: y,
      styles: { fontSize: 9, cellPadding: 3.5 },
      headStyles: { fillColor: [46, 94, 78], textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [243, 247, 245] },
      margin: { left: 14, right: 14 },
    })
    y = doc.lastAutoTable.finalY + 14
  }
  return Buffer.from(doc.output('arraybuffer'))
}

const FILE_BASE = { all: 'full-report', custom: 'custom-report' }
export function exportFileName(module, range, ext) {
  const base = FILE_BASE[module] || `${module}-report`
  return `${base}_${range.from}_to_${range.to}.${ext}`
}
