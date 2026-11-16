import { useCallback, useEffect, useRef, useState } from 'react'

// Page-local toast (the app's only shared toast is login-specific). role=status makes it an aria-live region.
export function useToast() {
  const [toast, setToast] = useState(null)
  const timer = useRef(null)
  const flash = useCallback((message, tone = 'ok') => {
    clearTimeout(timer.current)
    setToast({ message, tone })
    timer.current = setTimeout(() => setToast(null), tone === 'error' ? 6000 : 2800)
  }, [])
  useEffect(() => () => clearTimeout(timer.current), [])
  const node = (
    <div className="tk-toast-region" role="status" aria-live="polite">
      {toast && <div className={`tk-toast ${toast.tone === 'error' ? 'tk-toast-error' : ''}`}>{toast.message}</div>}
    </div>
  )
  return [node, flash]
}
