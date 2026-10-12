import { useEffect, useState } from 'react'
import { getUnreadCount } from './emailApi'

// Polled every 60s, per the spec — refreshed also whenever `refreshKey`
// changes (callers bump it right after reading or sending an email so the
// badge doesn't wait a full minute to catch up).
export default function useEmailUnreadCount(email, refreshKey = 0) {
  const [count, setCount] = useState(0)

  useEffect(() => {
    if (!email) { setCount(0); return undefined }
    let cancelled = false

    const load = () => {
      getUnreadCount(email)
        .then((data) => { if (!cancelled) setCount(data.count || 0) })
        .catch(() => {})
    }
    load()
    const id = setInterval(load, 60000)
    return () => { cancelled = true; clearInterval(id) }
  }, [email, refreshKey])

  return count
}
