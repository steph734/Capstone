import { useEffect, useMemo, useRef, useState } from 'react'

// "Who is playing today?" — the therapist picks the child who will play (or
// practice mode). Same structure as the Speech-to-Text picker: search, sort,
// patient list with radio rows, Remember checkbox, Start, practice link.
const SORTS = ['today', 'az', 'recent']
const SORT_LABEL = { today: "Today's patients first", az: 'A to Z', recent: 'Recently played' }
const LANG_NAME = { en: 'English', tl: 'Tagalog', ceb: 'Cebuano' }
const HEADING = { fontFamily: "'Baloo 2', system-ui, sans-serif" }
const BODY = { fontFamily: "'Atkinson Hyperlegible', system-ui, sans-serif" }
const AVATAR_COLOURS = ['#7c3aed', '#2563eb', '#db2777', '#ea580c', '#059669', '#0891b2']

function colourFor(id) {
  let h = 0
  for (const ch of String(id)) h = (h * 31 + ch.charCodeAt(0)) >>> 0
  return AVATAR_COLOURS[h % AVATAR_COLOURS.length]
}

function playedLabel(iso) {
  if (!iso) return 'Never played'
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000)
  if (days <= 0) return 'Played today'
  if (days === 1) return 'Played yesterday'
  return `${days} days ago`
}

export default function WhoIsPlayingModal({
  therapistEmail, language = 'en', onChangeVoice, onStart, onGoToGames, onClose, confirmed = null,
}) {
  const [search, setSearch] = useState('')
  const [debounced, setDebounced] = useState('')
  const [sort, setSort] = useState('today')
  const [players, setPlayers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selectedId, setSelectedId] = useState(null)
  const [remember, setRemember] = useState(true)
  const [busy, setBusy] = useState(false)
  const dialogRef = useRef(null)
  const rowRefs = useRef({})

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search.trim()), 250)
    return () => clearTimeout(t)
  }, [search])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    const qs = new URLSearchParams({ employeeEmail: therapistEmail || '', sort })
    if (debounced) qs.set('search', debounced)
    fetch(`/api/activities/players?${qs}`)
      .then((r) => r.json().then((b) => ({ ok: r.ok, b })))
      .then(({ ok, b }) => {
        if (cancelled) return
        if (!ok) throw new Error(b.error || 'Could not load patients.')
        setPlayers(b.players || [])
        setError('')
      })
      .catch((e) => { if (!cancelled) setError(e.message) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [therapistEmail, debounced, sort])

  const selected = useMemo(() => players.find((p) => p.id === selectedId) || null, [players, selectedId])

  // Escape closes; Tab stays inside the dialog (focus trap).
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') { onClose?.(); return }
      if (e.key !== 'Tab' || !dialogRef.current) return
      const focusables = dialogRef.current.querySelectorAll('button:not([disabled]), input, [tabindex]:not([tabindex="-1"])')
      if (!focusables.length) return
      const first = focusables[0]
      const last = focusables[focusables.length - 1]
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus() }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus() }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  const moveSelection = (delta) => {
    if (!players.length) return
    const idx = players.findIndex((p) => p.id === selectedId)
    const next = players[Math.min(players.length - 1, Math.max(0, idx + delta))]
    setSelectedId(next.id)
    rowRefs.current[next.id]?.focus()
  }

  const onRowKey = (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); moveSelection(1) }
    if (e.key === 'ArrowUp') { e.preventDefault(); moveSelection(-1) }
  }

  const cycleSort = () => setSort((s) => SORTS[(SORTS.indexOf(s) + 1) % SORTS.length])

  const handleStart = async () => {
    if (!selected || busy) return
    setBusy(true)
    try {
      await onStart({ patientId: selected.id, mode: 'patient', remember, language, player: selected })
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  const handlePractice = async () => {
    if (busy) return
    setBusy(true)
    try {
      await onStart({ patientId: null, mode: 'practice', remember: false, language, player: null })
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  // Confirmation view after a player (or practice) is chosen.
  if (confirmed) {
    const practice = confirmed.mode === 'practice'
    const name = confirmed.patient?.displayName
    const pao = confirmed.patient?.pao
    return (
      <Shell dialogRef={dialogRef} onClose={onClose} label="Ready to play">
        <div className="text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#ede9fe] text-[30px]" aria-hidden="true">🐼</div>
          <h2 className="mt-3 text-[28px] font-extrabold text-[#2B2A4C]" style={HEADING}>
            {practice ? 'Practice mode' : `${name} is ready to play!`}
          </h2>
          <p className="mt-2 text-[15px] text-[#5A5670]">
            {practice
              ? 'Nothing is saved to a patient record in practice mode. No XP, stats or badges are kept.'
              : "Pao's XP, level, stats, badges and outfits will be saved to this record."}
          </p>
          {!practice && pao && (
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              <span className="rounded-full bg-[#ede9fe] px-3 py-1.5 text-[14px] font-extrabold text-[#5b21b6]">Pao level {pao.level}</span>
              <span className="rounded-full bg-[#FFF0CC] px-3 py-1.5 text-[14px] font-bold text-[#C97A00]">{pao.xpToNext == null ? 'Max level' : `${pao.xpToNext - pao.xp} XP to next level`}</span>
            </div>
          )}
          <div className="mt-6 flex flex-col gap-2.5">
            <button type="button" onClick={onGoToGames} className="h-14 rounded-2xl bg-[#6D4AE0] text-[18px] font-extrabold text-white shadow-md focus-visible:outline focus-visible:outline-4 focus-visible:outline-[#3B82F6]">Go to games</button>
            <button type="button" onClick={confirmed.onChangePlayer} className="h-12 rounded-2xl border-2 border-[#E4DFCE] bg-white text-[16px] font-bold text-[#5A5670] focus-visible:outline focus-visible:outline-4 focus-visible:outline-[#3B82F6]">Change player</button>
          </div>
        </div>
      </Shell>
    )
  }

  return (
    <Shell dialogRef={dialogRef} onClose={onClose} label="Who is playing today?">
      {/* Header */}
      <div className="-mx-7 -mt-7 mb-5 rounded-t-[28px] px-7 pb-5 pt-6 text-white" style={{ background: 'linear-gradient(135deg,#6D4AE0,#4A8FE7)' }}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-[26px] font-extrabold leading-tight" style={HEADING}>Who is playing today?</h2>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-[14px] font-bold">
              <span className="rounded-full bg-white/20 px-3 py-1">Pao speaks {LANG_NAME[language] || 'English'}</span>
              <button type="button" onClick={onChangeVoice} className="underline underline-offset-2 focus-visible:outline focus-visible:outline-4 focus-visible:outline-white">Change</button>
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/20 text-[20px] focus-visible:outline focus-visible:outline-4 focus-visible:outline-white">✕</button>
        </div>
        <p className="mt-3 text-[14px] leading-relaxed text-white/95">
          Pick the patient who will play. Pao's XP, level, stats, badges and outfits are saved to their record.
        </p>
      </div>

      {/* Search + sort */}
      <div className="flex gap-2">
        <label className="flex flex-1 items-center gap-2 rounded-2xl border-2 border-[#E4DFCE] bg-white px-3">
          <span className="sr-only">Search patients by name</span>
          <span aria-hidden="true" className="text-[#5A5670]">🔍</span>
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or nickname"
            className="h-12 w-full bg-transparent text-[16px] text-[#2B2A4C] outline-none placeholder:text-[#8A8578]"
          />
        </label>
        <button type="button" onClick={cycleSort} className="h-12 shrink-0 rounded-2xl border-2 border-[#E4DFCE] bg-white px-3 text-[14px] font-bold text-[#5b21b6] focus-visible:outline focus-visible:outline-4 focus-visible:outline-[#3B82F6]">
          {SORT_LABEL[sort]}
        </button>
      </div>

      <p className="mt-4 text-[13px] font-extrabold tracking-wide text-[#5A5670]">YOUR PATIENTS · {players.length}</p>

      {/* Scrollable list — about 3.5 rows visible */}
      <div role="radiogroup" aria-label="Your patients" className="mt-2 max-h-[324px] space-y-2 overflow-y-auto pr-1">
        {loading && <p className="py-6 text-center text-[15px] text-[#5A5670]">Loading patients…</p>}
        {!loading && error && <p className="py-6 text-center text-[15px] text-[#5A5670]">{error}</p>}
        {!loading && !error && players.length === 0 && (
          <p className="py-6 text-center text-[15px] text-[#5A5670]">
            {debounced ? <>No patient matches "{debounced}"</> : 'No patients are assigned to you yet.'}
          </p>
        )}
        {!loading && players.map((p) => {
          const isSel = p.id === selectedId
          return (
            <button
              key={p.id}
              type="button"
              ref={(el) => { rowRefs.current[p.id] = el }}
              aria-pressed={isSel}
              onClick={() => setSelectedId(p.id)}
              onKeyDown={onRowKey}
              className={`flex min-h-[88px] w-full items-center gap-3 rounded-2xl border-2 px-3 py-2.5 text-left transition-colors focus-visible:outline focus-visible:outline-4 focus-visible:outline-[#3B82F6] ${isSel ? 'border-[#6D4AE0] bg-[#f3efff]' : 'border-[#E4DFCE] bg-white hover:border-[#c4b5fd]'}`}
            >
              <span aria-hidden="true" className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${isSel ? 'border-[#6D4AE0]' : 'border-[#B8B3A3]'}`}>
                {isSel && <span className="h-2.5 w-2.5 rounded-full bg-[#6D4AE0]" />}
              </span>
              <Avatar player={p} />
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-1.5">
                  <span className="truncate text-[16px] font-extrabold text-[#2B2A4C]">{p.fullName}</span>
                  {p.hasAppointmentToday && <span className="rounded-full bg-[#E3F4E8] px-2 py-0.5 text-[12px] font-bold text-[#2F8A4C]">Today</span>}
                </span>
                <span className="mt-1 flex flex-wrap gap-1.5 text-[12px] font-bold">
                  {p.age != null && <span className="rounded-full bg-[#F1EEDF] px-2 py-0.5 text-[#5A5670]">{p.age} yrs</span>}
                  {p.condition && <span className="rounded-full bg-[#ecfeff] px-2 py-0.5 text-[#0e7490]">{p.condition}</span>}
                </span>
              </span>
              <span className="hidden w-[118px] shrink-0 text-right sm:block">
                <span className="block text-[13px] font-extrabold text-[#5b21b6]">Pao Lv {p.pao.level}</span>
                <span className="mt-1 block h-1.5 w-full overflow-hidden rounded-full bg-[#E4DFCE]">
                  <span className="block h-full rounded-full bg-[#6D4AE0]" style={{ width: `${p.pao.xpToNext ? Math.min(100, Math.round((p.pao.xp / p.pao.xpToNext) * 100)) : 100}%` }} />
                </span>
                <span className="mt-1 block text-[12px] font-bold text-[#5A5670]">{playedLabel(p.lastPlayedAt)}</span>
              </span>
            </button>
          )
        })}
      </div>

      {/* Remember + start */}
      <label className="mt-4 flex cursor-pointer items-center gap-2.5 text-[15px] font-bold text-[#2B2A4C]">
        <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} className="h-5 w-5 accent-[#6D4AE0]" />
        Remember for this session
      </label>

      <button
        type="button"
        disabled={!selected || busy}
        onClick={handleStart}
        className="mt-3 h-14 w-full rounded-2xl bg-[#6D4AE0] text-[18px] font-extrabold text-white shadow-md disabled:opacity-50 focus-visible:outline focus-visible:outline-4 focus-visible:outline-[#3B82F6]"
      >
        {selected ? `Play with ${selected.displayName}` : 'Choose a player'}
      </button>

      <button type="button" onClick={handlePractice} disabled={busy} className="mt-2 w-full py-2 text-[14px] font-bold text-[#5b21b6] underline underline-offset-2 focus-visible:outline focus-visible:outline-4 focus-visible:outline-[#3B82F6]">
        Play without a patient (practice mode: no XP or badges saved)
      </button>
    </Shell>
  )
}

function Shell({ dialogRef, onClose, label, children }) {
  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-[rgba(30,60,100,0.45)] p-4" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose?.() }}>
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        className="w-full max-w-[520px] rounded-[36px] bg-[#FFFDF8] p-7 shadow-xl"
        style={BODY}
      >
        {children}
      </div>
    </div>
  )
}

function Avatar({ player }) {
  if (player.photoUrl) {
    return <img src={player.photoUrl} alt="" className="h-12 w-12 shrink-0 rounded-full object-cover" />
  }
  return (
    <span aria-hidden="true" className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-[16px] font-extrabold text-white" style={{ background: colourFor(player.id), ...HEADING }}>
      {player.initials}
    </span>
  )
}
