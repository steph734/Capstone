import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Check, ChevronLeft, House, Plus, Send, X } from 'lucide-react'
import TherapistPageShell from '../TherapistPageShell'
import { getTherapistMenuItems } from '../therapistSidebarConfig'
import HomeSettingsForm from './HomeSettingsForm'
import { daysText, defaultHome, fmt12, homeBody, homeFromPlan, longDay } from './homeSettings'
import { authFetch } from '../../../utils/session'
import './assign-games.css'
import './home-practice.css'

const CHIP = { mastered: 'Mastered', almost: 'Almost there', needs_practice: 'Needs practice' }
const cap = (s) => String(s || '').charAt(0).toUpperCase() + String(s || '').slice(1)
const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri']

export default function SendGamesHomePage({ user, onLogout, betaTier }) {
  const { sessionId } = useParams()
  const navigate = useNavigate()
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [picked, setPicked] = useState({}) // gameId -> true; includes home-only games
  const [extra, setExtra] = useState([]) // games added for home only: { id, name, difficulty }
  const [home, setHome] = useState(null)
  const [editing, setEditing] = useState(false)
  const [adding, setAdding] = useState(false)
  const [catalog, setCatalog] = useState([])
  const [busy, setBusy] = useState(false)
  const [toast, setToast] = useState('')
  const [confirming, setConfirming] = useState(false) // "Send / update games at home?"
  const [sent, setSent] = useState(null) // success card: { count, updated }
  const say = (m) => { setToast(m); setTimeout(() => setToast(''), 3400) }
  const today = new Date(Date.now() + 8 * 3600000).toISOString().slice(0, 10)

  const load = useCallback(async () => {
    try {
      const d = await authFetch('/api/patients/session/home-practice', { query: { appointmentId: sessionId } })
      setData(d)
      setHome(d.plan ? homeFromPlan(d.plan) : defaultHome(d.session?.date || today, d.nextSession))
      // Games already at home stay ticked; otherwise tick everything below 100% (or all, when nothing has a score).
      const init = {}
      if (d.plan) d.plan.games.forEach((g) => { init[g.id] = true })
      else {
        const scored = d.sessionGames.filter((g) => g.percent != null)
        d.sessionGames.forEach((g) => { if (g.percent == null ? !scored.length : g.percent < 100) init[g.gameId] = true })
      }
      setPicked(init)
      if (d.plan) setExtra(d.plan.games.filter((g) => g.source === 'home_only').map((g) => ({ id: g.id, name: g.name, difficulty: g.difficulty })))
    } catch (e) { setError(e.message || 'Could not load this session.') }
  }, [sessionId, today])
  useEffect(() => { load() }, [load])

  useEffect(() => {
    if (!adding || !data) return undefined
    let alive = true
    authFetch('/api/therapist/games', { query: { patientId: data.patient.id, type: 'all' } }).then((d) => { if (alive) setCatalog(d.games) }).catch(() => {})
    return () => { alive = false }
  }, [adding, data])

  const first = data?.patient.firstName || 'the patient'
  const played = data?.sessionGames || []
  const rows = useMemo(() => [
    ...played.map((g) => ({ id: g.gameId, name: g.name, difficulty: g.difficulty, therapyType: g.therapyType, minutes: g.minutes, correct: g.correct, attempts: g.attempts, percent: g.percent, chip: g.chip, suggested: g.suggested, source: 'session' })),
    ...extra.filter((e) => !played.some((g) => g.gameId === e.id)).map((e) => ({ id: e.id, name: e.name, difficulty: e.difficulty, source: 'home_only' })),
  ], [played, extra])
  const chosen = rows.filter((r) => picked[r.id])
  const selectNeedy = () => { const n = {}; rows.forEach((r) => { if (r.percent == null ? false : r.percent < 100) n[r.id] = true; if (r.source === 'home_only') n[r.id] = true }); setPicked(n) }

  const send = async () => {
    if (!chosen.length || busy) return
    setBusy(true)
    try {
      const body = homeBody(home, {
        patientId: data.patient.id, day: data.session?.date || today, sessionEnd: data.session?.end, appointmentId: data.session?.id,
        games: chosen.map((r) => ({ gameId: r.id, source: r.source })),
      })
      if (data.plan) {
        const { patientId, sessionPlanId, appointmentId, ...patch } = body // eslint-disable-line no-unused-vars
        await authFetch(`/api/home-practice-plans/${data.plan.id}`, { method: 'PATCH', body: patch })
      } else await authFetch('/api/home-practice-plans', { method: 'POST', body })
      setConfirming(false)
      setSent({ count: chosen.length, updated: Boolean(data.plan), names: chosen.map((g) => g.name) })
      await load()
    } catch (e) { setConfirming(false); say(e.message || 'Could not send these games home.') } finally { setBusy(false) }
  }
  const stop = async () => {
    if (!data?.plan) return
    try { await authFetch(`/api/home-practice-plans/${data.plan.id}`, { method: 'PATCH', body: { status: 'cancelled' } }); say('Home practice stopped.'); await load() } catch (e) { say(e.message) }
  }

  const endText = data?.session ? fmt12(data.session.end) : ''
  return (
    <TherapistPageShell user={user} onLogout={onLogout} title="Assign Games" subtitle="Send games home" icon="🎯" menuItems={getTherapistMenuItems(betaTier)}>
      <div className="sh-page">
        <button type="button" className="sh-back" onClick={() => navigate('/therapist/assign-games')}><ChevronLeft size={18} aria-hidden="true" /> Back to Assign Games</button>
        {error && <p className="ag-error">{error}</p>}
        {!data && !error && <p className="ag-muted">Loading…</p>}
        {data && (<>
          <div className="sh-top">
            <div>
              <h1>Send games home</h1>
              <p>{data.patient.name}&apos;s session{endText ? ` ended at ${endText}` : ''}. Pick the games {first} should keep practicing at home.</p>
            </div>
            <span className="sh-done-pill"><Check size={15} aria-hidden="true" /> Session complete</span>
          </div>

          <div className="sh-grid">
            <section className="sh-card">
              <div className="sh-card-head">
                <div><h3>Played in today&apos;s session</h3><p className="sub">{data.session ? `${fmt12(data.session.start)} – ${fmt12(data.session.end)} · ` : ''}{played.length} game{played.length === 1 ? '' : 's'}</p></div>
                <button type="button" className="hp-btn ghost" onClick={selectNeedy} disabled={!rows.length}>Select games that need practice</button>
              </div>
              {rows.length === 0 ? <p className="ag-muted">No finished games were found for this session. You can still add games for home only.</p> : (
                <table className="sh-table">
                  <thead><tr><th>GAME</th><th>PLAYED</th><th>SCORE</th><th>RESULT</th><th>SEND HOME</th></tr></thead>
                  <tbody>
                    {rows.map((r) => (
                      <tr key={r.id} className={picked[r.id] ? 'on' : ''}>
                        <td className="sh-gname"><b>{r.name}</b><small>{cap(r.therapyType || 'game')} · {cap(r.difficulty)}{r.suggested && <span className="sh-sug"> · Suggested</span>}{r.source === 'home_only' && <span className="sh-sug"> · Home only</span>}</small></td>
                        <td>{r.minutes ? `${r.minutes} min` : '—'}</td>
                        <td className="sh-score">{r.percent != null ? (<><b>{r.attempts ? `${r.correct} of ${r.attempts}` : `${r.percent}%`}</b><i><s style={{ width: `${r.percent}%` }} /></i></>) : '—'}</td>
                        <td>{r.chip ? <span className={`sh-chip ${r.chip}`}>{CHIP[r.chip]}</span> : <span className="sh-chip none">{r.source === 'home_only' ? 'New' : 'No score'}</span>}</td>
                        <td><label className={`sh-check${picked[r.id] ? ' on' : ''}`}><input type="checkbox" checked={Boolean(picked[r.id])} onChange={(e) => setPicked((p) => ({ ...p, [r.id]: e.target.checked }))} aria-label={`Send ${r.name} home`} /> At home</label></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              <button type="button" className="sh-add" onClick={() => setAdding(true)}><Plus size={16} aria-hidden="true" style={{ verticalAlign: '-3px' }} /> Add another game for home only</button>
            </section>

            <section className="sh-card sh-plan">
              <div className="hp-head" style={{ marginBottom: 6 }}>
                <span className="ag-icon"><House size={20} aria-hidden="true" /></span>
                <div><h3>Home practice plan</h3><p>Until the next session</p></div>
              </div>
              <dl>
                <div><dt>Games</dt><dd>{chosen.length ? chosen.map((g) => g.name).join(', ') : 'None picked'}</dd></div>
                <div><dt>Days</dt><dd>{daysText(home.days)}</dd></div>
                <div><dt>Play hours</dt><dd>{fmt12(home.dailyStart)} – {fmt12(home.dailyEnd)}</dd></div>
                <div><dt>Daily limit</dt><dd>{home.limit} min</dd></div>
                <div><dt>Goal</dt><dd>Each game {home.goal}× a week</dd></div>
                <div><dt>Unlocked until</dt><dd>{longDay(home.until)}</dd></div>
              </dl>
              <button type="button" className="hp-btn ghost" onClick={() => setEditing(true)}>Edit plan</button>
              <button type="button" className="hp-btn" disabled={!chosen.length || busy} onClick={() => setConfirming(true)}>
                <Send size={16} aria-hidden="true" /> {busy ? 'Sending…' : data.plan ? `Update ${chosen.length} game${chosen.length === 1 ? '' : 's'} at home` : `Send ${chosen.length} game${chosen.length === 1 ? '' : 's'} home`}
              </button>
              {data.plan && <button type="button" className="hp-btn ghost" onClick={stop}>Stop home practice</button>}
              <p className="sh-note">{first} will find them under &quot;Home practice&quot;. Every home play is saved to Notes &amp; Progress{home.save ? '' : ' (you turned this off in Edit plan)'}.</p>
            </section>
          </div>

          {data.plan && (
            <section className="sh-card">
              <div className="sh-card-head">
                <div><h3>Home progress · this week</h3><p className="sub">Fills in as {first} plays at home. Also shown in Notes &amp; Progress.</p></div>
                <button type="button" className="hp-btn ghost" onClick={() => navigate(`/therapist/notes-progress?patient=${data.patient.id}`)}>Open Notes &amp; Progress</button>
              </div>
              <div className="sh-prog">
                {data.plan.games.map((g) => (
                  <div key={g.id} className="sh-prog-card">
                    <header><b>{g.name}</b><span>{g.playsThisWeek} of {data.plan.goalPerGamePerWeek} plays</span></header>
                    <div className="sh-days">{WEEKDAYS.map((d, i) => <div key={d} className="sh-day"><i className={g.playsByDay[i] ? 'has' : ''}>{g.playsByDay[i] || ''}</i>{d}</div>)}</div>
                    <div className="sh-prog-foot">
                      <span>Session score <b>{g.sessionScore != null ? `${g.sessionScore}%` : '—'}</b></span>
                      <span>Best at home <b>{g.bestHome != null ? `${g.bestHome}%` : '—'}</b></span>
                      <span>Last played <b>{g.lastHomeAt ? new Date(g.lastHomeAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'Asia/Manila' }) : 'Not yet'}</b></span>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}
        </>)}
      </div>

      {editing && home && (
        <div className="hp-modal" role="dialog" aria-modal="true" aria-label="Edit home practice plan" onClick={(e) => e.target === e.currentTarget && setEditing(false)}>
          <div>
            <div className="hp-modal-head"><h3>Edit home practice plan</h3><button type="button" aria-label="Close" onClick={() => setEditing(false)}><X size={18} /></button></div>
            <HomeSettingsForm value={home} onChange={setHome} first={first} sessionEnd={data.session?.end} nextSession={data.nextSession} />
            <button type="button" className="hp-btn" style={{ width: '100%', marginTop: 14 }} onClick={() => setEditing(false)}>Done</button>
          </div>
        </div>
      )}
      {adding && (
        <div className="hp-modal" role="dialog" aria-modal="true" aria-label="Add a game for home only" onClick={(e) => e.target === e.currentTarget && setAdding(false)}>
          <div>
            <div className="hp-modal-head"><h3>Add a game for home only</h3><button type="button" aria-label="Close" onClick={() => setAdding(false)}><X size={18} /></button></div>
            {catalog.length === 0 && <p className="ag-muted">Loading games…</p>}
            {catalog.filter((g) => !rows.some((r) => r.id === g.id)).map((g) => (
              <div key={g.id} className="hp-pick"><span><b>{g.name}</b><br /><small>{cap(g.difficulty)} · {g.minutes} min</small></span>
                <button type="button" className="hp-btn ghost" onClick={() => { setExtra((x) => [...x, { id: g.id, name: g.name, difficulty: g.difficulty }]); setPicked((p) => ({ ...p, [g.id]: true })) }}><Plus size={15} aria-hidden="true" /> Add</button></div>
            ))}
          </div>
        </div>
      )}
      {confirming && (
        <div className="pm-modal" role="alertdialog" aria-modal="true" aria-labelledby="sh-cf" onClick={(e) => e.target === e.currentTarget && !busy && setConfirming(false)}>
          <div className="pm-box go">
            <span className="pm-ico"><Send size={26} aria-hidden="true" /></span>
            <h3 id="sh-cf">{data?.plan ? `Update ${chosen.length} game${chosen.length === 1 ? '' : 's'} at home?` : `Send ${chosen.length} game${chosen.length === 1 ? '' : 's'} home?`}</h3>
            <p>{first} can play {chosen.map((g) => g.name).join(', ')} at home {daysText(home.days).toLowerCase()}, {fmt12(home.dailyStart)}–{fmt12(home.dailyEnd)}, up to {home.limit} min a day, until {longDay(home.until)}.{home.notify ? ` The parent or caregiver is notified.` : ''}</p>
            <div className="pm-actions">
              <button type="button" onClick={() => setConfirming(false)} disabled={busy}>Cancel</button>
              <button type="button" className="pm-confirm" onClick={send} disabled={busy} autoFocus>{busy ? 'Saving…' : data?.plan ? 'Update' : 'Send home'}</button>
            </div>
          </div>
        </div>
      )}
      {sent && (
        <div className="pm-modal" role="dialog" aria-modal="true" aria-labelledby="sh-ok" onClick={(e) => e.target === e.currentTarget && setSent(null)}>
          <div className="pm-box go">
            <span className="pm-ico"><Check size={28} aria-hidden="true" /></span>
            <h3 id="sh-ok">{sent.updated ? 'Home games updated' : 'Games sent home'}</h3>
            <p>{sent.count} game{sent.count === 1 ? ' is' : 's are'} now open at home for {first}: {sent.names.join(', ')}.{home.notify ? ` The parent or caregiver has been notified.` : ''} Every home play is saved to Notes &amp; Progress.</p>
            <div className="pm-actions">
              <button type="button" onClick={() => navigate('/therapist/assign-games')}>Back to Assign Games</button>
              <button type="button" className="pm-confirm" onClick={() => setSent(null)} autoFocus>Done</button>
            </div>
          </div>
        </div>
      )}
      {toast && <div className="tae-toast">{toast}</div>}
    </TherapistPageShell>
  )
}
