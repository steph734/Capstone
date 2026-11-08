import { useCallback, useEffect, useState } from 'react'
import { authFetch } from '../../../../utils/session'
import PatientHomeCard from './PatientHomeCard'
import ChooseNextSetModal from './ChooseNextSetModal'
import HomeSoapModal from './HomeSoapModal'
import { sessionText } from './gameIcons'
import './homeSets.css'

// Home practice tab: summary tiles, filter pills, one card per patient, and the "choose the next set" flow.
const FILTERS = [['all', 'All patients'], ['needs', 'Needs new games'], ['progress', 'In progress'], ['idle', 'Not started']]
const matches = (p, f) => (f === 'all' ? true : f === 'needs' ? p.needsNew : f === 'progress' ? !p.needsNew && p.playedCount > 0 : p.playedCount === 0 && !p.needsNew)

export default function HomePracticeTab({ overview, loading, error, onReload, onSetupHome }) {
  const [filter, setFilter] = useState('all')
  const [modalFor, setModalFor] = useState(null)
  const [soapFor, setSoapFor] = useState(null)
  const [keeping, setKeeping] = useState(null)
  const [toast, setToast] = useState(null) // { text, undo: { patientId, setId } | null }
  const [note, setNote] = useState('')

  useEffect(() => {
    if (!toast?.undo) return undefined
    const t = setTimeout(() => setToast((x) => (x ? { ...x, undo: null } : x)), overview?.config?.undoWindowMs || 10000)
    return () => clearTimeout(t)
  }, [toast?.undo?.setId]) // eslint-disable-line react-hooks/exhaustive-deps

  const keep = useCallback(async (p) => {
    setKeeping(p.setId); setNote('')
    try { await authFetch('/api/therapist/home-sets/dismiss', { method: 'POST', body: { setId: p.setId } }); await onReload() }
    catch (e) { setNote(e.message || 'Could not save that choice.') } finally { setKeeping(null) }
  }, [onReload])

  const assigned = async (r) => {
    setModalFor(null)
    const where = [r.useInTherapy ? `therapy session${r.therapyDate ? ` ${sessionText({ date: r.therapyDate })}` : ''}` : '', r.useAtHome ? `home practice (goal ${r.goal}× per game each week)` : ''].filter(Boolean).join(' and ')
    setToast({ text: `New set assigned for ${r.firstName}: ${where}.`, undo: { patientId: modalFor.patientId, setId: r.setId } })
    await onReload()
  }
  const undo = async () => {
    const u = toast?.undo
    if (!u) return
    try { await authFetch('/api/therapist/home-sets/undo', { method: 'POST', body: u }); setToast(null); await onReload() }
    catch (e) { setToast(null); setNote(e.message || 'Could not undo.') }
  }

  const patients = overview?.patients || []
  const counts = Object.fromEntries(FILTERS.map(([id]) => [id, patients.filter((p) => matches(p, id)).length]))
  const shown = patients.filter((p) => matches(p, filter))
  const s = overview?.summary

  return (
    <div className="hs-tab" role="tabpanel" id="panel-home" aria-labelledby="tab-home">
      {toast && (
        <div className="hs-toast" role="status"><span>✓ {toast.text}</span>{toast.undo && <button type="button" onClick={undo}>Undo</button>}</div>
      )}
      <div className="hs-title"><h2>Home practice</h2><p>Each game can be played {overview?.config?.playsPerGame ?? 3} times at home; it is mastered when every play is at {overview?.config?.masteredAccuracy ?? 100}% accuracy. When every game in a set is finished, write the SOAP note, then choose the next set.</p></div>
      {note && <p className="hs-error-line" role="alert">{note}</p>}

      {error && !overview && <div className="hs-error" role="alert"><span>{error}</span><button type="button" className="hs-btn green" onClick={onReload}>Retry</button></div>}
      {loading && !overview && !error && <div aria-busy="true" aria-label="Loading home practice"><div className="hs-tiles">{[0, 1, 2, 3].map((i) => <div key={i} className="hs-skel" style={{ height: 92 }} />)}</div><div className="hs-skel" style={{ height: 260, marginTop: 16 }} /></div>}

      {overview && (
        <>
          <div className="hs-tiles">
            <div className="hs-tile"><b>{s.patients}</b><span>Patients with home practice</span></div>
            <div className="hs-tile amber"><b>{s.needNew}</b><span>Need new games</span></div>
            <div className="hs-tile gold"><b>{s.finished}</b><span>Games finished</span></div>
            <div className="hs-tile blue"><b>{s.notFinished}</b><span>Not finished yet</span></div>
          </div>

          {patients.length === 0 ? (
            <div className="hs-empty"><img src="/games/pao-money-match-poses/pao-thumbs-up.png" alt="" width="84" height="84" /><div><h3>No patients have home practice yet</h3><p>After a therapy session, use “Send games home” to keep games open for a patient. They will show up here.</p></div></div>
          ) : (
            <>
              <div className="hs-pills" role="group" aria-label="Filter patients">
                {FILTERS.map(([id, label]) => <button key={id} type="button" aria-pressed={filter === id} className={filter === id ? 'on' : ''} onClick={() => setFilter(id)}>{label}{id !== 'all' ? ` · ${counts[id]}` : ''}</button>)}
              </div>
              <div className="hs-list">
                {shown.map((p) => <PatientHomeCard key={p.setId} patient={p} onChoose={setModalFor} onSoap={setSoapFor} onKeep={keep} keeping={keeping === p.setId} openSetup={onSetupHome} />)}
                {shown.length === 0 && <p className="hs-muted">No patients in this group.</p>}
              </div>
            </>
          )}
        </>
      )}

      {soapFor && <HomeSoapModal patient={soapFor} onClose={() => setSoapFor(null)} onSaved={async () => { setSoapFor(null); setToast({ text: `SOAP note saved for ${soapFor.firstName}. You can choose the next set now.`, undo: null }); await onReload() }} />}
      {modalFor && <ChooseNextSetModal patient={modalFor} config={overview?.config} onClose={() => setModalFor(null)} onAssigned={assigned} />}
    </div>
  )
}
