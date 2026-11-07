import { useEffect, useRef, useState } from 'react'

// The "Payment submitted" screen for GCash / Maya QR payments (right column of the checkout modal).
// The money was sent outside the app, so nothing is confirmed yet: the booked therapist checks their wallet and
// verifies it. This screen tells the patient where things stand and lets them add details to get confirmed faster.
//
//   1. header         amber clock, "usually within X hours"  (X comes from the server: QR_REVIEW_HOURS)
//   2. progress       Payment sent -> Being verified (current) -> Booking confirmed
//   3. slot card      the reserved slot, with the REAL hold expiry from the server
//   4. details card   optional reference number (digits, auto-grouped, validated) + optional screenshot
//   5. footer         "Go to my appointments"

const GREEN = '#15803D'
const DARK = '#2E5E4E'
const MINT = '#F3F7F5'
const AMBER = '#E8A317'
const BROWN = '#9A5A12'

const MAX_BYTES = 5 * 1024 * 1024
const OK_TYPES = ['image/jpeg', 'image/png']

// "1234567890123" -> "1234 567 890 123" (groups of 4-3-3-3, then 3s for longer numbers)
export function formatReference(raw) {
  const d = String(raw || '').replace(/\D/g, '').slice(0, 16)
  const parts = []
  let i = 0
  for (const size of [4, 3, 3, 3, 3]) {
    if (i >= d.length) break
    parts.push(d.slice(i, i + size)); i += size
  }
  return parts.join(' ')
}
export const referenceDigits = (formatted) => String(formatted || '').replace(/\D/g, '')

// Same rule as the server (api/_lib/paymentAttempts.js): GCash is exactly 13 digits, Maya 10 to 16.
export function referenceError(formatted, isMaya) {
  const n = referenceDigits(formatted).length
  if (!n) return ''
  if (isMaya) return n >= 10 && n <= 16 ? '' : 'Enter the reference number from your Maya receipt (digits only).'
  return n === 13 ? '' : 'Enter the 13-digit reference number from your GCash receipt.'
}

const manila = (d, opts) => new Date(d).toLocaleString('en-US', { timeZone: 'Asia/Manila', ...opts })
const sentLabel = (d) => `${manila(d, { month: 'short', day: 'numeric' })} · ${manila(d, { hour: 'numeric', minute: '2-digit' })}`
const dayLabel = (d) => new Date(d).toLocaleDateString('en-US', { timeZone: 'UTC', weekday: 'short', month: 'short', day: 'numeric' })

// "11:00 - 12:00 PM" -> "11:00 AM – 12:00 PM" when both halves share the meridiem
function timeRange(label) {
  const m = String(label || '').match(/^\s*(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})\s*(AM|PM)\s*$/i)
  if (!m) return String(label || '').replace(' - ', ' – ')
  const [, a, b, mer] = m
  const sh = Number(a.split(':')[0])
  const eh = Number(b.split(':')[0])
  const endMer = mer.toUpperCase()
  // "11:00 - 12:00 PM" is 11 AM to 12 PM; "10:00 - 1:00 PM" is 10 AM to 1 PM; "1:00 - 2:00 PM" stays PM.
  const startMer = endMer === 'PM' && sh !== 12 && (sh > eh || (sh === 11 && eh === 12)) ? 'AM' : endMer
  return `${a} ${startMer} – ${b} ${endMer}`
}

function heldLabel(expiresAt) {
  if (!expiresAt) return 'Held'
  const hrs = (new Date(expiresAt).getTime() - Date.now()) / 3600000
  if (hrs <= 0) return 'Expired'
  if (hrs < 1) return 'Held <1 hr'
  const n = Math.round(hrs)
  return `Held ${n} hr${n === 1 ? '' : 's'}`
}

const ic = { fill: 'none', stroke: 'currentColor', strokeLinecap: 'round', strokeLinejoin: 'round' }
const Check = ({ s = 16 }) => (<svg width={s} height={s} viewBox="0 0 24 24" strokeWidth="3.2" {...ic} aria-hidden="true"><polyline points="20 6 9 17 4 12" /></svg>)
const Clock = ({ s = 16 }) => (<svg width={s} height={s} viewBox="0 0 24 24" strokeWidth="2.4" {...ic} aria-hidden="true"><circle cx="12" cy="12" r="9" /><polyline points="12 7 12 12 15 14" /></svg>)
const Calendar = () => (<svg width="20" height="20" viewBox="0 0 24 24" strokeWidth="2" {...ic} aria-hidden="true"><rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>)
const Upload = () => (<svg width="22" height="22" viewBox="0 0 24 24" strokeWidth="2" {...ic} aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" /></svg>)
const Close = () => (<svg width="14" height="14" viewBox="0 0 24 24" strokeWidth="3" {...ic} aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>)

// Smaller copy of the file before upload (a phone screenshot can be several MB); always sent as JPEG.
async function shrinkImage(file, max = 1000) {
  const url = URL.createObjectURL(file)
  try {
    const img = await new Promise((resolve, reject) => { const i = new Image(); i.onload = () => resolve(i); i.onerror = reject; i.src = url })
    const scale = Math.min(1, max / Math.max(img.width, img.height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(img.width * scale); canvas.height = Math.round(img.height * scale)
    canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height)
    return canvas.toDataURL('image/jpeg', 0.72)
  } finally { URL.revokeObjectURL(url) }
}

export default function PendingVerification({ attempt, isMaya, fallbackSession, fallbackTherapist, headingRef, onSend, onDone }) {
  const hours = attempt?.reviewHours ?? 24
  const providerName = isMaya ? 'Maya' : 'GCash'
  const booking = attempt?.booking
  const sent = Boolean(attempt?.detailsSent)

  const [reference, setReference] = useState('')
  const [shot, setShot] = useState(null) // { name, previewUrl, dataUrl }
  const [refTouched, setRefTouched] = useState(false)
  const [fileError, setFileError] = useState('')
  const [sendError, setSendError] = useState('')
  const [sending, setSending] = useState(false)
  const [editing, setEditing] = useState(false)
  const [dragging, setDragging] = useState(false)
  const fileRef = useRef(null)

  // The preview image URL is released when it is replaced or the screen closes.
  useEffect(() => () => { if (shot?.previewUrl) URL.revokeObjectURL(shot.previewUrl) }, [shot])

  const refError = refTouched ? referenceError(reference, isMaya) : ''
  const refValid = !referenceError(reference, isMaya)
  const hasInput = referenceDigits(reference).length > 0 || Boolean(shot)
  const canSend = hasInput && refValid && !sending && !fileError

  const takeFile = async (file) => {
    setFileError(''); setSendError('')
    if (!file) return
    if (!OK_TYPES.includes(file.type)) { setFileError('Please choose a JPG or PNG image.'); return }
    if (file.size > MAX_BYTES) { setFileError('That image is larger than 5 MB. Please choose a smaller one.'); return }
    try {
      const dataUrl = await shrinkImage(file)
      setShot({ name: file.name, previewUrl: URL.createObjectURL(file), dataUrl })
    } catch { setFileError('That image could not be read. Please try another one.') }
  }
  const removeShot = () => { setShot(null); setFileError(''); if (fileRef.current) fileRef.current.value = '' }

  const send = async () => {
    setRefTouched(true)
    if (!canSend) return
    setSending(true); setSendError('')
    try {
      await onSend({ reference: referenceDigits(reference), screenshot: shot?.dataUrl || '' })
      setEditing(false); setReference(''); removeShot(); setRefTouched(false)
    } catch (err) {
      setSendError(err.message || 'We could not send your details. Please try again.')
    } finally { setSending(false) }
  }

  // ── progress tracker ──
  const steps = [
    { key: 'sent', title: 'Payment sent', sub: attempt?.paymentSentAt ? sentLabel(attempt.paymentSentAt) : '', state: 'done' },
    { key: 'verify', title: 'Being verified', sub: sent ? 'Checking your details' : `Usually within ${hours} hrs`, state: 'current' },
    { key: 'confirmed', title: 'Booking confirmed', sub: "We'll notify you", state: 'todo' },
  ]

  const slotLine = booking
    ? [dayLabel(booking.date), timeRange(booking.timeLabel), booking.therapist].filter(Boolean).join(' · ')
    : [fallbackSession, fallbackTherapist].filter(Boolean).join(' · ')

  const showForm = !sent || editing
  const inputBase = 'mt-1 min-h-[44px] w-full rounded-lg border bg-white px-3 text-sm outline-none focus:ring-2'

  return (
    <div className="flex flex-col items-center text-center">
      {/* 2. header */}
      <span className="mb-3 mt-1 flex h-16 w-16 items-center justify-center rounded-full" style={{ background: '#FDEBC8', color: AMBER }}><Clock s={32} /></span>
      <h2 ref={headingRef} tabIndex={-1} className="text-2xl font-bold outline-none" style={{ color: BROWN }}>Payment submitted</h2>
      <p role="status" className="mt-1 max-w-sm text-sm text-slate-600">We&apos;ll confirm your booking once your payment is verified (usually within {hours} hours).</p>

      {/* 3. progress */}
      <ol aria-label="Payment progress" className="mt-5 grid w-full grid-cols-3 text-center">
        {steps.map((s, i) => (
          <li key={s.key} aria-current={s.state === 'current' ? 'step' : undefined} className="relative flex flex-col items-center px-1">
            {i > 0 && <span aria-hidden="true" className="absolute right-1/2 top-[15px] h-0.5 w-full" style={{ background: s.state === 'todo' ? '#E2E8F0' : GREEN }} />}
            <span
              className="relative z-10 flex h-8 w-8 items-center justify-center rounded-full"
              style={s.state === 'done' ? { background: GREEN, color: '#fff' } : s.state === 'current' ? { background: '#fff', border: `2.5px solid ${AMBER}`, color: AMBER } : { background: '#fff', border: '2px dashed #CBD5E1', color: '#94A3B8', fontSize: 12, fontWeight: 700 }}
            >
              {s.state === 'done' ? <Check s={16} /> : s.state === 'current' ? <Clock s={16} /> : 3}
            </span>
            <span className="mt-1.5 text-[13px] font-bold" style={{ color: s.state === 'todo' ? '#64748B' : DARK }}>{s.title}</span>
            <span className="text-[11px] leading-tight text-slate-500">{s.sub}</span>
          </li>
        ))}
      </ol>

      {/* 4. time slot card */}
      <div className="mt-4 flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left" style={{ background: '#EEF7F0', borderColor: '#CFE6D6' }}>
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg" style={{ background: '#DCEFE2', color: GREEN }}><Calendar /></span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-bold" style={{ color: DARK }}>Your time slot is reserved for you</span>
          <span className="block truncate text-xs text-slate-600">{slotLine || 'Your session time'}</span>
        </span>
        <span className="shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold" style={{ background: '#DCEFE2', color: GREEN }}>{heldLabel(booking?.holdExpiresAt)}</span>
      </div>

      {/* 5. get confirmed faster */}
      <div className="mt-3 w-full rounded-xl border border-slate-200 bg-white p-4 text-left">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold" style={{ color: DARK }}>Get confirmed faster</h3>
          <span className="rounded-full px-2 py-0.5 text-[10px] font-bold tracking-wide" style={{ background: MINT, color: '#5B7A6D' }}>OPTIONAL</span>
        </div>

        {!showForm ? (
          <div role="status" className="mt-3 flex items-start gap-2 rounded-lg px-3 py-3 text-sm" style={{ background: MINT, color: DARK }}>
            <span className="mt-0.5 shrink-0" style={{ color: GREEN }}><Check s={16} /></span>
            <span className="min-w-0 flex-1">
              <strong>Thanks, we got your details.</strong> The therapist will check your {providerName} payment{attempt?.reference ? ` (ref. ${formatReference(attempt.reference)})` : ''}{attempt?.hasScreenshot ? ' and your screenshot' : ''}.
              <button type="button" onClick={() => setEditing(true)} className="ml-2 font-bold underline" style={{ color: GREEN }}>Add or change</button>
            </span>
          </div>
        ) : (
          <>
            <label htmlFor="qr-ref" className="mt-3 block text-[13px] font-semibold" style={{ color: DARK }}>{providerName} reference number</label>
            <input
              id="qr-ref" value={reference} inputMode="numeric" autoComplete="off" placeholder="13-digit number, e.g. 1234 567 890 123"
              aria-invalid={Boolean(refError)} aria-describedby={refError ? 'qr-ref-err' : undefined}
              onChange={(e) => { setReference(formatReference(e.target.value)); setSendError('') }}
              onBlur={() => setRefTouched(true)}
              className={`${inputBase} ${refError ? 'border-red-400 focus:ring-red-200' : 'border-slate-300 focus:border-[#15803D] focus:ring-green-100'}`}
            />
            {refError && <p id="qr-ref-err" role="alert" className="mt-1 text-xs font-medium text-red-600">{refError}</p>}

            <span className="mt-3 block text-[13px] font-semibold" style={{ color: DARK }}>Screenshot of your payment</span>
            {shot ? (
              <div className="mt-1 flex items-center gap-3 rounded-lg border border-slate-200 p-2">
                <img src={shot.previewUrl} alt="Your payment screenshot" className="h-14 w-14 rounded-md object-cover" />
                <span className="min-w-0 flex-1 truncate text-sm text-slate-700">{shot.name}</span>
                <button type="button" onClick={removeShot} aria-label="Remove screenshot" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100"><Close /></button>
              </div>
            ) : (
              <label
                htmlFor="qr-shot"
                onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
                onDragLeave={() => setDragging(false)}
                onDrop={(e) => { e.preventDefault(); setDragging(false); takeFile(e.dataTransfer.files?.[0]) }}
                className="mt-1 flex min-h-[64px] cursor-pointer items-center gap-3 rounded-xl border-2 border-dashed px-3 py-2.5 transition focus-within:ring-2 focus-within:ring-green-200"
                style={{ borderColor: dragging ? GREEN : '#B7D3C2', background: dragging ? '#E4F3E9' : '#F6FAF7' }}
              >
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg" style={{ background: '#DCEFE2', color: GREEN }}><Upload /></span>
                <span className="block text-left">
                  <span className="block text-sm font-bold" style={{ color: DARK }}>Tap to upload a screenshot</span>
                  <span className="block text-xs text-slate-500">JPG or PNG · up to 5 MB</span>
                </span>
                <input id="qr-shot" ref={fileRef} type="file" accept="image/jpeg,image/png" className="sr-only" onChange={(e) => takeFile(e.target.files?.[0])} />
              </label>
            )}
            {fileError && <p role="alert" className="mt-1 text-xs font-medium text-red-600">{fileError}</p>}
            {sendError && <p role="alert" className="mt-2 text-xs font-medium text-red-600">{sendError}</p>}

            <button
              type="button" onClick={send} disabled={!canSend}
              className="mt-3 min-h-[44px] w-full rounded-xl px-4 text-sm font-bold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-green-300"
              style={canSend ? { background: GREEN, color: '#fff' } : { background: '#E3EAE6', color: '#8CA196', cursor: 'not-allowed' }}
            >{sending ? 'Sending…' : 'Send these details'}</button>
          </>
        )}
      </div>

      {/* footer */}
      <button type="button" onClick={onDone} className="mt-4 min-h-[48px] w-full rounded-xl px-4 text-base font-bold text-white transition hover:opacity-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-green-300" style={{ background: GREEN }}>Go to my appointments</button>
      <p className="mt-3 max-w-sm text-xs text-slate-500">We&apos;ll text and email you as soon as your booking is confirmed. You can close this window.</p>
    </div>
  )
}
