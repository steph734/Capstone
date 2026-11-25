import { useEffect, useMemo, useRef, useState } from 'react'
import { usePao } from '../../context/PaoContext'
import { identQuery } from '../../utils/paoApi'
import { Icon, Medal, Scenery, TopChips, badgeIcon, formatManila } from './HubParts'
import './hub.css'

const PAGE_SIZE = 8

// ── Detail popup: Esc / backdrop close, focus trapped, focus returns to the card ──
function BadgeDetail({ badge, onClose: onCloseProp, onPlay }) {
  const ref = useRef(null)
  const closeRef = useRef(onCloseProp)
  closeRef.current = onCloseProp
  const onClose = () => closeRef.current()
  useEffect(() => {
    const prev = document.activeElement
    const first = ref.current?.querySelector('button')
    first?.focus()
    const onKey = (e) => {
      if (e.key === 'Escape') { e.stopPropagation(); onClose(); return }
      if (e.key !== 'Tab') return
      const f = ref.current?.querySelectorAll('button, [href], [tabindex]:not([tabindex="-1"])')
      if (!f || !f.length) return
      const a = f[0]; const z = f[f.length - 1]
      if (e.shiftKey && document.activeElement === a) { e.preventDefault(); z.focus() }
      else if (!e.shiftKey && document.activeElement === z) { e.preventDefault(); a.focus() }
    }
    document.addEventListener('keydown', onKey, true)
    return () => { document.removeEventListener('keydown', onKey, true); prev?.focus?.() }
  }, [])

  const got = badge.earned
  const secret = badge.isSecret && !got
  const hasProg = !got && Number.isFinite(badge.progress) && Number.isFinite(badge.target)
  return (
    <div className="hb-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="hb-dialog" role="dialog" aria-modal="true" aria-label={secret ? 'Secret badge' : badge.name} ref={ref} style={{ minHeight: 480 }}>
        <button type="button" className="hb-x" aria-label="Close" onClick={onClose}><Icon name="x" size={20} /></button>
        <Medal icon={badgeIcon(badge.symbol)} state={got ? 'gold' : 'grey'} size={150} secret={secret} />
        <div className="hb-dname">{secret ? 'Secret badge' : badge.name}</div>
        {got
          ? <span className="hb-dstatus got"><Icon name="check" size={16} /> Collected!</span>
          : <span className="hb-dstatus locked"><Icon name="lock" size={16} /> Not yet earned</span>}
        <p className="hb-ddesc">
          {secret ? 'Keep playing to find out!' : (got ? (badge.description || 'Earned by playing.') : (badge.howToEarn || badge.description || 'Keep playing to earn this one.'))}
        </p>
        {hasProg && (
          <div className="hb-bprog" style={{ marginTop: 14, maxWidth: 300 }}>
            <div className="hb-prog"><i style={{ width: `${Math.round((badge.progress / badge.target) * 100)}%` }} /></div>
            <span>{badge.progress} of {badge.target}</span>
          </div>
        )}
        {badge.rewardOutfit && (
          <>
            <div className="hb-rlabel">REWARDS</div>
            <div className="hb-rchips"><span className="hb-rchip outfit">Outfit unlock: {badge.rewardOutfit}</span></div>
          </>
        )}
        <div className="hb-dspacer" />
        {got
          ? <button type="button" className="hb-dbtn" onClick={onClose}>Back to Badge Case</button>
          : onPlay
            ? <button type="button" className="hb-dbtn play" onClick={() => onPlay(badge.relatedGameName)}><Icon name="play" size={16} fill /> Play a game now</button>
            : <button type="button" className="hb-dbtn" onClick={onClose}>Back to Badge Case</button>}
      </div>
    </div>
  )
}

export function BadgeCaseView({ patientEmail, onBack, onPlayGame }) {
  const pao = usePao()
  const ident = pao?.ident || {}
  const query = identQuery(ident.activitySessionId || ident.patientEmail ? ident : { patientEmail })
  const [badges, setBadges] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [filter, setFilter] = useState('all')
  const [page, setPage] = useState(0)
  const [open, setOpen] = useState(null)
  const [selected, setSelected] = useState('')

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    fetch(`/api/pao/badges?${query}`)
      .then((r) => r.json())
      .then((b) => { if (!cancelled) { setBadges((b.badges || []).filter((x) => x.isActive)); setError(b.error || '') } })
      .catch(() => { if (!cancelled) setError('Could not load badges.') })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [query])

  const total = badges.length
  const collected = badges.filter((b) => b.earned).length
  const pct = total ? Math.round((collected / total) * 100) : 0
  const filtered = useMemo(() => badges.filter((b) => (filter === 'got' ? b.earned : filter === 'locked' ? !b.earned : true)), [badges, filter])
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const safePage = Math.min(page, pages - 1)
  const shown = filtered.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE)
  const marks = [5, 10, 15, total].filter((m, i, a) => m > 0 && m <= total && a.indexOf(m) === i)

  const setF = (f) => { setFilter(f); setPage(0) }

  return (
    <div className="hb-root">
      <Scenery />
      <TopChips onBack={onBack} />
      <div className="hb-scroll">
        <div className="hb-col case">
          <div className="hb-card hb-case">
            <div className="hb-chead">
              <div className="hb-trophy"><Icon name="trophy" size={30} /></div>
              <div className="hb-ctitle">
                <h2 className="hb-title">Pao's Badge Case</h2>
                <p className="hb-hint">{collected} of {total} badges collected. Each badge can unlock something new for Pao.</p>
              </div>
              <div className="hb-pct">{pct}%<small>complete</small></div>
            </div>

            <div className="hb-track" role="progressbar" aria-valuemin={0} aria-valuemax={total} aria-valuenow={collected} aria-label="Badges collected">
              <i style={{ width: `${total ? (collected / total) * 100 : 0}%` }} />
              {marks.map((m) => (
                <div key={m} className={`hb-mark ${collected >= m ? 'on' : ''}`} style={{ left: `${(m / total) * 100}%` }}><span>{m}</span></div>
              ))}
            </div>

            <div className="hb-chips" role="tablist" aria-label="Filter badges">
              {[['all', `All ${total}`], ['got', `Collected ${collected}`], ['locked', `Locked ${total - collected}`]].map(([k, label]) => (
                <button key={k} type="button" role="tab" aria-selected={filter === k} className={`hb-chip ${filter === k ? 'on' : ''}`} onClick={() => setF(k)}>{label}</button>
              ))}
            </div>

            {loading ? <p className="hb-hint">Loading badges...</p>
              : error ? <p className="hb-hint" role="alert">{error}</p>
              : shown.length === 0 ? <p className="hb-hint">Nothing here yet. Keep playing!</p>
              : (
                <div className="hb-bgrid">
                  {shown.map((b) => {
                    const got = b.earned
                    const secret = b.isSecret && !got
                    const hasProg = !got && !secret && Number.isFinite(b.progress) && Number.isFinite(b.target)
                    return (
                      <button key={b.code} type="button" data-badge={b.code}
                        className={`hb-bcard ${got ? 'got' : ''} ${selected === b.code ? 'sel' : ''}`}
                        onClick={() => { setSelected(b.code); setOpen(b) }}
                        aria-label={`${secret ? 'Secret badge' : b.name}, ${got ? 'collected' : 'locked'}`}>
                        <Medal icon={badgeIcon(b.symbol)} state={got ? 'gold' : 'grey'} size={84} secret={secret} />
                        <div className={`hb-bname ${secret ? 'secret' : ''}`}>{secret ? 'Secret badge' : b.name}</div>
                        <div className="hb-bdesc">{secret ? 'Keep playing to find out!' : got ? (b.description || 'Earned by playing') : (b.howToEarn || b.description || '')}</div>
                        <div className="hb-bfoot">
                          {got ? <span className="hb-pill got"><Icon name="check" size={15} /> Collected</span>
                            : secret ? <span className="hb-pill secret">Secret</span>
                            : hasProg ? (
                              <div className="hb-bprog">
                                <div className="hb-prog"><i style={{ width: `${Math.round((b.progress / b.target) * 100)}%` }} /></div>
                                <span>{b.progress}/{b.target}</span>
                              </div>
                            ) : <span className="hb-pill locked"><Icon name="lock" size={14} /> Locked</span>}
                        </div>
                      </button>
                    )
                  })}
                </div>
              )}

            <div className="hb-foot">
              <button type="button" className="hb-page" aria-label="Previous page" disabled={safePage === 0} onClick={() => setPage(safePage - 1)}><Icon name="chevronL" size={18} /></button>
              {Array.from({ length: pages }, (_, i) => (
                <button key={i} type="button" className={`hb-page ${i === safePage ? 'on' : ''}`} aria-label={`Page ${i + 1}`} aria-current={i === safePage ? 'page' : undefined} onClick={() => setPage(i)}>{i + 1}</button>
              ))}
              <button type="button" className="hb-page" aria-label="Next page" disabled={safePage >= pages - 1} onClick={() => setPage(safePage + 1)}><Icon name="chevronR" size={18} /></button>
              <span className="hb-pageof">Page {safePage + 1} of {pages}</span>
              <span style={{ flex: 1 }} />
              {onPlayGame && <button type="button" className="hb-btn play" style={{ flex: 'none', minHeight: 52 }} onClick={() => onPlayGame(null)}><Icon name="play" size={16} fill /> Play games to earn more</button>}
            </div>
          </div>
        </div>
      </div>
      {open && (
        <BadgeDetail badge={open} onPlay={onPlayGame}
          onClose={() => { setOpen(null); requestAnimationFrame(() => document.querySelector(`[data-badge="${open.code}"]`)?.focus()) }} />
      )}
    </div>
  )
}

export default BadgeCaseView
export { formatManila }
