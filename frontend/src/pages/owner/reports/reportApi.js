import { useCallback, useEffect, useRef, useState } from 'react'
import { API_BASE } from '../../../utils/api'
import { getSessionToken } from '../../../utils/session'
import { createLatestGate } from './reportRange'

const headers = () => ({ Authorization: `Bearer ${getSessionToken()}` })

async function failure(res) {
  const data = await res.json().catch(() => ({}))
  const err = new Error(data.error || `Request failed (${res.status})`)
  err.status = res.status
  err.code = data.code
  return err
}

export async function fetchSummary(query, signal) {
  const res = await fetch(`${API_BASE}/api/owner/reports/summary?${query}`, { headers: headers(), signal })
  if (!res.ok) throw await failure(res)
  return res.json()
}

// Same rows the CSV/PDF contain, as JSON, for the "View report" table.
export async function fetchTables(module, query, signal) {
  const res = await fetch(`${API_BASE}/api/owner/reports/${module}/export?format=json&${query}`, { headers: headers(), signal })
  if (!res.ok) throw await failure(res)
  return res.json()
}

// Downloads an export. The server decides the content and the file name (it contains the range).
export async function downloadExport(module, format, query, extra = '') {
  const res = await fetch(`${API_BASE}/api/owner/reports/${module}/export?format=${format}&${query}${extra}`, { headers: headers() })
  if (!res.ok) throw await failure(res)
  const blob = await res.blob()
  const disp = res.headers.get('Content-Disposition') || ''
  const name = (disp.match(/filename="([^"]+)"/) || [])[1] || `${module}-report.${format}`
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10000)
  return name
}

// Loads the summary for `query`. Keeps the previous data on screen while a new range loads or when it fails.
// A changed range aborts the previous request, and a ticket gate ignores any response that still arrives late.
export function useReportsSummary(query) {
  const [state, setState] = useState({ data: null, loading: true, error: null, loadedQuery: null })
  const gate = useRef(createLatestGate()).current
  const [nonce, setNonce] = useState(0)

  useEffect(() => {
    const ctrl = new AbortController()
    const ticket = gate.next()
    setState((s) => ({ ...s, loading: true, error: null }))
    fetchSummary(query, ctrl.signal)
      .then((data) => { if (gate.isLatest(ticket)) setState({ data, loading: false, error: null, loadedQuery: query }) })
      .catch((err) => {
        if (err.name === 'AbortError' || !gate.isLatest(ticket)) return
        setState((s) => ({ ...s, loading: false, error: err }))
      })
    return () => ctrl.abort()
  }, [query, nonce, gate])

  const reload = useCallback(() => setNonce((n) => n + 1), [])
  return { ...state, reload }
}
