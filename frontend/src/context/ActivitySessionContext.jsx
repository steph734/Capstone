import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'

// "Who is playing today?" state for a therapist-run activity session. Only
// the therapist's activities page mounts this provider; a patient on their
// own device has no provider and the default value below.
const ActivitySessionContext = createContext({
  session: null, loading: false, isPractice: false, isActive: false,
  pickerOpen: false, openPicker: () => {}, closePicker: () => {},
  start: async () => {}, changePlayer: () => {}, end: async () => {},
  language: 'en',
})

export function ActivitySessionProvider({ therapistEmail, children }) {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [language, setLanguage] = useState('en')
  const sessionRef = useRef(null)
  sessionRef.current = session

  useEffect(() => {
    if (!therapistEmail) { setLoading(false); return }
    let cancelled = false
    fetch(`/api/activities/session/current?employeeEmail=${encodeURIComponent(therapistEmail)}`)
      .then((r) => r.json())
      .then((body) => {
        if (cancelled) return
        if (body.session) { setSession(body.session); setLanguage(body.session.language || 'en') }
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [therapistEmail])

  const start = useCallback(async ({ patientId, mode, language: lang, remember }) => {
    const res = await fetch('/api/activities/session', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ employeeEmail: therapistEmail, patientId: patientId || null, mode, language: lang, remember }),
    })
    const body = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(body.error || 'Could not start the session.')
    setSession(body.session)
    setLanguage(lang)
    setPickerOpen(false)
    return body.session
  }, [therapistEmail])

  const end = useCallback(async (reason = 'closed') => {
    const current = sessionRef.current
    if (!current) return
    await fetch(`/api/activities/session/${current.id}/end`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ reason }),
    }).catch(() => {})
    setSession(null)
  }, [])

  // Closing the activities page with "remember" off ends the session.
  useEffect(() => {
    const onHide = () => {
      const current = sessionRef.current
      if (!current || current.remember !== false) return
      navigator.sendBeacon?.(`/api/activities/session/${current.id}/end`, new Blob(['{"reason":"closed"}'], { type: 'application/json' }))
    }
    window.addEventListener('pagehide', onHide)
    return () => window.removeEventListener('pagehide', onHide)
  }, [])

  const value = useMemo(() => ({
    session,
    loading,
    isActive: !!session,
    isPractice: session?.mode === 'practice',
    patient: session?.patient || null,
    language,
    pickerOpen,
    openPicker: () => setPickerOpen(true),
    closePicker: () => setPickerOpen(false),
    start,
    end,
    changePlayer: async () => { await end('changed_player'); setPickerOpen(true) },
    setLanguage,
  }), [session, loading, language, pickerOpen, start, end])

  return <ActivitySessionContext.Provider value={value}>{children}</ActivitySessionContext.Provider>
}

export function useActivitySession() {
  return useContext(ActivitySessionContext)
}
