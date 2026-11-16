import { X } from 'lucide-react'
import useDialogA11y from './useDialogA11y'

// The receipt at full size. `src` is a temporary blob URL (the receipt itself is never a public link).
export default function ReceiptLightbox({ src, title = 'Payment receipt', onClose }) {
  const ref = useDialogA11y({ onEscape: onClose })
  return (
    <div className="fixed inset-0 z-[100000] flex items-center justify-center bg-black/75 p-4" onMouseDown={onClose}>
      <div ref={ref} role="dialog" aria-modal="true" aria-label={title} tabIndex={-1} onMouseDown={(e) => e.stopPropagation()} className="relative flex max-h-full max-w-full flex-col items-center outline-none">
        <button type="button" data-autofocus onClick={onClose} aria-label="Close receipt" className="absolute -top-3 -right-3 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-white text-slate-700 shadow-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-white"><X size={18} aria-hidden="true" /></button>
        <img src={src} alt="Receipt screenshot from the patient" className="max-h-[88vh] max-w-full rounded-xl bg-white object-contain shadow-2xl" />
      </div>
    </div>
  )
}
