// UI state tests for the request review (run with:  npx vitest run src/components/requests).
// The components are rendered to static HTML (there is no browser DOM in this project's tests), so these check the STATE each screen
// opens in: what is locked, what is disabled, what text shows. The server tests cover what happens on a click.
import { describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'

vi.mock('react-dom', async (orig) => ({ ...(await orig()), createPortal: (node) => node })) // modals render in place
vi.stubGlobal('document', { body: {} }) // ModalShell portals into document.body (the portal itself is mocked below)
vi.mock('../../utils/session', () => ({ authFetch: vi.fn() }))

const { default: RequestReviewCard } = await import('./RequestReviewCard')
const { default: DeclineModal } = await import('./DeclineModal')
const { default: PaymentNotReceivedModal } = await import('./PaymentNotReceivedModal')
const { default: Collapsible } = await import('./Collapsible')
const { validateDecline, validateReject, declinePreview, checksOk } = await import('../../../api/_lib/requestReviewRules')

const payment = { attemptId: 'a1', state: 'proof_submitted', method: 'gcash', methodLabel: 'GCash QR', amount: 300, referenceDisplay: '5456 656 574 544', referenceLast4: '4544', submittedAt: '2026-11-16T03:53:00Z', holdText: 'Nov 19, 11:53 AM', holdExpired: false, receiptUrl: null, rejectReason: null, rejectNote: null, rejectedAt: null }
const base = { id: 'r1', patientName: 'Miguel Tayao', guardianName: 'Rene', condition: 'Speech Delay', dateTab: 'Tue, Nov 17', dateLong: 'Tuesday, November 17, 2026', dateShort: 'Nov 17', whenLabel: 'Tue, Nov 17, 2026 · 11:00 AM – 12:00 PM', timeLabel: '11:00 AM – 12:00 PM', timeStart: '11:00 AM', sessionType: 'Cognitive', clinic: 'Main Clinic', amount: 300, requestedAt: '2026-11-16T03:53:00Z' }
const card = (r) => renderToStaticMarkup(<RequestReviewCard request={{ ...base, ...r }} onPaymentReceived={() => {}} onNotReceived={() => {}} onAccept={() => {}} onDecline={() => {}} />)
// the opening tag of the button whose label contains `text`
const buttonFor = (html, text) => html.split('<button').slice(1).map((b) => `<button${b.split('</button>')[0]}`).find((b) => b.includes(text))

describe('request card', () => {
  const check = card({ phase: 'check_payment', payment })

  it('step 1: "Payment received" is disabled until both boxes are ticked; "Payment not received" is always enabled', () => {
    expect(buttonFor(check, 'Payment received')).toMatch(/ disabled=""/)
    expect(buttonFor(check, 'Payment not received')).not.toMatch(/ disabled=""/)
    expect(check).toContain('Before you confirm')
    expect(check).toContain('I can see ₱300.00 in my GCash / Maya')
    expect(check).toContain('The reference number matches the receipt')
    expect(check).toContain('Tick both boxes')
  })

  it('step 2 stays LOCKED (lock icons, disabled buttons) until the payment is verified', () => {
    const accept = buttonFor(check, 'Accept'); const decline = buttonFor(check, 'Decline')
    expect(accept).toMatch(/ disabled=""/); expect(decline).toMatch(/ disabled=""/)
    expect(accept).toContain('lucide-lock'); expect(decline).toContain('lucide-lock')
    expect(check).toContain('Check the payment first. These buttons unlock afterwards.')
  })

  it('once verified: green "Payment received" strip, step 2 unlocked, no check boxes', () => {
    const done = card({ phase: 'decide', payment: { ...payment, state: 'verified' } })
    expect(done).toContain('Payment received'); expect(done).toContain('Ref ending 4544')
    expect(buttonFor(done, 'Accept')).not.toMatch(/ disabled=""/); expect(buttonFor(done, 'Decline')).not.toMatch(/ disabled=""/)
    expect(done).not.toContain('Before you confirm')
    expect(done).toContain('Ready for your decision')
  })

  it('"Ask for new proof": shows "Waiting for new proof" and the reason, with every button disabled', () => {
    const w = card({ phase: 'waiting_proof', payment: { ...payment, state: 'rejected', rejectReason: 'amount_wrong', rejectNote: 'Only ₱250 arrived', rejectedAt: '2026-11-16T04:44:00Z' } })
    expect(w).toContain('Waiting for new proof'); expect(w).toContain('The amount is wrong'); expect(w).toContain('Only ₱250 arrived'); expect(w).toContain('Asked for new proof')
    for (const t of ['Payment received', 'Payment not received', 'Accept', 'Decline']) expect(buttonFor(w, t)).toMatch(/ disabled=""/)
  })

  it('a cash request has no payment panel and step 2 is open', () => {
    const cash = card({ phase: 'decide', payment: null })
    expect(cash).not.toContain('Payment to check'); expect(cash).toContain('Cash at the clinic')
    expect(buttonFor(cash, 'Accept')).not.toMatch(/ disabled=""/)
  })

  it('both the card and its payment panel are collapsible with aria-expanded / aria-controls', () => {
    expect(check).toContain('aria-expanded="true"')
    expect(check).toMatch(/aria-controls="[^"]+"/)
    expect(check).toContain('Collapse payment details')
  })
})

describe('collapsible', () => {
  it('closed: aria-expanded false, the body is inert and hidden from screen readers; the toggle points at it', () => {
    const html = renderToStaticMarkup(<Collapsible defaultOpen={false} renderHeader={({ toggleProps }) => <button {...toggleProps}>Toggle</button>}><p>Inside</p></Collapsible>)
    expect(html).toContain('aria-expanded="false"'); expect(html).toContain('inert=""'); expect(html).toContain('aria-hidden="true"')
    const id = html.match(/aria-controls="([^"]+)"/)[1]
    expect(html).toContain(`id="${id}"`)
    expect(html).toContain('motion-reduce:transition-none')
  })
})

describe('decline modal', () => {
  const open = (extra = {}) => renderToStaticMarkup(<DeclineModal request={{ ...base, payment: { ...payment, state: 'verified' }, ...extra }} therapist="Edward Briones" onCancel={() => {}} onConfirm={() => {}} />)

  it('opens with NO reason: red outline, the error, a pale disabled "Decline & send email", and the empty preview', () => {
    const html = open()
    expect(buttonFor(html, 'Decline &amp; send email')).toMatch(/ disabled=""/)
    expect(html).toContain('Please choose a reason before declining.')
    expect(html).toContain('aria-invalid="true"')
    expect(html).toContain('Choose a reason to see the email the guardian will receive.')
    for (const r of ["I&#x27;m not available at this time", 'Payment couldn&#x27;t be verified', 'Other (please explain)']) expect(html).toContain(r)
  })
  it('the ₱ refund reminder shows only when the payment was verified', () => {
    expect(open()).toContain('Remember to return it to the guardian')
    expect(open({ payment: null })).not.toContain('Remember to return it')
  })
  it('is a real radiogroup with required reason', () => {
    const html = open()
    expect(html).toContain('role="radiogroup"'); expect(html).toContain('role="radio"'); expect(html).toContain('role="dialog"'); expect(html).toContain('aria-modal="true"')
  })
})

describe('payment not received modal', () => {
  const open = (p = {}) => renderToStaticMarkup(<PaymentNotReceivedModal request={{ ...base, payment: { ...payment, ...p } }} onCancel={() => {}} onSubmit={() => {}} />)
  it('opens with "Ask for new proof" selected and the hold time in its text', () => {
    const html = open()
    expect(html).toContain('Mark not received &amp; send'); expect(html).toContain('The guardian can resubmit until Nov 19, 11:53 AM. The slot stays held.')
    expect(html).toContain('The amount didn&#x27;t arrive')
  })
  it('after the hold expired: only "Decline" is possible, with the helper text', () => {
    const html = open({ holdExpired: true })
    expect(html).toContain('The hold has expired, so you can only decline.'); expect(html).toContain('Decline &amp; send')
    expect(html).not.toContain('Mark not received &amp; send')
  })
})

describe('shared rules', () => {
  it('the decline reason is required and "Other" needs a message', () => {
    expect(validateDecline({}).ok).toBe(false)
    expect(validateDecline({ reason: 'other' })).toMatchObject({ ok: false, code: 'MESSAGE_REQUIRED_FOR_OTHER' })
    expect(validateDecline({ reason: 'other', message: 'Away' }).ok).toBe(true)
    expect(validateDecline({ reason: 'not_available' }).ok).toBe(true)
  })
  it('the live preview follows the reason and message', () => {
    const p = declinePreview({ therapist: 'Edward Briones', patient: 'Miguel Tayao', dateShort: 'Nov 17', dateTab: 'Tue, Nov 17', timeStart: '11:00 AM', reason: 'not_available', message: 'Sorry, I am away.' })
    expect(p.subject).toBe('Your appointment request on Nov 17 was declined')
    expect(p.body).toBe("Edward Briones declined Miguel's appointment on Tue, Nov 17 at 11:00 AM.")
    expect(p).toMatchObject({ reasonLabel: "I'm not available at this time", message: 'Sorry, I am away.' })
  })
  it('both checks are needed to verify, and notes are length limited', () => {
    expect(checksOk({ amountSeen: true, referenceMatches: true })).toBe(true)
    expect(checksOk({ amountSeen: true })).toBe(false)
    expect(checksOk(null)).toBe(false)
    const v = validateReject({ reason: 'amount_wrong', note: 'x'.repeat(900), nextAction: 'request_new_proof' })
    expect(v.value.note).toHaveLength(300)
  })
})
