import { useEffect, useState } from 'react'
import TherapistPageShell from './TherapistPageShell'
import { getTherapistMenuItems } from './therapistSidebarConfig'
import { apiGet } from '../../utils/api'
import '../admin/AdminPages.css'
import './TherapistAttendancePage.css'

function formatDate(dateStr) {
  if (!dateStr) return '—'
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
}

function formatTime(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}

function hoursBetween(inIso, outIso) {
  if (!inIso || !outIso) return null
  return Math.round(((new Date(outIso) - new Date(inIso)) / 3600000) * 10) / 10
}

export default function TherapistAttendancePage({ user, onLogout, betaTier }) {
  const [loading, setLoading] = useState(true)
  const [notLinked, setNotLinked] = useState(false)
  const [error, setError] = useState('')
  const [summary, setSummary] = useState({ daysThisMonth: 0, hoursThisMonth: 0 })
  const [records, setRecords] = useState([])

  useEffect(() => {
    let cancelled = false
    if (!user?.email) {
      setLoading(false)
      setNotLinked(true)
      return
    }
    apiGet(`/api/attendance/me?email=${encodeURIComponent(user.email)}`)
      .then((data) => {
        if (cancelled) return
        setSummary(data.summary || { daysThisMonth: 0, hoursThisMonth: 0 })
        setRecords(data.records || [])
      })
      .catch((err) => {
        if (cancelled) return
        if (/no staff record/i.test(err.message || '')) setNotLinked(true)
        else setError(err.message || 'Could not load your attendance.')
      })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [user?.email])

  const lastRecord = records.find((r) => r.timeIn) || null

  return (
    <TherapistPageShell
      user={user}
      onLogout={onLogout}
      title="My Attendance"
      subtitle="Your check-in/check-out history from the branch's ID scanner."
      icon="🕒"
      menuItems={getTherapistMenuItems(betaTier)}
    >
      {loading ? (
        <p style={{ color: '#6b7c75', fontSize: 14 }}>Loading your attendance…</p>
      ) : notLinked ? (
        <div className="admin-table-card">
          <div className="ta-empty-state">
            <h3>No attendance yet</h3>
            <p>
              Your account isn't linked to a staff record yet, so there's nothing to show here. Once
              your branch owner scans your ID badge for the first time, your check-ins will appear on
              this page.
            </p>
          </div>
        </div>
      ) : error ? (
        <div className="admin-table-card">
          <div className="ta-empty-state">
            <h3>Couldn't load your attendance</h3>
            <p>{error}</p>
          </div>
        </div>
      ) : (
        <>
          <div className="admin-stats-grid">
            <section className="admin-stat-card">
              <p className="admin-stat-label">Days Logged</p>
              <h3 className="admin-stat-value">{summary.daysThisMonth}</h3>
              <p className="admin-stat-meta">This month</p>
            </section>
            <section className="admin-stat-card">
              <p className="admin-stat-label">Hours Logged</p>
              <h3 className="admin-stat-value">{summary.hoursThisMonth}</h3>
              <p className="admin-stat-meta">This month</p>
            </section>
            <section className="admin-stat-card">
              <p className="admin-stat-label">Last Check-in</p>
              <h3 className="admin-stat-value" style={{ fontSize: 18 }}>
                {lastRecord ? formatTime(lastRecord.timeIn) : '—'}
              </h3>
              <p className="admin-stat-meta">{lastRecord ? formatDate(lastRecord.date) : 'No records yet'}</p>
            </section>
          </div>

          <div className="admin-table-card">
            <div className="admin-table-scroll">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Time In</th>
                    <th>Time Out</th>
                    <th>Hours</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {records.length === 0 ? (
                    <tr><td colSpan={5} style={{ textAlign: 'center', padding: '32px 0', color: '#6b7c75' }}>No check-ins recorded yet.</td></tr>
                  ) : records.map((r) => {
                    const hrs = hoursBetween(r.timeIn, r.timeOut)
                    return (
                      <tr key={r.date}>
                        <td data-label="Date">{formatDate(r.date)}</td>
                        <td data-label="Time In">{formatTime(r.timeIn)}</td>
                        <td data-label="Time Out">{formatTime(r.timeOut)}</td>
                        <td data-label="Hours">{hrs != null ? `${hrs}h` : '—'}</td>
                        <td data-label="Status">
                          <span className={`ta-status-pill ${r.timeOut ? 'ta-status-complete' : 'ta-status-open'}`}>
                            {r.timeOut ? 'Complete' : 'Still clocked in'}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </TherapistPageShell>
  )
}
