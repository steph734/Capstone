import { useEffect, useState } from 'react'
import { db } from './db'
import { openRecord, watch } from './repo'

// "Saved on this device" strip for the Notes page: SOAP drafts that have not reached
// the server yet. Lets the therapist reopen them (offline or not) and see their state.
//   pending  -> waiting to sync
//   conflict -> changed on another device: resolve it from the status pill in the header
//   rejected -> the server refused it: the pill explains why
export default function OfflineDrafts({ patientId, onOpen }) {
  const [drafts, setDrafts] = useState([])

  useEffect(() => {
    const sub = watch(async () => {
      const rows = await db.soapNotes.where('patient_id').equals(String(patientId || '')).toArray()
      const unsent = rows.filter((r) => r.syncStatus && r.syncStatus !== 'synced')
      return Promise.all(unsent.map((r) => openRecord('soapNotes', r)))
    }, setDrafts)
    return () => sub.unsubscribe()
  }, [patientId])

  if (!drafts.length) return null
  const STATE = { pending: 'Waiting to sync', conflict: 'Needs review (see the sync badge)', rejected: 'Not accepted (see the sync badge)' }

  return (
    <div role="status" style={{ background: '#fff4d6', border: '1px solid #f3d284', borderRadius: 12, padding: '10px 14px', marginBottom: 12, fontSize: 14 }}>
      <strong style={{ color: '#92400e' }}>Saved on this device ({drafts.length})</strong>
      {drafts.map((d) => (
        <div key={d._id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginTop: 6, flexWrap: 'wrap' }}>
          <span style={{ color: '#4b5563' }}>
            Draft for {d.session_date}: {d.unreadable ? 'unreadable' : (d.subjective || d.objective || d.assessment || d.plan || '').slice(0, 50) || 'empty'} · {STATE[d.syncStatus] || d.syncStatus}
          </span>
          {d.syncStatus === 'pending' && !d.unreadable && (
            <button type="button" className="tnp-primary-btn" style={{ padding: '4px 12px' }} onClick={() => onOpen(d)}>Open</button>
          )}
        </div>
      ))}
    </div>
  )
}
