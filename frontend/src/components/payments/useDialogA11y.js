import { useEffect, useRef } from 'react'

// Focus trap + Escape for a dialog that sits ON TOP of another dialog (the checkout modal has its own Escape handler).
//   - focus moves into the dialog when it opens (to `initialFocus` if given) and goes back to the button that opened it
//   - Tab / Shift+Tab stay inside
//   - Escape calls onEscape (unless `locked`) and is stopped before the dialog underneath sees it
export default function useDialogA11y({ onEscape, locked = false, initialFocus = null } = {}) {
  const ref = useRef(null)
  const latest = useRef({ onEscape, locked })
  latest.current = { onEscape, locked }

  useEffect(() => {
    const opener = document.activeElement
    const node = ref.current
    const target = (initialFocus && node?.querySelector(initialFocus)) || node?.querySelector('[data-autofocus]') || node
    target?.focus?.()
    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation(); e.preventDefault()
        if (!latest.current.locked) latest.current.onEscape?.()
        return
      }
      if (e.key !== 'Tab' || !ref.current) return
      const items = [...ref.current.querySelectorAll('a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])')].filter((el) => el.offsetParent !== null)
      if (!items.length) { e.preventDefault(); return }
      const first = items[0], last = items[items.length - 1]
      if (e.shiftKey && (document.activeElement === first || document.activeElement === ref.current)) { e.preventDefault(); last.focus() }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus() }
    }
    document.addEventListener('keydown', onKey, true) // capture: runs before the dialog underneath
    return () => {
      document.removeEventListener('keydown', onKey, true)
      if (opener && document.contains(opener)) opener.focus?.()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return ref
}
