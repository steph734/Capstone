import { useMemo } from 'react'
import { useOptionalPao } from '../../context/PaoContext'
import { resolveItemKey, LAYER_CATEGORIES } from './paoLayers'

// The patient's real equipped outfit as PaoLayered keys (same mapping as the hub and Customize Pao).
// Pass { hats: false } to leave the hat off.
export default function useEquippedOutfit({ hats = true } = {}) {
  const profile = useOptionalPao()?.profile
  return useMemo(() => {
    const out = {}
    for (const cat of LAYER_CATEGORIES) {
      if (!hats && cat === 'hats') continue
      const it = profile?.equipped?.[cat]
      if (it && it.name) out[cat] = resolveItemKey(it.name)
    }
    return out
  }, [profile, hats])
}
