import { createPortal } from 'react-dom'
import { Loader2 } from 'lucide-react'
import useDialogA11y from '../payments/useDialogA11y'

const WIDTH = { sm: 'sm:max-w-[460px]', md: 'sm:max-w-[560px]', lg: 'sm:max-w-[640px]' }

// The window every review modal uses: dim overlay, focus trap, Esc closes, focus goes back to the button that opened it.
// While `busy` (a request is running) Esc and clicks on the overlay do nothing. On phones it becomes a bottom sheet.
export default function ModalShell({ labelledBy, describedBy, onClose, busy = false, size = 'md', children, flush = false }) {
  const ref = useDialogA11y({ onEscape: onClose, locked: busy })
  return createPortal(
    <div className="fixed inset-0 z-[1000] flex items-end justify-center bg-[#1F3D33]/55 sm:items-center sm:p-4" onMouseDown={() => { if (!busy) onClose() }}>
      <div
        ref={ref} role="dialog" aria-modal="true" aria-labelledby={labelledBy} aria-describedby={describedBy} aria-busy={busy} tabIndex={-1}
        onMouseDown={(e) => e.stopPropagation()}
        className={`max-h-[94vh] w-full ${WIDTH[size]} overflow-y-auto rounded-t-3xl bg-white font-[Inter,system-ui,sans-serif] text-[#1E3A31] shadow-2xl outline-none [color-scheme:light] sm:rounded-3xl [&_h2]:text-[#111827] [&_h3]:text-[#111827] ${flush ? '' : 'p-5 sm:p-7'}`}
      >
        {children}
      </div>
    </div>,
    document.body,
  )
}

export const Spin = () => <Loader2 size={16} className="animate-spin motion-reduce:animate-none" aria-hidden="true" />

// Rows like "Patient · Miguel Tayao" in a bordered card.
export function SummaryRows({ rows }) {
  return (
    <dl className="m-0 rounded-2xl border border-solid border-[#E3EDE8] px-4 text-sm">
      {rows.map(([label, value, cls = ''], i) => (
        <div key={label} className={`flex items-baseline justify-between gap-4 py-2.5 ${i ? 'border-t border-[#EEF4F1]' : ''}`}>
          <dt className="text-[#5B7469]">{label}</dt>
          <dd className={`m-0 text-right font-bold ${cls}`}>{value}</dd>
        </div>
      ))}
    </dl>
  )
}
