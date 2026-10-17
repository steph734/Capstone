import { useEffect, useState } from 'react'

export function formatDuration(totalSec) {
  const s = Math.max(0, Math.floor(totalSec))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  const mm = String(m).padStart(2, '0')
  const ss = String(sec).padStart(2, '0')
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`
}

// Seconds elapsed since `startedAt` (ms epoch), ticking every second; 0 until started.
export default function useCallTimer(startedAt) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!startedAt) return undefined
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [startedAt])
  const seconds = startedAt ? Math.max(0, Math.round((now - startedAt) / 1000)) : 0
  return { seconds, label: formatDuration(seconds) }
}
