import { useEffect, useRef, useState } from 'react'

// The therapist picks exactly which SOAP sections the guardian may read (and
// may add a parent-friendly summary). Guardians read in-app only; the email
// they get says a new note is available and contains none of this text.
const SECTIONS = [['subjective', 'Subjective'], ['objective', 'Objective'], ['assessment', 'Assessment'], ['plan', 'Plan']]
const DOMAINS = ['Cognitive', 'Physical', 'Occupational', 'Speech']

export default function ShareDialog({ note, onShare, onClose }) {
  const [sections, setSections] = useState(note.sharedSections || [])
  const [summary, setSummary] = useState('')
  const [domain, setDomain] = useState(DOMAINS[0])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const first = useRef(null)

  useEffect(() => {
    const prev = document.activeElement
    first.current?.focus()
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => { window.removeEventListener('keydown', onKey); prev?.focus?.() }
  }, [onClose])

  const toggle = (k) => setSections((cur) => (cur.includes(k) ? cur.filter((x) => x !== k) : [...cur, k]))
  const submit = async () => {
    setBusy(true); setError('')
    try { await onShare(sections, summary, domain) } catch (err) { setError(err.message); setBusy(false) }
  }

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(20,30,26,.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div role="dialog" aria-modal="true" aria-labelledby="share-title" onClick={(e) => e.stopPropagation()} style={{ background: '#fff', borderRadius: 18, padding: 22, width: 'min(460px, 100%)', maxHeight: '90vh', overflowY: 'auto' }}>
        <h3 id="share-title" style={{ margin: 0, fontSize: 18, color: '#1f3d36' }}>Share with the guardian</h3>
        <p style={{ fontSize: 13, color: '#5d7770', lineHeight: 1.5 }}>Only the sections you tick are readable, in the app. The guardian gets an email saying a note is available — never its content. You can unshare at any time.</p>
        <fieldset style={{ border: 'none', padding: 0, margin: '0 0 12px' }}>
          <legend style={{ fontWeight: 700, fontSize: 13, color: '#1f3d36', marginBottom: 4 }}>Sections to share</legend>
          {SECTIONS.map(([k, label], i) => (
            <label key={k} style={{ display: 'flex', alignItems: 'center', gap: 10, minHeight: 44, fontSize: 14 }}>
              <input ref={i === 0 ? first : null} type="checkbox" checked={sections.includes(k)} onChange={() => toggle(k)} style={{ width: 20, height: 20 }} /> {label}
            </label>
          ))}
        </fieldset>
        <label htmlFor="share-domain" style={{ fontWeight: 700, fontSize: 13, color: '#1f3d36' }}>Area</label>
        <select id="share-domain" value={domain} onChange={(e) => setDomain(e.target.value)} style={{ display: 'block', width: '100%', minHeight: 44, margin: '4px 0 12px', borderRadius: 10, border: '1px solid #d5ded9', padding: '0 10px', fontFamily: 'inherit' }}>
          {DOMAINS.map((d) => <option key={d}>{d}</option>)}
        </select>
        <label htmlFor="share-summary" style={{ fontWeight: 700, fontSize: 13, color: '#1f3d36' }}>Parent-friendly summary <span style={{ fontWeight: 400, color: '#5d7770' }}>(optional if you share sections)</span></label>
        <textarea id="share-summary" value={summary} maxLength={1000} rows={3} onChange={(e) => setSummary(e.target.value)} placeholder="e.g. Getting better at focus games this week!"
          style={{ display: 'block', width: '100%', boxSizing: 'border-box', margin: '4px 0 12px', borderRadius: 10, border: '1px solid #d5ded9', padding: 10, fontFamily: 'inherit', fontSize: 14 }} />
        {error && <p role="alert" style={{ color: '#b91c1c', fontSize: 13 }}>{error}</p>}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button type="button" className="tnp-ghost-btn" onClick={onClose}>Cancel</button>
          <button type="button" className="tnp-primary-btn" onClick={submit} disabled={busy || (!sections.length && !summary.trim())}>{busy ? 'Sharing…' : 'Share'}</button>
        </div>
      </div>
    </div>
  )
}
