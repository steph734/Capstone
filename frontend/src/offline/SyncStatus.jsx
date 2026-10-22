import { useEffect, useState, useSyncExternalStore } from 'react'
import { getSyncState, subscribeSync, syncNow, resolveKeepMine, resolveUseTheirs, dismissRejected } from './syncService'
import { db, SYNCED_COLLECTIONS } from './db'
import { openRecord, watch } from './repo'

// How many header-placed pills are on screen. The floating pill (used on pages without a
// header slot) hides itself while a header one exists, so there is never a double pill.
let inlineCount = 0
const inlineListeners = new Set()
const notifyInline = () => inlineListeners.forEach((fn) => fn())
const subscribeInline = (fn) => { inlineListeners.add(fn); return () => inlineListeners.delete(fn) }
const hasInlinePill = () => inlineCount > 0

// Small status pill for the page header: Online / Offline / "N changes pending" / Sync error.
// When something needs the therapist's attention (a SOAP conflict, a refused change)
// the pill shows "Review" and opens the dialog below.
export default function SyncStatus({ floating = false }) {
  const s = useSyncExternalStore(subscribeSync, getSyncState)
  const [open, setOpen] = useState(false)
  const attention = s.conflicts + s.rejected
  const inlineExists = useSyncExternalStore(subscribeInline, hasInlinePill)
  useEffect(() => {
    if (floating) return undefined
    inlineCount += 1; notifyInline()
    return () => { inlineCount -= 1; notifyInline() }
  }, [floating])

  // Set when a page was answered from the saved (offline) copy instead of the server.
  const [cachedAt, setCachedAt] = useState(null)
  useEffect(() => {
    const onCache = (e) => setCachedAt(e.detail?.savedAt || new Date().toISOString())
    const onOnline = () => setCachedAt(null) // the next load is live again
    window.addEventListener('tp:offline-cache', onCache)
    window.addEventListener('online', onOnline)
    return () => { window.removeEventListener('tp:offline-cache', onCache); window.removeEventListener('online', onOnline) }
  }, [])

  let label = 'Online'
  let tone = 'ok'
  if (!s.online) { label = s.pending ? `Offline · ${s.pending} pending` : 'Offline'; tone = 'off' }
  else if (s.needsLogin) { label = s.pending ? `Sign in to sync · ${s.pending} pending` : 'Sign in to sync'; tone = 'warn' }
  else if (s.locked) { label = s.pending ? `Locked · ${s.pending} pending` : 'Locked: unlock to sync'; tone = 'warn' }
  else if (s.error) { label = 'Sync error'; tone = 'bad' }
  else if (s.syncing) { label = 'Syncing…'; tone = 'busy' }
  else if (s.pending) { label = `${s.pending} change${s.pending === 1 ? '' : 's'} pending`; tone = 'warn' }

  const colors = {
    ok: ['#e3f4e8', '#1f7a45'], off: ['#eceff1', '#4b5563'], warn: ['#fff4d6', '#92400e'], bad: ['#fde8e8', '#b91c1c'], busy: ['#ede9fe', '#5b21b6'],
  }[tone]

  const body = (
    <>
      <button
        type="button"
        onClick={() => (attention ? setOpen(true) : syncNow({ force: true }))}
        title={s.error || (attention ? 'Some changes need your attention' : 'Tap to sync now')}
        aria-live="polite"
        style={{ display: 'inline-flex', alignItems: 'center', gap: 6, border: 'none', cursor: 'pointer', borderRadius: 999, padding: '6px 12px', fontSize: 13, fontWeight: 700, background: colors[0], color: colors[1] }}
      >
        <span aria-hidden="true" style={{ width: 8, height: 8, borderRadius: '50%', background: colors[1] }} />
        {label}
        {attention > 0 && <span style={{ background: '#b91c1c', color: '#fff', borderRadius: 999, padding: '1px 8px', marginLeft: 4 }}>Review {attention}</span>}
      </button>
      {open && attention > 0 && <ReviewDialog onClose={() => setOpen(false)} />}
    </>
  )
  if (!floating) return body
  if (inlineExists) return null // a header pill is already showing
  // Patients and owners have no shared header, so the pill floats in the bottom-left corner.
  return (
    <div style={{ position: 'fixed', left: 16, bottom: 16, zIndex: 9000, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', maxWidth: 'calc(100vw - 32px)' }}>
      {body}
      {cachedAt && !s.online && (
        <span style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 999, padding: '4px 10px', fontSize: 12, color: '#4b5563', boxShadow: '0 1px 4px rgba(0,0,0,.12)' }}>
          Showing data saved {new Date(cachedAt).toLocaleString()}
        </span>
      )}
    </div>
  )
}

const LABELS = { soapNotes: 'Session note', appointments: 'Appointment', gameSessions: 'Game session', speechRecordings: 'Recording', leaveDecisions: 'Leave decision' }
const SOAP = [['subjective', 'Subjective'], ['objective', 'Objective'], ['assessment', 'Assessment'], ['plan', 'Plan']]

// Everything the server refused or that changed on another device.
function ReviewDialog({ onClose }) {
  const [items, setItems] = useState([])

  useEffect(() => {
    const sub = watch(async () => {
      const found = []
      for (const c of SYNCED_COLLECTIONS) {
        if (c === 'patients') continue
        for (const status of ['conflict', 'rejected']) {
          for (const row of await db[c].where('syncStatus').equals(status).toArray()) found.push({ collection: c, rec: await openRecord(c, row) })
        }
      }
      return found
    }, setItems)
    return () => sub.unsubscribe()
  }, [])

  useEffect(() => { if (!items.length) onClose() }, [items.length]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div role="dialog" aria-modal="true" aria-label="Changes that need your attention" style={{ position: 'fixed', inset: 0, zIndex: 100000, background: 'rgba(30,25,60,.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ background: '#fff', borderRadius: 18, maxWidth: 760, width: '100%', maxHeight: '90vh', overflowY: 'auto', padding: 22 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <h2 style={{ margin: 0, fontSize: 20 }}>Changes that need your attention</h2>
          <button type="button" onClick={onClose} style={btn('#eee', '#333')}>Close</button>
        </div>
        {items.map(({ collection, rec }) => (
          <div key={`${collection}-${rec._id}`} style={{ border: '1px solid #e5e7eb', borderRadius: 12, padding: 14, marginBottom: 12 }}>
            {rec.syncStatus === 'conflict' && collection === 'soapNotes' ? <SoapConflict rec={rec} /> : <Rejected collection={collection} rec={rec} />}
          </div>
        ))}
      </div>
    </div>
  )
}

function SoapConflict({ rec }) {
  const server = rec.serverCopy || {}
  const locked = rec.conflictCode === 'NOTE_LOCKED'
  return (
    <>
      <strong style={{ color: '#b45309' }}>This note was changed on another device</strong>
      <p style={{ margin: '6px 0 10px', fontSize: 14, color: '#4b5563' }}>
        Session note for {rec.session_date}. {locked ? 'It was already signed on the server, so it can no longer be edited here.' : 'Your changes were not saved over it. Choose which version to keep.'}
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <Version title="Your version (this device)" note={rec} />
        <Version title={`Other version (v${server.version ?? '?'})`} note={server} />
      </div>
      <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
        {!locked && <button type="button" onClick={() => resolveKeepMine('soapNotes', rec._id)} style={btn('#6D4AE0', '#fff')}>Keep my version</button>}
        <button type="button" onClick={() => resolveUseTheirs('soapNotes', rec._id)} style={btn('#e0e7ff', '#3730a3')}>{locked ? 'Discard my changes' : 'Use the other version'}</button>
      </div>
    </>
  )
}

function Version({ title, note }) {
  return (
    <div style={{ background: '#f9fafb', borderRadius: 10, padding: 10, fontSize: 13 }}>
      <div style={{ fontWeight: 800, marginBottom: 6 }}>{title}</div>
      {SOAP.map(([k, label]) => (
        <p key={k} style={{ margin: '0 0 6px' }}><b>{label}:</b> {note[k] || <em style={{ color: '#9ca3af' }}>empty</em>}</p>
      ))}
    </div>
  )
}

function Rejected({ collection, rec }) {
  return (
    <>
      <strong style={{ color: '#b91c1c' }}>{LABELS[collection] || 'Change'} not saved</strong>
      <p style={{ margin: '6px 0 10px', fontSize: 14, color: '#4b5563' }}>{rec.rejectedMessage || 'The server did not accept this change.'}</p>
      <button type="button" onClick={() => dismissRejected(collection, rec._id)} style={btn('#eee', '#333')}>OK, remove it</button>
    </>
  )
}

const btn = (bg, color) => ({ border: 'none', cursor: 'pointer', borderRadius: 10, padding: '8px 14px', fontWeight: 700, background: bg, color })
