import { useEffect, useRef } from 'react'

const FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

// Dialog behaviour: focus moves in on open, Tab stays inside, Esc closes (unless busy), and focus returns to the
// element that opened it (or `returnFocusRef`).
export function useDialogFocus({ onClose, busy = false, returnFocusRef }) {
  const ref = useRef(null)
  useEffect(() => {
    const opener = document.activeElement
    const first = ref.current?.querySelector('[data-autofocus]') || ref.current
    first?.focus()
    return () => {
      const target = returnFocusRef?.current || opener
      if (target?.isConnected) target.focus?.()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const onKeyDown = (e) => {
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); if (!busy) onClose?.(); return }
    if (e.key !== 'Tab' || !ref.current) return
    const items = [...ref.current.querySelectorAll(FOCUSABLE)]
    if (!items.length) { e.preventDefault(); return }
    const [first, last] = [items[0], items[items.length - 1]]
    if (e.shiftKey && (document.activeElement === first || document.activeElement === ref.current)) { e.preventDefault(); last.focus() }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus() }
  }
  return { ref, onKeyDown }
}
