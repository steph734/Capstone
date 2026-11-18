import { useEffect, useMemo, useRef, useState } from 'react'
import {
  PRESETS, today, presetRange, matchPreset, validateRange, parseTypedDay, pickDay, monthGrid, moveFocus, compareFor,
  addMonths, monthStart, monthTitle, fmtLong, fmtRange, fmtRangeShort, daysInRange, isValidDay,
} from './reportRange'

const SEGMENTS = [
  { key: 'thisMonth', label: 'This month' },
  { key: 'lastMonth', label: 'Last month' },
  { key: 'last3Months', label: 'Last 3 months' },
  { key: 'thisYear', label: 'This year' },
  { key: 'custom', label: 'Custom' },
]
const DOW = ['S', 'M', 'T', 'W', 'T', 'F', 'S']
const DOW_FULL = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

function CalendarIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" />
    </svg>
  )
}

/* ── One month of the two-month calendar ────────────────────── */
function Month({ month, sel, now, focusDay, onPick, onKey }) {
  const weeks = useMemo(() => monthGrid(month), [month])
  const lo = sel.start && sel.end ? sel.start : sel.start
  const hi = sel.end || sel.start
  return (
    <div className="orp-cal-month">
      <div className="orp-cal-title" id={`orp-cal-${month}`}>{monthTitle(month)}</div>
      <table className="orp-cal-grid" role="grid" aria-labelledby={`orp-cal-${month}`}>
        <thead>
          <tr>{DOW.map((d, i) => <th key={i} scope="col" abbr={DOW_FULL[i]}>{d}</th>)}</tr>
        </thead>
        <tbody>
          {weeks.map((w, wi) => (
            <tr key={wi}>
              {w.map((day, di) => {
                if (!day) return <td key={di} className="orp-cal-pad" />
                const future = day > now
                const isStart = day === sel.start
                const isEnd = day === sel.end
                const inside = lo && hi && day > lo && day < hi
                const cls = ['orp-cal-cell', inside && 'in-range', isStart && 'is-start', isEnd && 'is-end', day === now && 'is-today', future && 'is-future'].filter(Boolean).join(' ')
                return (
                  <td key={di} className={cls} role="gridcell" aria-selected={isStart || isEnd || inside || undefined} aria-disabled={future || undefined}>
                    <button
                      type="button"
                      id={`orp-day-${day}`}
                      tabIndex={day === focusDay ? 0 : -1}
                      disabled={future}
                      onClick={() => onPick(day)}
                      onKeyDown={(e) => onKey(e, day)}
                      aria-label={`${fmtLong(day)}${isStart ? ', start' : ''}${isEnd ? ', end' : ''}${day === now ? ', today' : ''}${future ? ', unavailable' : ''}`}
                    >
                      {Number(day.slice(8))}
                    </button>
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/* ── Popover picker (image 2) ───────────────────────────────── */
function DateRangePicker({ range, compare, compareCustom, busy, onApply, onClose, anchorRef }) {
  const now = today()
  const popRef = useRef(null)
  const startInput = useRef(null)
  const [sel, setSel] = useState({ start: range.from, end: range.to })
  const [startText, setStartText] = useState(fmtLong(range.from))
  const [endText, setEndText] = useState(fmtLong(range.to))
  const [cmpMode, setCmpMode] = useState(compare)
  const [cmpCustom, setCmpCustom] = useState(compareCustom || { from: '', to: '' })
  const [editCmp, setEditCmp] = useState(false)
  const [focusDay, setFocusDay] = useState(range.to)
  const [view, setView] = useState(() => {
    const endM = monthStart(range.to)
    const startM = monthStart(range.from)
    const prevOfEnd = addMonths(endM, -1)
    return startM > prevOfEnd ? startM : prevOfEnd
  })
  const [kbd, setKbd] = useState(false)

  // Esc and an outside click close the popover WITHOUT applying.
  useEffect(() => {
    const onDown = (e) => {
      if (popRef.current?.contains(e.target) || anchorRef.current?.contains(e.target)) return
      onClose()
    }
    document.addEventListener('mousedown', onDown)
    popRef.current?.focus()
    return () => document.removeEventListener('mousedown', onDown)
  }, [onClose, anchorRef])

  useEffect(() => {
    if (kbd) document.getElementById(`orp-day-${focusDay}`)?.focus()
  }, [focusDay, view, kbd])

  const setBoth = (start, end) => {
    setSel({ start, end })
    setStartText(start ? fmtLong(start) : '')
    setEndText(end ? fmtLong(end) : '')
  }

  const revealMonth = (day) => {
    const m = monthStart(day)
    if (m < view) setView(m)
    else if (m > addMonths(view, 1)) setView(addMonths(m, -1))
  }

  const handlePick = (day) => {
    const next = pickDay(sel, day, now)
    setBoth(next.start, next.end)
    setFocusDay(day)
  }

  const handleKey = (e, day) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handlePick(day); return }
    const next = moveFocus(day, e.key, now)
    if (next !== day || ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'PageUp', 'PageDown'].includes(e.key)) {
      e.preventDefault()
      setKbd(true)
      setFocusDay(next)
      revealMonth(next)
    }
  }

  const handleTyped = (which, text) => {
    const day = parseTypedDay(text)
    if (which === 'start') { setStartText(text); setSel((s) => ({ ...s, start: day })) } else { setEndText(text); setSel((s) => ({ ...s, end: day })) }
    if (day && day <= now) { setFocusDay(day); revealMonth(day) }
  }

  const applyPreset = (key) => {
    if (key === 'custom') { startInput.current?.focus(); return }
    const r = presetRange(key, now)
    setBoth(r.from, r.to)
    setFocusDay(r.to)
    setView(monthStart(r.from) > addMonths(monthStart(r.to), -1) ? monthStart(r.from) : addMonths(monthStart(r.to), -1))
  }

  const startBad = startText.trim() !== '' && !sel.start
  const endBad = endText.trim() !== '' && !sel.end
  let error = ''
  if (startBad || endBad) error = 'Enter dates like Oct 1, 2026.'
  else if (sel.start && sel.end) error = validateRange(sel.start, sel.end, now)
  let cmpError = ''
  if (cmpMode === 'custom') {
    if (!isValidDay(cmpCustom.from) || !isValidDay(cmpCustom.to) || cmpCustom.from > cmpCustom.to) cmpError = 'Pick a valid comparison range.'
    else if (sel.start && sel.end && cmpCustom.from <= sel.end && cmpCustom.to >= sel.start) cmpError = 'The comparison range must not overlap the selected range.'
  }
  const valid = !!(sel.start && sel.end) && !error && !cmpError
  const activePreset = sel.start && sel.end ? matchPreset({ from: sel.start, to: sel.end }, now) : 'custom'
  const cmp = valid ? compareFor({ from: sel.start, to: sel.end }, cmpMode, cmpCustom) : null
  const days = sel.start && sel.end ? daysInRange(sel.start, sel.end) : 0

  const apply = () => {
    if (!valid || busy) return
    onApply({ range: { from: sel.start, to: sel.end }, compare: cmpMode, compareCustom: cmpMode === 'custom' ? cmpCustom : null })
  }

  const left = view
  const right = addMonths(view, 1)

  return (
    <div
      className="orp-picker"
      ref={popRef}
      role="dialog"
      aria-label="Choose a date range"
      tabIndex={-1}
      onKeyDown={(e) => { if (e.key === 'Escape') { e.stopPropagation(); onClose() } }}
    >
      <div className="orp-picker-side">
        <div className="orp-picker-kicker">Quick ranges</div>
        {[...PRESETS, { key: 'custom', label: 'Custom range' }].map((p) => (
          <button key={p.key} type="button" className={`orp-quick ${activePreset === p.key ? 'active' : ''}`} onClick={() => applyPreset(p.key)} aria-pressed={activePreset === p.key}>
            {p.label}
          </button>
        ))}
      </div>

      <div className="orp-picker-main">
        <div className="orp-inputs">
          <label className={`orp-field ${startBad ? 'invalid' : ''}`}>
            <span>START</span>
            <input ref={startInput} value={startText} onChange={(e) => handleTyped('start', e.target.value)} placeholder="Oct 1, 2026" aria-invalid={startBad || undefined} />
          </label>
          <span className="orp-arrow" aria-hidden="true">→</span>
          <label className={`orp-field ${endBad ? 'invalid' : ''}`}>
            <span>END</span>
            <input value={endText} onChange={(e) => handleTyped('end', e.target.value)} placeholder="Oct 31, 2026" aria-invalid={endBad || undefined} />
          </label>
        </div>

        <div className="orp-cal-nav">
          <button type="button" className="orp-icon-btn" onClick={() => setView(addMonths(view, -1))} aria-label="Previous month">‹</button>
          <button type="button" className="orp-icon-btn" onClick={() => setView(addMonths(view, 1))} aria-label="Next month" disabled={right >= monthStart(now)}>›</button>
        </div>
        <div className="orp-cals">
          <Month month={left} sel={sel} now={now} focusDay={focusDay} onPick={handlePick} onKey={handleKey} />
          <Month month={right} sel={sel} now={now} focusDay={focusDay} onPick={handlePick} onKey={handleKey} />
        </div>

        <div className="orp-picker-summary" aria-live="polite">
          {valid ? (
            <>
              <span><strong>{days} day{days === 1 ? '' : 's'}</strong> selected · compared with <strong>{fmtRangeShort(cmp.from, cmp.to)}</strong></span>
              <button type="button" className="orp-link" onClick={() => setEditCmp((v) => !v)} aria-expanded={editCmp}>Change comparison</button>
            </>
          ) : (
            <span className="orp-error" role="alert">{error || cmpError || 'Pick a start and an end date.'}</span>
          )}
        </div>

        {editCmp && (
          <div className="orp-cmp-edit">
            <label>
              Compare with
              <select value={cmpMode} onChange={(e) => setCmpMode(e.target.value)}>
                <option value="previous_period">Previous period</option>
                <option value="previous_year">Same dates last year</option>
                <option value="custom">Custom range</option>
              </select>
            </label>
            {cmpMode === 'custom' && (
              <>
                <label>From<input type="date" max={now} value={cmpCustom.from} onChange={(e) => setCmpCustom((c) => ({ ...c, from: e.target.value }))} /></label>
                <label>To<input type="date" max={now} value={cmpCustom.to} onChange={(e) => setCmpCustom((c) => ({ ...c, to: e.target.value }))} /></label>
              </>
            )}
            {cmpError && <span className="orp-error" role="alert">{cmpError}</span>}
          </div>
        )}

        <div className="orp-picker-foot">
          <span className="orp-note">Future dates can't be selected</span>
          <div className="orp-picker-btns">
            <button type="button" className="orp-btn orp-btn-outline" onClick={onClose}>Cancel</button>
            <button type="button" className="orp-btn orp-btn-primary" onClick={apply} disabled={!valid || busy}>Apply range</button>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ── Filter bar (images 1 and 3) ────────────────────────────── */
export default function DateRangeFilter({ range, compare, compareCustom, compareRange, loading, isDefault, clamped, open, onOpenChange, onApply, onReset }) {
  const btnRef = useRef(null)
  const now = today()
  const active = matchPreset(range, now)
  const segActive = SEGMENTS.some((s) => s.key === active) ? active : 'custom'
  const cmp = compareRange || compareFor(range, compare, compareCustom)
  const closePicker = () => { onOpenChange(false); btnRef.current?.focus() }

  return (
    <div className="orp-filterbar">
      <div className="orp-seg" role="group" aria-label="Quick date ranges">
        {SEGMENTS.map((s) => (
          <button
            key={s.key}
            type="button"
            className={`orp-seg-btn ${segActive === s.key ? 'active' : ''}`}
            aria-pressed={segActive === s.key}
            onClick={() => (s.key === 'custom' ? onOpenChange(true) : onApply({ range: presetRange(s.key, now), compare: 'previous_period', compareCustom: null }))}
          >
            {s.label}
          </button>
        ))}
      </div>

      <div className="orp-datewrap">
        <button ref={btnRef} type="button" className="orp-datebtn" aria-haspopup="dialog" aria-expanded={open} onClick={() => onOpenChange(!open)}>
          <CalendarIcon /> {fmtRange(range.from, range.to)} <span aria-hidden="true">⌄</span>
        </button>
        {open && (
          <DateRangePicker
            key={`${range.from}${range.to}`}
            range={range}
            compare={compare}
            compareCustom={compareCustom}
            busy={loading}
            anchorRef={btnRef}
            onClose={closePicker}
            onApply={(next) => { onApply(next); onOpenChange(false); btnRef.current?.focus() }}
          />
        )}
      </div>

      <span className="orp-compare">Compared with {fmtRangeShort(cmp.from, cmp.to)}</span>
      {loading && <span className="orp-spinner" role="status" aria-label="Updating reports" />}

      {!isDefault && (
        <div className="orp-chip-applied" role="status">
          <span>Showing {fmtRangeShort(range.from, range.to)} · numbers updated{clamped ? ' (end date set to today)' : ''}</span>
          <button type="button" onClick={onReset} aria-label="Clear the date filter and go back to this month">✕</button>
        </div>
      )}
    </div>
  )
}
