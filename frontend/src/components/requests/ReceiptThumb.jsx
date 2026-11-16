import { ImageOff, Search } from 'lucide-react'
import { useEffect, useState } from 'react'
import { getReceiptBlob } from '../../utils/bookingPayments'
import ReceiptLightbox from '../payments/ReceiptLightbox'

// The receipt picture on a request card. It is fetched with the therapist's session (never a public link) and shown from a blob URL.
export default function ReceiptThumb({ url, title }) {
  const [src, setSrc] = useState('')
  const [failed, setFailed] = useState(false)
  const [zoom, setZoom] = useState(false)
  useEffect(() => {
    if (!url) return undefined
    let live = true
    let made = ''
    getReceiptBlob(url).then((b) => { if (live) { made = URL.createObjectURL(b); setSrc(made) } }).catch(() => { if (live) setFailed(true) })
    return () => { live = false; if (made) URL.revokeObjectURL(made) }
  }, [url])

  if (!url || failed) return <span className="flex h-[110px] w-[150px] items-center justify-center rounded-xl border border-solid border-[#E3EDE8] bg-[#F3F7F5] text-[#8AA095]"><ImageOff size={24} aria-label="No receipt available" /></span>
  return (
    <div className="flex w-[160px] flex-col items-start gap-1.5">
      <button type="button" disabled={!src} onClick={() => setZoom(true)} aria-label="View receipt full size" className="w-full overflow-hidden rounded-xl border-2 border-solid border-[#1E3F8F] bg-[#F3F7F5] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#16A34A]/50">
        {src ? <img src={src} alt="Receipt thumbnail" className="h-[110px] w-full object-cover" /> : <span className="block h-[110px] w-full animate-pulse bg-[#E3EDE8] motion-reduce:animate-none" />}
      </button>
      <button type="button" disabled={!src} onClick={() => setZoom(true)} className="inline-flex items-center gap-1 border-0 border-solid bg-transparent p-0 text-xs font-bold text-[#2E5E4E] hover:underline disabled:opacity-50"><Search size={12} aria-hidden="true" /> View receipt full size</button>
      {zoom && <ReceiptLightbox src={src} title={title} onClose={() => setZoom(false)} />}
    </div>
  )
}
