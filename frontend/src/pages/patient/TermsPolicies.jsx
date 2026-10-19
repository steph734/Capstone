import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { jsPDF } from 'jspdf'
import { Calendar, Clock, Clock3, CreditCard, Download, Heart, IdCard, Lock, MapPin, Menu, Phone, Printer, Search, Shield, Square, Video, Volume2, HelpCircle } from 'lucide-react'
import PatientSidebar from '../../components/PatientSidebar'
import { POLICIES } from '../../content/brickpathPolicies'
import { speakPao, stopPaoVoice } from '../../utils/paoVoice'
import '../SubscriptionPage.css'
import './TermsPolicies.css'

const ICONS = { calendar: Calendar, clock: Clock, 'credit-card': CreditCard, 'id-card': IdCard, lock: Lock, heart: Heart, video: Video, shield: Shield, phone: Phone }
const TONES = ['green', 'amber', 'indigo', 'teal', 'rose', 'sky', 'violet', 'emerald', 'orange']
const plain = (s) => s.replace(/\*\*/g, '')

// Highlights every match of `term` (case-insensitive, no regular expressions) inside `text`.
function highlight(text, term, keyBase) {
  if (!term) return text
  const lower = text.toLowerCase()
  const needle = term.toLowerCase()
  const out = []
  let i = 0
  let n = 0
  while (i < text.length) {
    const at = lower.indexOf(needle, i)
    if (at < 0) { out.push(text.slice(i)); break }
    if (at > i) out.push(text.slice(i, at))
    out.push(<mark key={`${keyBase}-${n++}`}>{text.slice(at, at + needle.length)}</mark>)
    i = at + needle.length
  }
  return out
}

// Simple, safe renderer for **bold** (no dangerouslySetInnerHTML).
function Rich({ text, term }) {
  return text.split('**').map((part, i) => (i % 2 ? <strong key={i}>{highlight(part, term, i)}</strong> : <Fragment key={i}>{highlight(part, term, i)}</Fragment>))
}

function buildPdf() {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const W = doc.internal.pageSize.getWidth()
  let y = 20
  const ensure = (h) => { if (y + h > 280) { doc.addPage(); y = 20 } }
  doc.setFontSize(20); doc.setTextColor(26, 58, 48); doc.text(POLICIES.title, 14, y); y += 8
  doc.setFontSize(10); doc.setTextColor(90)
  const sum = doc.splitTextToSize(POLICIES.summary, W - 28); doc.text(sum, 14, y); y += sum.length * 5 + 2
  doc.text(`${POLICIES.clinic} · ${POLICIES.location} · Updated ${POLICIES.updated}`, 14, y); y += 10
  POLICIES.sections.forEach((s, i) => {
    ensure(20)
    doc.setFontSize(13); doc.setTextColor(26, 58, 48); doc.text(`${i + 1}. ${s.title}`, 14, y); y += 7
    doc.setFontSize(10.5); doc.setTextColor(50)
    s.items.forEach((it) => {
      const lines = doc.splitTextToSize(`•  ${plain(it)}`, W - 32)
      ensure(lines.length * 5 + 2)
      doc.text(lines, 18, y); y += lines.length * 5 + 1.5
    })
    y += 4
  })
  const n = doc.getNumberOfPages()
  for (let p = 1; p <= n; p += 1) { doc.setPage(p); doc.setFontSize(9); doc.setTextColor(130); doc.text(`${POLICIES.clinic} · Updated ${POLICIES.updated} · Page ${p} of ${n}`, W / 2, 290, { align: 'center' }) }
  return doc
}

export default function TermsPolicies({ user, onLogout, betaTier }) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(POLICIES.sections[0].key)
  const [reading, setReading] = useState(false)
  const refs = useRef({})
  const currentUser = user || { name: 'Patient', role: 'Patient', avatar: '/therapy-pro-logo.png' }

  const words = useMemo(() => POLICIES.sections.reduce((n, s) => n + s.title.split(/\s+/).length + s.items.join(' ').split(/\s+/).length, 0), [])
  const minutes = Math.max(1, Math.ceil(words / 200))
  const term = query.trim()
  const shown = useMemo(() => POLICIES.sections.map((s, i) => ({ ...s, n: i + 1 })).filter((s) => !term || `${s.title} ${s.items.map(plain).join(' ')}`.toLowerCase().includes(term.toLowerCase())), [term])

  // Highlights the section in view.
  useEffect(() => {
    const els = shown.map((s) => refs.current[s.key]).filter(Boolean)
    if (!els.length) return undefined
    const io = new IntersectionObserver((entries) => {
      const vis = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0]
      if (vis) setActive(vis.target.dataset.key)
    }, { rootMargin: '-120px 0px -60% 0px', threshold: 0 })
    els.forEach((el) => io.observe(el))
    return () => io.disconnect()
  }, [shown])

  useEffect(() => () => stopPaoVoice(), [])
  // Printing always includes every section, even when a search is active.
  useEffect(() => {
    const clear = () => setQuery('')
    window.addEventListener('beforeprint', clear)
    return () => window.removeEventListener('beforeprint', clear)
  }, [])

  const go = (key) => { setActive(key); refs.current[key]?.scrollIntoView({ behavior: 'smooth', block: 'start' }) }
  const readIt = () => {
    if (reading) { stopPaoVoice(); setReading(false); return }
    const s = POLICIES.sections.find((x) => x.key === active) || POLICIES.sections[0]
    setReading(true)
    speakPao(`${s.title}. ${s.items.map(plain).join(' ')}`, { rate: 0.9, pitch: 1, onEnd: () => setReading(false) })
  }

  return (
    <div className="subscription-layout terms-layout">
      <PatientSidebar user={currentUser} onLogout={onLogout} isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} betaTier={betaTier} profilePath="/patient/profile" />

      <div className="subscription-main terms-main">
        <button className="mobile-menu-btn" onClick={() => setSidebarOpen(true)} aria-label="Open menu"><Menu size={22} /></button>

        <section className="terms-hero">
          <div>
            <h1>{POLICIES.title}</h1>
            <p>{POLICIES.summary}</p>
            <div className="terms-chips">
              <span><MapPin size={15} aria-hidden="true" /> {POLICIES.location}</span>
              <span><Clock3 size={15} aria-hidden="true" /> Updated {POLICIES.updated}</span>
              <span><Clock size={15} aria-hidden="true" /> About {minutes} min read</span>
            </div>
          </div>
          <div className="terms-actions">
            <button type="button" onClick={() => buildPdf().save('brickpath-terms-and-policies.pdf')}><Download size={17} aria-hidden="true" /> Download PDF</button>
            <button type="button" onClick={() => { setQuery(''); setTimeout(() => window.print(), 80) }}><Printer size={17} aria-hidden="true" /> Print</button>
            <button type="button" onClick={readIt} aria-pressed={reading}>{reading ? <Square size={17} aria-hidden="true" /> : <Volume2 size={17} aria-hidden="true" />} {reading ? 'Stop reading' : 'Read it to me'}</button>
          </div>
        </section>

        <div className="terms-body">
          <aside className="terms-toc" aria-label="On this page">
            <label className="terms-search"><Search size={16} aria-hidden="true" /><input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search policies…" aria-label="Search policies" /></label>
            <p className="terms-toc-label">ON THIS PAGE</p>
            <select className="terms-toc-select" value={active} onChange={(e) => go(e.target.value)} aria-label="Jump to a section">
              {shown.map((s) => <option key={s.key} value={s.key}>{s.n}. {s.title}</option>)}
            </select>
            <ol>
              {shown.map((s) => (
                <li key={s.key}><button type="button" className={active === s.key ? 'on' : ''} onClick={() => go(s.key)} aria-current={active === s.key ? 'true' : undefined}><span>{s.n}</span>{s.title}</button></li>
              ))}
            </ol>
          </aside>

          <div className="terms-sections">
            {shown.length === 0 && <div className="terms-card terms-none">No results for “{term}”.</div>}
            {shown.map((s) => {
              const Icon = ICONS[s.icon] || Shield
              return (
                <section key={s.key} data-key={s.key} ref={(el) => { refs.current[s.key] = el }} id={`policy-${s.key}`} className="terms-card">
                  <h2><span className={`terms-ico tone-${TONES[(s.n - 1) % TONES.length]}`}><Icon size={22} aria-hidden="true" /></span>{s.n}. {highlight(s.title, term, 't')}</h2>
                  <ul>{s.items.map((it, i) => <li key={i}><Rich text={it} term={term} /></li>)}</ul>
                </section>
              )
            })}
            <div className="terms-help">
              <HelpCircle size={22} aria-hidden="true" />
              <p>Have a question about a policy? Message your therapist or the front desk from <Link to="/messages"><b>Messages</b></Link>, or ask Pao in <Link to="/help"><b>Help &amp; Support</b></Link>.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
