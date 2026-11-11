// A tiny spreadsheet WRITER (.xlsx and CSV). It replaces the `xlsx` (SheetJS) package, which has known
// prototype-pollution and ReDoS vulnerabilities and no fixed release on npm. This file never READS or parses a
// spreadsheet, so those parser bugs can't apply, and it adds protection against "formula injection":
//   * .xlsx: text is written as inline strings, which Excel never evaluates as a formula.
//   * CSV:   text that starts with = + - @ (or a tab / carriage return) gets a leading apostrophe, so opening the
//            CSV in Excel can't run a formula typed into, say, a patient name.
import { zipSync, strToU8 } from 'fflate'

const XML_HEAD = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n'
// eslint-disable-next-line no-control-regex
const CONTROL_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F￾￿]/g

const xmlEscape = (s) =>
  String(s).replace(CONTROL_CHARS, '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

// 0 -> A, 25 -> Z, 26 -> AA ...
function colName(i) {
  let n = i + 1
  let out = ''
  while (n > 0) { const r = (n - 1) % 26; out = String.fromCharCode(65 + r) + out; n = Math.floor((n - 1) / 26) }
  return out
}

// Excel sheet names: max 31 chars, none of \ / ? * [ ] :
const sheetTitle = (name, i) => String(name || `Sheet${i + 1}`).replace(/[\\/?*[\]:]/g, ' ').slice(0, 31) || `Sheet${i + 1}`

function sheetXml({ rows, colWidths }) {
  const cols = colWidths?.length
    ? `<cols>${colWidths.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${Number(w) || 12}" customWidth="1"/>`).join('')}</cols>`
    : ''
  const body = rows.map((row, r) => {
    const cells = (row || []).map((v, c) => {
      const ref = `${colName(c)}${r + 1}`
      if (v === null || v === undefined || v === '') return ''
      if (typeof v === 'number' && Number.isFinite(v)) return `<c r="${ref}"><v>${v}</v></c>`
      if (typeof v === 'boolean') return `<c r="${ref}" t="b"><v>${v ? 1 : 0}</v></c>`
      return `<c r="${ref}" t="inlineStr"><is><t xml:space="preserve">${xmlEscape(v)}</t></is></c>`
    }).join('')
    return `<row r="${r + 1}">${cells}</row>`
  }).join('')
  return `${XML_HEAD}<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">${cols}<sheetData>${body}</sheetData></worksheet>`
}

// sheets: [{ name, rows: [[cell, ...], ...], colWidths?: [chars, ...] }]  ->  Uint8Array of the .xlsx file
export function buildXlsx(sheets) {
  const list = sheets.length ? sheets : [{ name: 'Sheet1', rows: [] }]
  const files = {
    '[Content_Types].xml': strToU8(`${XML_HEAD}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>${list.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')}</Types>`),
    '_rels/.rels': strToU8(`${XML_HEAD}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`),
    'xl/workbook.xml': strToU8(`${XML_HEAD}<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${list.map((s, i) => `<sheet name="${xmlEscape(sheetTitle(s.name, i))}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('')}</sheets></workbook>`),
    'xl/_rels/workbook.xml.rels': strToU8(`${XML_HEAD}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${list.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('')}</Relationships>`),
  }
  list.forEach((s, i) => { files[`xl/worksheets/sheet${i + 1}.xml`] = strToU8(sheetXml(s)) })
  return zipSync(files)
}

// Saves a workbook ({ sheets }) as a file download in the browser.
export function downloadXlsx(workbook, filename) {
  const blob = new Blob([buildXlsx(workbook.sheets)], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10000)
}

// Text that Excel/Sheets could run as a formula gets a leading apostrophe (numbers are left alone).
const FORMULA_START = /^[=+\-@\t\r]/
function csvCell(v) {
  if (v === null || v === undefined) return ''
  let s = typeof v === 'number' || typeof v === 'boolean' ? String(v) : String(v)
  if (typeof v === 'string' && FORMULA_START.test(s) && !/^[-+]?\d+(\.\d+)?$/.test(s)) s = `'${s}`
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export function toCsv(rows) {
  return rows.map((row) => (row || []).map(csvCell).join(',')).join('\n')
}
