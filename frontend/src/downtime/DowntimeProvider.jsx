import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { isIdleHeld } from '../session/sessionBus'
import { COUNTDOWN_MS, DOWNTIME_EVENT, GRACE_MS, askForGrace, fetchStatus, isAffected } from './api'
import { BackOnlineScreen, CancelledModal, CountdownModal, DowntimeBanner, MaintenanceScreen, NoticeModal } from './DowntimeScreens'

// Mounted ONCE at the app root (inside the Router), around every role's routes. Super Admins are excluded: their page
// reads the downtime itself. Everything is decided from SERVER time (offset = serverTime - this browser's clock).
const Ctx = createContext({ status: null, serverNow: () => Date.now(), down: false })
export const useDowntime = () => useContext(Ctx)

const NOTICE_KEYS = ['now', 'week', 'h24', 'h1', 'm15']
const DAY = 86400000
const SNOOZE = { week: { ms: DAY, label: 'Remind me tomorrow' }, standard: { ms: 3600000, label: 'Remind me in 1 hour' }, h24: { ms: 3 * 3600000, label: 'Remind me later' } }

const ls = {
  get: (k) => { try { return localStorage.getItem(k) } catch { return null } },
  set: (k, v) => { try { localStorage.setItem(k, v) } catch { /* private mode: the notice may show again, nothing breaks */ } },
}

export default function DowntimeProvider({ isAuthenticated, role, onLogout, children }) {
  const navigate = useNavigate()
  const [status, setStatus] = useState(null)
  const [blocked, setBlocked] = useState(false) // a 503 SYSTEM_DOWNTIME (or the start time) put this browser on the maintenance screen
  const [checking, setChecking] = useState(false)
  const [bannerOff, setBannerOff] = useState('')
  const [detailsOpen, setDetailsOpen] = useState(false)
  const [, force] = useState(0)
  const offsetRef = useRef(0)
  const statusRef = useRef(null)
  const blockedRef = useRef(false)
  const blockedAt = useRef(0)
  const signedOut = useRef(false)
  const graceAsked = useRef(false)
  const channel = useRef(null)
  const tracked = isAuthenticated && role !== 'Super Admin'

  statusRef.current = status
  blockedRef.current = blocked
  const serverNow = useCallback(() => Date.now() + offsetRef.current, [])

  const refresh = useCallback(async (fresh = false) => {
    try {
      const s = await fetchStatus({ fresh })
      offsetRef.current = s.offset
      setStatus({ ...s, fetchedAt: Date.now() })
    } catch { /* offline or no API: keep the last known state */ }
  }, [])

  // ── polling: 60 s; 10 s in the last 10 minutes; 15 s while the maintenance screen is up; and on tab focus ──
  const enabled = tracked || blocked
  useEffect(() => {
    if (!enabled) return undefined
    let stop = false, t
    const loop = async () => {
      await refresh(blockedRef.current)
      if (stop) return
      const s = statusRef.current, now = Date.now() + offsetRef.current
      let next = 60000
      if (blockedRef.current || (s?.state === 'active' && now >= Date.parse(s.downtime?.startAt))) next = 15000
      else if (s?.downtime && Date.parse(s.downtime.startAt) - now <= 10 * 60000) next = 10000
      t = setTimeout(loop, next)
    }
    const onFocus = () => { if (document.visibilityState !== 'hidden') { clearTimeout(t); loop() } }
    loop()
    window.addEventListener('focus', onFocus)
    document.addEventListener('visibilitychange', onFocus)
    return () => { stop = true; clearTimeout(t); window.removeEventListener('focus', onFocus); document.removeEventListener('visibilitychange', onFocus) }
  }, [enabled, refresh])

  // A 1 s clock only while there is something time-dependent on screen.
  const hasDowntime = !!status?.downtime
  useEffect(() => {
    if (!hasDowntime || !(tracked || blocked)) return undefined
    const i = setInterval(() => force((n) => n + 1), 1000)
    return () => clearInterval(i)
  }, [hasDowntime, tracked, blocked])

  // Other tabs: acknowledgements live in localStorage; a sign-out is announced on a BroadcastChannel.
  useEffect(() => {
    const onStorage = (e) => { if (e.key && e.key.startsWith('downtime:')) force((n) => n + 1) }
    window.addEventListener('storage', onStorage)
    try {
      channel.current = new BroadcastChannel('therapypro-downtime')
      channel.current.onmessage = (e) => { if (e.data?.type === 'signout') endSession(e.data.maintenance, true) }
    } catch { channel.current = null }
    return () => { window.removeEventListener('storage', onStorage); channel.current?.close() }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const roleRef = useRef({ tracked, onLogout })
  roleRef.current = { tracked, onLogout }
  // Clears the session and (when the system is down) lands on the maintenance screen.
  const endSession = useCallback((maintenance, remote = false) => {
    if (!roleRef.current.tracked || signedOut.current) return
    signedOut.current = true
    if (maintenance) { blockedAt.current = Date.now(); setBlocked(true) }
    roleRef.current.onLogout('downtime')
    if (!remote) { try { channel.current?.postMessage({ type: 'signout', maintenance }) } catch { /* ignore */ } }
    if (!maintenance) navigate('/login', { replace: true })
  }, [navigate])
  useEffect(() => { if (isAuthenticated) { signedOut.current = false; graceAsked.current = false } }, [isAuthenticated])

  // Any API call that comes back 503 SYSTEM_DOWNTIME (or the login page) ends up here.
  useEffect(() => {
    const onDown = () => {
      blockedAt.current = Date.now(); setBlocked(true)
      if (roleRef.current.tracked) endSession(true)
      refresh(true)
    }
    window.addEventListener(DOWNTIME_EVENT, onDown)
    return () => window.removeEventListener(DOWNTIME_EVENT, onDown)
  }, [endSession, refresh])

  // ── derived state (all from server time) ──
  const now = serverNow()
  const dt = status?.downtime || null
  const startMs = dt ? Date.parse(dt.startAt) : 0
  const lead = dt ? startMs - now : 0
  const down = !!dt && status.state === 'active' && now >= startMs
  const mine = tracked && !!dt && isAffected(role, dt.audience)
  const pending = mine && (status.state === 'scheduled' || status.state === 'active') && lead > 0

  // At the start time: sign out, unless an upload / payment / game is in progress (then up to 5 more minutes).
  const sec = Math.floor(now / 1000)
  useEffect(() => {
    if (!mine || !dt) return
    const held = isIdleHeld()
    if (lead <= 15000 && lead > -GRACE_MS && held && !graceAsked.current) { graceAsked.current = true; askForGrace() }
    if (down && !(held && now < startMs + GRACE_MS && graceAsked.current)) endSession(true)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sec, mine, down])

  // The maintenance screen goes away (and "back online" can appear) once the server says the system is open again.
  useEffect(() => {
    if (blocked && status && status.fetchedAt > blockedAt.current && !(status.state === 'active' && now >= Date.parse(status.downtime?.startAt))) setBlocked(false)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status])

  const maintenance = blocked || (mine && down)
  useEffect(() => { if (maintenance && dt) ls.set('downtime:saw', dt.id) }, [maintenance, dt])

  // Which notice, if any (newest reminder first, one at a time).
  const notice = useMemo(() => {
    if (!pending || lead <= COUNTDOWN_MS) return null
    const due = (status.plan || []).filter((p) => NOTICE_KEYS.includes(p.key) && p.status !== 'skipped' && Date.parse(p.sendAt) <= now).sort((a, b) => Date.parse(b.sendAt) - Date.parse(a.sendAt))
    const p = due[0]
    if (!p) return null
    const mark = ls.get(`downtime:${dt.id}:${p.key}`)
    if (mark === 'ack' || (mark?.startsWith('snooze:') && now < Number(mark.slice(7)))) return null
    let variant = 'short'
    if (p.key === 'week') variant = 'week'
    else if (p.key === 'h24') variant = 'h24'
    else if (p.key === 'now') variant = startMs - Date.parse(p.sendAt) >= 7 * DAY ? 'week' : 'standard'
    return { key: p.key, variant }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, pending, Math.floor(now / 5000)])

  const ack = (key) => { ls.set(`downtime:${dt.id}:${key}`, 'ack'); force((n) => n + 1) }
  const snooze = (key, ms) => { ls.set(`downtime:${dt.id}:${key}`, `snooze:${now + ms}`); force((n) => n + 1) }

  const latestKey = (status?.plan || []).filter((p) => NOTICE_KEYS.includes(p.key) && p.status !== 'skipped' && Date.parse(p.sendAt) <= now).map((p) => p.key).pop() || ''
  const showBanner = pending && dt.bannerNow && bannerOff !== `${dt.id}:${latestKey}`
  const countdown = pending && lead <= COUNTDOWN_MS
  const finishing = mine && down && isIdleHeld() && now < startMs + GRACE_MS
  const ended = status?.state === 'none' ? status.recentlyEnded : null
  const backOnline = !!ended && !maintenance && ls.get('downtime:saw') === ended.id && !ls.get(`downtime:${ended.id}:ended`)
  const cancelled = status?.state === 'none' && status.cancelled && tracked && isAffected(role, status.cancelled.audience) && !ls.get(`downtime:${status.cancelled.id}:cancelled`) ? status.cancelled : null

  const checkAgain = async () => { setChecking(true); await refresh(true); setChecking(false) }
  const ctx = useMemo(() => ({ status, serverNow, down }), [status, serverNow, down])

  let overlay = null
  if (maintenance) overlay = <MaintenanceScreen dt={dt} serverNow={now} onCheck={checkAgain} checking={checking} onAdmin={!isAuthenticated ? () => { setBlocked(false) } : null} />
  else if (backOnline) overlay = <BackOnlineScreen ended={ended} onContinue={() => { ls.set(`downtime:${ended.id}:ended`, '1'); navigate('/login', { replace: true }); force((n) => n + 1) }} />
  else if (countdown || finishing) overlay = <CountdownModal remainingMs={Math.max(0, lead)} totalMs={COUNTDOWN_MS} finishing={finishing} onSignOut={() => endSession(false)} />
  else if (cancelled) overlay = <CancelledModal title={cancelled.title} startAt={cancelled.startAt} onClose={() => { ls.set(`downtime:${cancelled.id}:cancelled`, '1'); force((n) => n + 1) }} />
  else if (notice && dt) {
    const sn = SNOOZE[notice.variant]
    overlay = <NoticeModal variant={notice.variant} dt={dt} serverNow={now} onGotIt={() => ack(notice.key)} onSnooze={sn ? () => snooze(notice.key, sn.ms) : null} snoozeLabel={sn?.label} />
  } else if (detailsOpen && dt && pending) {
    overlay = <NoticeModal variant="standard" dt={dt} serverNow={now} onGotIt={() => setDetailsOpen(false)} />
  }

  return (
    <Ctx.Provider value={ctx}>
      {children}
      {showBanner && !maintenance && <DowntimeBanner dt={dt} onDetails={() => setDetailsOpen(true)} onDismiss={() => setBannerOff(`${dt.id}:${latestKey}`)} />}
      {overlay}
    </Ctx.Provider>
  )
}
