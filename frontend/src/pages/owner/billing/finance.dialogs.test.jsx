import { describe, expect, it } from 'vitest'
import { renderToString } from 'react-dom/server'
import { ConfirmDialog, SuccessDialog, SummaryRows } from './FinanceDialogs'

const html = (el) => renderToString(el).replace(/<!-- -->/g, '')

describe('confirmation and success dialogs', () => {
  it('confirm shows the summary, a way back, and the confirm button in the dark-green uppercase style', () => {
    const out = html(<ConfirmDialog title="Save this expense?" confirmLabel="Yes, save expense" onCancel={() => {}} onConfirm={() => {}}><SummaryRows rows={[['Vendor', 'Davao Light'], ['Total', '₱7,749.00'], null]} /></ConfirmDialog>)
    for (const s of ['Save this expense?', 'Go back', 'Yes, save expense', 'fin-btn-cta', 'Davao Light', '₱7,749.00', 'role="dialog"', 'aria-modal="true"']) expect(out).toContain(s)
  })
  it('the confirm button is disabled and says Saving… while the request is running', () => {
    const out = html(<ConfirmDialog title="x" confirmLabel="Yes" busy onCancel={() => {}} onConfirm={() => {}} />)
    expect(out).toContain('Saving…'); expect(out).toMatch(/<button[^>]*disabled[^>]*>Saving…/)
  })
  it('success shows a status message with the record details and a Done button', () => {
    const out = html(<SuccessDialog title="Expense saved" onDone={() => {}}><SummaryRows rows={[['Reference', 'BILL-0001']]} /></SuccessDialog>)
    for (const s of ['Expense saved', 'BILL-0001', 'Done', 'role="status"', '✓']) expect(out).toContain(s)
  })
  it('a warning success (email or file failed) uses the "!" icon', () => {
    expect(html(<SuccessDialog title="Invoice saved, not sent" tone="warn" onDone={() => {}} />)).toContain('!')
  })
})
