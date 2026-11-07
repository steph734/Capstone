import { useRef } from 'react'
import { Calendar, ChevronDown, Minus, Plus } from 'lucide-react'
import { DAY_CHIPS, LIMITS, fmt12 } from './homeSettings'

function Switch({ on, onChange, title, hint }) {
  return (
    <div className="hp-switch">
      <div><b>{title}</b><small>{hint}</small></div>
      <button type="button" role="switch" aria-checked={on} aria-label={title} className={on ? 'on' : ''} onClick={() => onChange(!on)}><i /></button>
    </div>
  )
}

// The "Home practice settings" panel. value = see defaultHome(); onChange gets the whole new object.
export default function HomeSettingsForm({ value: h, onChange, first, sessionEnd, nextSession }) {
  const set = (k, v) => onChange({ ...h, [k]: v })
  const dateRef = useRef(null)
  // The page's global input reset hides the browser's own picker button, so the calendar icon opens it.
  const openCalendar = () => { const el = dateRef.current; if (!el) return; try { el.showPicker() } catch { el.focus(); el.click() } }
  const toggleDay = (d) => set('days', h.days.includes(d) ? (h.days.length > 1 ? h.days.filter((x) => x !== d) : h.days) : [...h.days, d])
  const isNext = nextSession && nextSession.date === h.until
  return (
    <div className="hp-panel">
      <h4>Home practice settings</h4>
      <div className="hp-row2">
        <label className="hp-field">Home access opens
          <span className="hp-select">
            <select value={h.opens} onChange={(e) => set('opens', e.target.value)}>
              <option value="after">Right after today&apos;s session{sessionEnd ? ` · ${fmt12(sessionEnd)}` : ''}</option>
              <option value="custom">Pick a date and time</option>
            </select><ChevronDown size={14} aria-hidden="true" />
          </span>
          {h.opens === 'custom' && <input type="datetime-local" value={h.customStart} onChange={(e) => set('customStart', e.target.value)} aria-label="Home access opens" />}
        </label>
        <label className="hp-field">Keep unlocked until
          <span className="hp-select">
            <input ref={dateRef} type="date" value={h.until} min={new Date(Date.now() + 8 * 3600000).toISOString().slice(0, 10)} onChange={(e) => e.target.value && set('until', e.target.value)} onClick={openCalendar} />
            <button type="button" className="hp-cal" onClick={openCalendar} aria-label="Open calendar"><Calendar size={16} aria-hidden="true" /></button>
          </span>
          {isNext && <small>The day of {first}&apos;s next session</small>}
        </label>
      </div>

      <div className="hp-row2">
        <div className="hp-field">Practice days
          <div className="hp-days">{DAY_CHIPS.map(([l, d, name]) => <button key={d} type="button" aria-pressed={h.days.includes(d)} aria-label={name} className={h.days.includes(d) ? 'on' : ''} onClick={() => toggleDay(d)}>{l}</button>)}</div>
        </div>
        <div className="hp-field">Daily time limit at home
          <div className="hp-limits">{LIMITS.map((m) => <button key={m} type="button" className={h.limit === m ? 'on' : ''} onClick={() => set('limit', m)}>{m} min</button>)}</div>
        </div>
      </div>

      <div className="hp-row2">
        <div className="hp-field">Home play hours
          <div className="hp-hours"><input type="time" value={h.dailyStart} onChange={(e) => set('dailyStart', e.target.value)} aria-label="Home play starts" /><span>→</span><input type="time" value={h.dailyEnd} onChange={(e) => set('dailyEnd', e.target.value)} aria-label="Home play ends" /></div>
        </div>
        <div className="hp-field">Practice goal per game
          <div className="hp-step"><button type="button" aria-label="Fewer plays" onClick={() => set('goal', Math.max(1, h.goal - 1))}><Minus size={16} /></button><b>{h.goal}× a week</b><button type="button" aria-label="More plays" onClick={() => set('goal', Math.min(7, h.goal + 1))}><Plus size={16} /></button></div>
        </div>
      </div>

      <div className="hp-switches">
        <Switch on={h.notify} onChange={(v) => set('notify', v)} title="Notify parent / caregiver" hint="Send a message when home games unlock and a weekly summary" />
        <Switch on={h.save} onChange={(v) => set('save', v)} title="Save home scores to Notes & Progress" hint="Home plays are tagged &quot;At home&quot; so you can compare with session results" />
        <Switch on={h.autoLevel} onChange={(v) => set('autoLevel', v)} title="Level up automatically" hint={`Move a game to the next difficulty when ${first}'s scores hit 80% or more`} />
      </div>
    </div>
  )
}
