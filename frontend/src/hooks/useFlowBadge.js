import { useEffect, useState } from 'react'
import { flowApi } from '../utils/bookingFlowApi'

// The number on the sidebar's Appointments item. Owner: payments to verify. Therapist: requests waiting for their answer.
export default function useFlowBadge(role) {
  const [count, setCount] = useState(0)
  const active = role === 'Owner' || role === 'Therapist'
  useEffect(() => {
    if (!active) return undefined
    let live = true
    const load = () => flowApi.badge().then((d) => { if (live) setCount(d.count || 0) }).catch(() => {})
    load()
    const id = setInterval(load, 60000)
    window.addEventListener('focus', load)
    window.addEventListener('tp:booking-flow', load)
    return () => { live = false; clearInterval(id); window.removeEventListener('focus', load); window.removeEventListener('tp:booking-flow', load) }
  }, [active])
  return active ? count : 0
}
