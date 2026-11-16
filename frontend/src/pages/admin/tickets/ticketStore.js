import { useCallback, useEffect, useState, useSyncExternalStore } from 'react'
import { getTicket, patchTicket, postReply, reopenTicket, resolveTicket, saveResolutionNotes } from './ticketsApi'

// Shared client state for the ticket desk. The list page's reading pane and the full ticket page read the
// same cache, so a change made in one shows in the other (and in the list/summary cards, which are
// told to revalidate through `onDeskChange`). Everything is revalidated in the background after a change
// and whenever the window regains focus.
const details = new Map() // ticket number -> { ticket, messages, activity, admins, config }
const listeners = new Set()
const emit = () => listeners.forEach((l) => l())
const subscribe = (l) => { listeners.add(l); return () => listeners.delete(l) }

const deskWatchers = new Set()
export const onDeskChange = (fn) => { deskWatchers.add(fn); return () => deskWatchers.delete(fn) }
export const invalidateDesk = () => deskWatchers.forEach((fn) => fn())

export const setDetail = (number, data) => { details.set(number, data); emit() }
export const getCached = (number) => details.get(number)

export function useTicketDetail(number) {
  const data = useSyncExternalStore(subscribe, () => details.get(number))
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(!details.has(number))

  const reload = useCallback(async ({ silent = true } = {}) => {
    if (!number) return null
    if (!silent) setLoading(true)
    try {
      const d = await getTicket(number)
      setDetail(d.ticket.number, d)
      setError('')
      return d
    } catch (e) {
      setError(e.status === 404 ? 'This ticket could not be found.' : e.message)
      return null
    } finally { setLoading(false) }
  }, [number])

  useEffect(() => { reload({ silent: details.has(number) }) }, [number, reload])
  useEffect(() => {
    const onFocus = () => { if (document.visibilityState !== 'hidden') reload() }
    window.addEventListener('focus', onFocus)
    document.addEventListener('visibilitychange', onFocus)
    return () => { window.removeEventListener('focus', onFocus); document.removeEventListener('visibilitychange', onFocus) }
  }, [reload])

  return { data, error, loading: loading && !data, reload }
}

// All the write operations for one ticket. Each one updates the cache straight away (optimistically where
// that is safe), then replaces it with the server's answer, then tells the list and cards to refresh.
export function useTicketActions(number, { onToast } = {}) {
  const [conflict, setConflict] = useState(false)
  const [busy, setBusy] = useState(false)

  const current = () => details.get(number)
  const apply = (d) => { setDetail(d.ticket.number, d); setConflict(false); invalidateDesk() }
  const fail = (e, fallbackRestore) => {
    if (fallbackRestore) setDetail(number, fallbackRestore)
    if (e.code === 'VERSION_CONFLICT') setConflict(true)
    else onToast?.(e.message || 'Something went wrong.', 'error')
    throw e
  }

  const change = async (patch) => {
    const before = current()
    if (!before) return
    // Optimistic: show the new value at once.
    const optimistic = { ...before.ticket }
    if (patch.status) optimistic.status = patch.status
    if (patch.priority) optimistic.priority = patch.priority
    if ('assignedTo' in patch) optimistic.assignedTo = patch.assignedTo ? before.admins.find((a) => a.id === patch.assignedTo) || null : null
    setDetail(number, { ...before, ticket: optimistic })
    try {
      apply(await patchTicket(number, { ...patch, version: before.ticket.version }))
      onToast?.('Updated')
    } catch (e) { fail(e, before) }
  }

  // body/internal/file; the optimistic message appears immediately and is swapped for the server's thread.
  const reply = async ({ body, internal, file }) => {
    const before = current()
    const temp = {
      id: `pending-${Date.now()}`, author: 'You', authorRole: 'super_admin', body: body || '(attachment)', internal: !!internal, createdAt: new Date().toISOString(),
      attachments: file ? [{ index: 0, fileName: file.name, fileType: file.type }] : [], pending: true,
    }
    setDetail(number, { ...before, messages: [...before.messages, temp] })
    try {
      apply(await postReply(number, { body, internal, file }))
      onToast?.(internal ? 'Internal note added' : 'Reply sent')
    } catch (e) { fail(e, before) }
  }

  const saveNotes = async (text) => {
    try { apply(await saveResolutionNotes(number, text)); onToast?.('Resolution notes saved') } catch (e) { fail(e) }
  }

  const resolve = async ({ resolutionCode, resolutionNotes }) => {
    const before = current()
    setBusy(true)
    try {
      apply(await resolveTicket(number, { resolutionCode, resolutionNotes, version: before.ticket.version }))
      onToast?.('Ticket resolved')
    } catch (e) { fail(e) } finally { setBusy(false) }
  }

  const reopen = async () => {
    const before = current()
    setBusy(true)
    try { apply(await reopenTicket(number, before.ticket.version)); onToast?.('Ticket reopened') } catch (e) { fail(e) } finally { setBusy(false) }
  }

  return { change, reply, saveNotes, resolve, reopen, conflict, clearConflict: () => setConflict(false), busy }
}
