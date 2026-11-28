import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import TherapistPageShell from './TherapistPageShell'
import { getTherapistMenuItems } from './therapistSidebarConfig'
import RecommendSessionModal from '../../components/RecommendSessionModal'
import { manilaDateKey } from '../../utils/manilaTime'
import AddPatientModal from './patients/AddPatientModal'
import MessageGuardianModal from './patients/MessageGuardianModal'
import { patientsApi } from './patients/api'
import './patients/PatientsPage.css'
import { apptApi } from './appointments/api'
import { Toast } from './appointments/ui'
import StatCards from './appointments/StatCards'
import SessionCalendar from './appointments/SessionCalendar'
import SelectedDayPanel from './appointments/SelectedDayPanel'
import RequestsToReview from './appointments/RequestsToReview'
import RequestsModal from './appointments/RequestsModal'
import AppointmentsList from './appointments/AppointmentsList'
import { ViewModal, RescheduleModal, CompleteModal, ArchiveModal, RecommendPrompt } from './appointments/Dialogs'
import { monthKey, shiftMonth, shortDay } from './appointments/format'
import './appointments/appointments.css'

const PAGE_SIZE = 7

// A request that fails keeps the last good data on screen and shows a Retry next to it.
function useLoad(fetcher, deps) {
  const [s, setS] = useState({ data: null, error: '', loading: true })
  const seq = useRef(0)
  const load = useCallback(async () => {
    const n = ++seq.current
    setS((v) => ({ ...v, loading: true, error: '' }))
    try { const data = await fetcher(); if (n === seq.current) setS({ data, error: '', loading: false }) } catch (e) { if (n === seq.current) setS((v) => ({ ...v, error: e.message || 'Could not load this.', loading: false })) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)
  useEffect(() => { load() }, [load])
  return [s, load]
}

export default function TherapistAppointmentsPage({ user, onLogout, betaTier }) {
  const navigate = useNavigate()
  const today = manilaDateKey()
  const [month, setMonth] = useState(monthKey(today))
  const [selected, setSelected] = useState(today)
  const [tab, setTab] = useState('active')
  const [status, setStatus] = useState('All')
  const [search, setSearch] = useState('')
  const [q, setQ] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [page, setPage] = useState(1)
  const [toast, setToast] = useState('')
  const [dlg, setDlg] = useState(null) // { type, appt?, id? }
  const [rec, setRec] = useState(null) // the appointment a recommendation is being written for
  const [newOpen, setNewOpen] = useState(false)
  const [newInfo, setNewInfo] = useState(null)

  useEffect(() => { const t = setTimeout(() => { setQ(search.trim()); setPage(1) }, 300); return () => clearTimeout(t) }, [search]) // search runs on the server, debounced
  const showToast = useCallback((t) => { setToast(t); setTimeout(() => setToast(''), 3200) }, [])

  const [sum, loadSum] = useLoad(() => apptApi.summary(), [])
  const [cal, loadCal] = useLoad(() => apptApi.calendar(month), [month])
  const [day, loadDay] = useLoad(() => apptApi.day(selected), [selected])
  const [reqs, loadReqs] = useLoad(() => apptApi.requests(), [])
  const [list, loadList] = useLoad(() => apptApi.list({ tab, status: status === 'All' ? '' : status, q, from, to, page, pageSize: PAGE_SIZE }), [tab, status, q, from, to, page])

  const refreshAll = useCallback(() => { loadSum(); loadCal(); loadDay(); loadReqs(); loadList() }, [loadSum, loadCal, loadDay, loadReqs, loadList])
  useEffect(() => { // a guardian may have sent new proof: look again when the tab comes back
    const on = () => { if (document.visibilityState === 'visible') { loadReqs(); loadSum() } }
    document.addEventListener('visibilitychange', on); window.addEventListener('focus', on)
    return () => { document.removeEventListener('visibilitychange', on); window.removeEventListener('focus', on) }
  }, [loadReqs, loadSum])

  const items = list.data?.items
  const listView = list.data ? { ...list.data, loading: list.loading, error: '' } : (list.error ? { error: list.error, items: [], total: 0 } : null)

  const goMonth = (d) => { const m = shiftMonth(month, d); setMonth(m); setSelected(`${m}-01`) }
  const goToday = () => { setMonth(monthKey(today)); setSelected(today) }

  const viewById = (id) => {
    const found = items?.find((a) => a.id === id)
    if (found) return setDlg({ type: 'view', appt: found })
    const d = day.data?.appointments.find((a) => a.id === id)
    if (d) setDlg({ type: 'view', appt: { id: d.id, patientName: d.patientName, date: selected, start: d.start, end: d.end, minutes: 60, service: d.service, status: d.status, isArchived: false, can: {}, condition: '', guardianName: '', guardianEmail: '' } })
  }

  const onAction = async (key, appt) => {
    if (key === 'restore') {
      try { await apptApi.restore(appt.id); showToast('Appointment restored.'); refreshAll() } catch (e) { showToast(e.message || 'Could not restore.') }
      return
    }
    setDlg({ type: key, appt })
  }

  const openNew = async () => {
    try { const d = await patientsApi.list({ limit: 1 }); setNewInfo({ fee: d.fee, therapist: d.therapist }); setNewOpen(true) } catch (e) { showToast(e.message || 'Could not open the form. Try again.') }
  }

  return (
    <TherapistPageShell user={user} onLogout={onLogout} title="Appointments" subtitle="Manage patient sessions and schedules" icon="" menuItems={getTherapistMenuItems(betaTier)}>
      <div className="ap-page">
        <StatCards summary={sum.data} error={sum.error} onRetry={loadSum} />

        <div className="ap-top">
          <SessionCalendar month={month} days={cal.data?.days} loading={cal.loading} error={cal.error} selected={selected} today={today} onSelect={setSelected} onMonth={goMonth} onToday={goToday} onRetry={loadCal} />
          <SelectedDayPanel date={selected} data={day.data} loading={day.loading} error={day.error} onView={viewById} onRetry={loadDay} />
        </div>

        <RequestsToReview data={reqs.data} loading={reqs.loading} error={reqs.error} onRetry={loadReqs} onOpen={(id) => setDlg({ type: 'requests', id })} />

        <AppointmentsList
          today={today} state={{ tab, status }} list={listView} search={search} from={from} to={to}
          onFrom={(v) => { setFrom(v); setPage(1) }} onTo={(v) => { setTo(v); setPage(1) }}
          onTab={(t) => { setTab(t); setPage(1) }} onStatus={(s) => { setStatus(s); setPage(1) }} onSearch={setSearch}
          onMore={() => setPage((p) => p + 1)} onNew={openNew} onView={(a) => setDlg({ type: 'view', appt: a })} onAction={onAction} onRetry={loadList}
        />
      </div>

      {dlg?.type === 'view' && <ViewModal appt={dlg.appt} onClose={() => setDlg(null)} onAction={(k, a) => { setDlg(null); onAction(k, a) }} />}
      {dlg?.type === 'reschedule' && <RescheduleModal appt={dlg.appt} today={today} onClose={() => setDlg(null)} onDone={(out) => { setDlg(null); showToast(`Moved to ${shortDay(out.appointment.date)}. ${out.guardianEmail === 'failed' ? "The email couldn't be sent." : 'The guardian was told.'}`); refreshAll() }} />}
      {dlg?.type === 'complete' && <CompleteModal appt={dlg.appt} onClose={() => setDlg(null)} onDone={(out) => { const a = dlg.appt; setDlg(null); showToast('Session marked as completed.'); refreshAll(); if (out.canRecommend) setDlg({ type: 'prompt', appt: a }) }} />}
      {dlg?.type === 'archive' && <ArchiveModal appt={dlg.appt} onClose={() => setDlg(null)} onDone={() => { setDlg(null); showToast('Appointment archived.'); refreshAll() }} />}
      {dlg?.type === 'prompt' && <RecommendPrompt appt={dlg.appt} onClose={() => setDlg(null)} onYes={() => { setRec(dlg.appt); setDlg(null) }} />}
      {dlg?.type === 'message' && <MessageGuardianModal patient={{ id: dlg.appt.patientId, name: dlg.appt.patientName, guardianName: dlg.appt.guardianName }} therapistEmail={user?.email} onClose={() => setDlg(null)} />}
      {dlg?.type === 'requests' && <RequestsModal initialId={dlg.id} onClose={() => setDlg(null)} onChanged={refreshAll} showToast={showToast} />}
      {rec && (
        <RecommendSessionModal
          patient={{ name: rec.patientName, guardian: rec.guardianName, lastSessionLabel: `${shortDay(rec.date)} · Completed` }}
          appointmentId={rec.id} defaultType={rec.service} onClose={() => setRec(null)}
          onSent={() => { setRec(null); showToast('Recommendation sent to the parent') }}
        />
      )}
      {newOpen && (
        <AddPatientModal
          fee={newInfo?.fee} therapist={newInfo?.therapist}
          onClose={() => { setNewOpen(false); refreshAll() }} onCreated={refreshAll}
          onOpenExisting={() => { setNewOpen(false); navigate('/therapist/patients') }}
          onBookFirst={() => { setNewOpen(false); refreshAll() }}
        />
      )}
      <Toast text={toast} />
    </TherapistPageShell>
  )
}
