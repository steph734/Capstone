import { useCallback, useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { HelpCircle, Pencil, Plus, Search, ThumbsDown, ThumbsUp, X, Zap } from 'lucide-react'
import AdminPageShell from './AdminPageShell'
import { adminMenuItems } from './adminSidebarConfig'
import LockScreen from '../therapist/notes/IdleLock'
import { authFetch } from '../../utils/session'
import '../../components/support/support.css'
import './SupportTickets.css'

// /admin/support-faqs — what Pao knows. Edit the FAQs, see which ones help (or
// don't), and turn questions Pao could not answer into new FAQs.
const GREEN = '#234C40'
const ROLES = [['owner', 'Owner'], ['therapist', 'Therapist'], ['patient', 'Patient'], ['guardian', 'Guardian']]
const CATS = ['appointments', 'notes', 'games', 'billing', 'account', 'messages', 'technical', 'other']
const EMPTY = { question: '', answer: '', keywords: '', roles: [], category: 'other', link_label: '', link_path: '', is_quick_question: false, is_active: true }
const btn = (primary, disabled) => ({ minHeight: 44, borderRadius: 12, padding: '0 14px', fontWeight: 800, fontSize: 13.5, fontFamily: 'inherit', cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.55 : 1, border: primary ? 'none' : '1px solid #dbe3df', background: primary ? GREEN : '#fff', color: primary ? '#fff' : '#1f3d36', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6, whiteSpace: 'nowrap' })

function FaqDrawer({ initial, editingId, onClose, onSaved, onFail }) {
  const [f, setF] = useState({ ...EMPTY, ...initial, keywords: Array.isArray(initial.keywords) ? initial.keywords.join(', ') : initial.keywords || '' })
  const [errors, setErrors] = useState({})
  const [busy, setBusy] = useState(false)
  const first = useRef(null)
  useEffect(() => { first.current?.focus(); const k = (e) => { if (e.key === 'Escape') onClose() }; window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k) }, [onClose])
  const set = (k, v) => { setF((x) => ({ ...x, [k]: v })); setErrors((e) => ({ ...e, [k]: '' })) }
  const toggleRole = (r) => set('roles', f.roles.includes(r) ? f.roles.filter((x) => x !== r) : [...f.roles, r])
  const save = async () => {
    setBusy(true)
    try {
      await authFetch(editingId ? `/api/admin/faqs/${editingId}` : '/api/admin/faqs', { method: editingId ? 'PATCH' : 'POST', body: { ...f, keywords: f.keywords.split(',').map((s) => s.trim()).filter(Boolean) } })
      onSaved()
    } catch (e) { if (e.fields) setErrors(e.fields); else onFail(e); setBusy(false) }
  }
  const field = (id, label, node, err) => <div className="faq-field"><label htmlFor={id}>{label}</label>{node}{err && <span role="alert" className="sup-error">{err}</span>}</div>
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(20,30,26,.45)', display: 'flex', justifyContent: 'flex-end' }}>
      <aside role="dialog" aria-modal="true" aria-label={editingId ? 'Edit FAQ' : 'Add FAQ'} onClick={(e) => e.stopPropagation()} style={{ width: 'min(520px, 100%)', height: '100%', overflowY: 'auto', background: '#fff', padding: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8 }}><h2 style={{ margin: 0, fontSize: 20, color: '#1f3d36', flex: 1 }}>{editingId ? 'Edit FAQ' : 'Add FAQ'}</h2><button type="button" aria-label="Close" style={{ ...btn(false), width: 44, padding: 0 }} onClick={onClose}><X size={18} aria-hidden="true" /></button></div>
        {field('faq-q', 'Question', <input id="faq-q" ref={first} className={errors.question ? 'sup-bad' : ''} value={f.question} maxLength={200} onChange={(e) => set('question', e.target.value)} />, errors.question)}
        {field('faq-a', 'Answer (supports **bold** and numbered steps)', <textarea id="faq-a" className={errors.answer ? 'sup-bad' : ''} rows={7} maxLength={3000} value={f.answer} onChange={(e) => set('answer', e.target.value)} />, errors.answer)}
        {field('faq-k', 'Keywords (comma separated, include Filipino / Bisaya words)', <input id="faq-k" value={f.keywords} onChange={(e) => set('keywords', e.target.value)} placeholder="paano, unsaon, bayad, magpa-book" />)}
        <fieldset className="faq-roles"><legend>Who sees it</legend>{ROLES.map(([id, label]) => <label key={id}><input type="checkbox" checked={f.roles.includes(id)} onChange={() => toggleRole(id)} /> {label}</label>)}{errors.roles && <span role="alert" className="sup-error">{errors.roles}</span>}</fieldset>
        {field('faq-c', 'Topic', <select id="faq-c" value={f.category} onChange={(e) => set('category', e.target.value)}>{CATS.map((c) => <option key={c} value={c}>{c}</option>)}</select>, errors.category)}
        {field('faq-ll', 'Button text (optional)', <input id="faq-ll" value={f.link_label} maxLength={40} onChange={(e) => set('link_label', e.target.value)} />, errors.link_label)}
        {field('faq-lp', 'Opens this page (in-app path, e.g. /appointments)', <input id="faq-lp" value={f.link_path} maxLength={200} onChange={(e) => set('link_path', e.target.value)} />, errors.link_path)}
        <label className="faq-check"><input type="checkbox" checked={f.is_quick_question} onChange={(e) => set('is_quick_question', e.target.checked)} /> Show as a quick-question button when Pao opens</label>
        <label className="faq-check"><input type="checkbox" checked={f.is_active} onChange={(e) => set('is_active', e.target.checked)} /> Active (Pao uses it)</label>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}><button type="button" style={btn(false)} onClick={onClose}>Cancel</button><button type="button" style={btn(true, busy)} disabled={busy} onClick={save}>{busy ? 'Saving…' : 'Save FAQ'}</button></div>
      </aside>
    </div>
  )
}

export default function SupportFaqsPage({ user, onLogout }) {
  const [params, setParams] = useSearchParams()
  const tab = params.get('tab') === 'misses' ? 'misses' : 'faqs'
  const q = params.get('q') || ''
  const role = params.get('role') || ''
  const [data, setData] = useState(null)
  const [misses, setMisses] = useState(null)
  const [drawer, setDrawer] = useState(null) // { initial, editingId, fromMiss }
  const [error, setError] = useState('')
  const [locked, setLocked] = useState(false)
  const [toast, setToast] = useState('')
  const setParam = (patch) => setParams((p) => { const n = new URLSearchParams(p); for (const [k, v] of Object.entries(patch)) { if (v) n.set(k, v); else n.delete(k) } return n }, { replace: true })
  const fail = useCallback((e) => { if (e.code === 'SESSION_LOCKED') setLocked(true); else setError(e.code === 'NO_SESSION' ? 'Please sign in again with your Super Admin account.' : e.message) }, [])
  const flash = (m) => { setToast(m); setTimeout(() => setToast(''), 2600) }

  const load = useCallback(() => { const qs = { limit: 100 }; if (q) qs.q = q; if (role) qs.role = role; return authFetch('/api/admin/faqs', { query: qs }).then((b) => { setData(b); setError('') }).catch(fail) }, [q, role, fail])
  const loadMisses = useCallback(() => authFetch('/api/admin/faqs/misses').then((b) => setMisses(b.misses)).catch(fail), [fail])
  useEffect(() => { load() }, [load])
  useEffect(() => { loadMisses() }, [loadMisses])

  const toggle = async (f) => { try { await authFetch(`/api/admin/faqs/${f.id}`, { method: 'PATCH', body: { is_active: !f.is_active } }); load() } catch (e) { fail(e) } }
  const dismiss = async (text) => { try { await authFetch('/api/admin/faqs/misses', { method: 'DELETE', query: { text } }); loadMisses() } catch (e) { fail(e) } }
  const saved = () => { const miss = drawer?.fromMiss; setDrawer(null); flash('FAQ saved'); load(); if (miss) dismiss(miss) }

  return (
    <AdminPageShell user={user} onLogout={onLogout} title="FAQs" subtitle="What Pao knows, and what it couldn't answer" menuItems={adminMenuItems}
      headerActions={<button type="button" style={btn(true)} onClick={() => setDrawer({ initial: {}, editingId: null })}><Plus size={16} aria-hidden="true" /> Add FAQ</button>}>
      <div className="st-wrap">
        {error && <div role="alert" className="st-alert">{error}</div>}
        <div className="st-bar">
          <div className="st-tabs" role="tablist"><button type="button" role="tab" aria-selected={tab === 'faqs'} className={tab === 'faqs' ? 'on' : ''} onClick={() => setParam({ tab: '' })}>FAQs <span>{data?.total ?? 0}</span></button><button type="button" role="tab" aria-selected={tab === 'misses'} className={tab === 'misses' ? 'on' : ''} onClick={() => setParam({ tab: 'misses' })}>Unanswered questions <span>{misses?.length ?? 0}</span></button></div>
          {tab === 'faqs' && <>
            <label className="st-search"><Search size={16} aria-hidden="true" /><input type="search" value={q} placeholder="Search questions, answers, keywords…" aria-label="Search FAQs" onChange={(e) => setParam({ q: e.target.value })} /></label>
            <select aria-label="Role" value={role} onChange={(e) => setParam({ role: e.target.value })}><option value="">All roles</option>{ROLES.map(([id, l]) => <option key={id} value={id}>{l}</option>)}</select></>}
        </div>

        {tab === 'faqs' && (
          <div className="faq-table-wrap">
            {!data ? <p className="sup-muted">Loading…</p> : data.faqs.length === 0 ? <p className="sup-muted st-empty">No FAQs match.</p> : (
              <table className="faq-table">
                <thead><tr><th scope="col">Question</th><th scope="col">Roles</th><th scope="col">Topic</th><th scope="col"><span className="sr-only">Helpful</span><ThumbsUp size={14} aria-hidden="true" /> / <ThumbsDown size={14} aria-hidden="true" /></th><th scope="col">Active</th><th scope="col"><span className="sr-only">Edit</span></th></tr></thead>
                <tbody>
                  {data.faqs.map((f) => (
                    <tr key={f.id} className={f.is_active ? '' : 'off'}>
                      <td><strong>{f.question}</strong>{f.is_quick_question && <span className="faq-quick"><Zap size={12} aria-hidden="true" /> quick</span>}</td>
                      <td>{f.roles.map((r) => <span key={r} className="st-cat">{r}</span>)}</td>
                      <td>{f.category}</td>
                      <td><span className="faq-votes"><b>{f.helpful_count}</b> / <b className={f.not_helpful_count > f.helpful_count ? 'bad' : ''}>{f.not_helpful_count}</b></span></td>
                      <td><label className="faq-switch"><input type="checkbox" role="switch" checked={f.is_active} aria-label={`${f.question} active`} onChange={() => toggle(f)} /></label></td>
                      <td><button type="button" style={btn(false)} onClick={() => setDrawer({ initial: f, editingId: f.id })}><Pencil size={15} aria-hidden="true" /> Edit</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {tab === 'misses' && (
          <div className="faq-table-wrap">
            <p className="sup-muted" style={{ marginTop: 0 }}>Questions people asked that Pao couldn't answer (kept for 180 days), grouped by text.</p>
            {!misses ? <p className="sup-muted">Loading…</p> : misses.length === 0 ? <p className="sup-muted st-empty"><HelpCircle size={18} aria-hidden="true" /> Nothing unanswered right now.</p> : (
              <table className="faq-table">
                <thead><tr><th scope="col">Question</th><th scope="col">Asked</th><th scope="col">By</th><th scope="col"><span className="sr-only">Actions</span></th></tr></thead>
                <tbody>
                  {misses.map((m) => (
                    <tr key={m.text}>
                      <td><strong>{m.text}</strong></td>
                      <td>{m.count}×</td>
                      <td>{m.roles.map((r) => <span key={r} className="st-cat">{r}</span>)}</td>
                      <td style={{ whiteSpace: 'nowrap' }}><button type="button" style={btn(true)} onClick={() => setDrawer({ initial: { question: m.text.slice(0, 200), roles: m.roles.includes('guardian') ? ['guardian', 'patient'] : m.roles, keywords: m.text.toLowerCase().slice(0, 40) }, editingId: null, fromMiss: m.text })}>Create FAQ</button> <button type="button" style={btn(false)} onClick={() => dismiss(m.text)}>Dismiss</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>
      {drawer && <FaqDrawer initial={drawer.initial} editingId={drawer.editingId} onClose={() => setDrawer(null)} onSaved={saved} onFail={fail} />}
      {toast && <div role="status" className="st-toast">{toast}</div>}
      {locked && <LockScreen reason="Your session was locked after a period of inactivity." userName={user?.name} onUnlocked={() => { setLocked(false); load() }} onSignOut={onLogout} />}
    </AdminPageShell>
  )
}
