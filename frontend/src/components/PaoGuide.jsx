import { useEffect, useState } from 'react'
import PandaMascot from '../pages/games/PandaMascot'
import PaoLayered from './pao/PaoLayered'

// Pao beside a speech bubble. Larger on web, smaller on phones. The panda is
// not clipped, so the whole face shows at both sizes.
const QUERY = '(max-width: 640px)'

function useIsNarrow() {
  const [narrow, setNarrow] = useState(() => typeof window !== 'undefined' && window.matchMedia(QUERY).matches)
  useEffect(() => {
    const mq = window.matchMedia(QUERY)
    const on = () => setNarrow(mq.matches)
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [])
  return narrow
}

export default function PaoGuide({ children, tone = 'neutral', bubbleStyle, bubbleClassName = '', pose = null, showFx = true }) {
  const narrow = useIsNarrow()
  const toneClass = tone === 'success'
    ? 'border-[#A9D8B6] bg-[#E3F4E8] text-[#2F8A4C]'
    : tone === 'hint'
      ? 'border-[#F3D284] bg-[#FFF0CC] text-[#C97A00]'
      : 'border-[#E4DFCE] bg-white text-[#2B2A4C]'
  return (
    <div className="relative z-10 mx-4 mt-3 mb-2 flex flex-shrink-0 items-end gap-3">
      <div className="flex-shrink-0" style={{ overflow: 'visible' }} aria-hidden="true">
        {pose
          ? <PaoLayered pose={pose} showFx={showFx} size={narrow ? 84 : 120} />
          : <PandaMascot pxWidth={narrow ? 84 : 120} pandaState="happy" viewPad={{ top: 0, bottom: 0 }} />}
      </div>
      <p aria-live="polite" className={`min-h-[52px] flex-1 rounded-[6px_18px_18px_18px] border-2 px-4 py-2.5 text-[16px] font-bold leading-snug ${toneClass} ${bubbleClassName}`} style={bubbleStyle}>
        {children}
      </p>
    </div>
  )
}
