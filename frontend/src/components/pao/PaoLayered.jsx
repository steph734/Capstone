import { useEffect, useMemo, useState } from 'react'
import { loadLayerManifest, resolveLayerStack, layerUrl, allLayerFiles } from './paoLayers'

// Pao assembled from stacked outfit layers: base-bottom, base-top, and any
// equipped hat/clothes/pants/shoes overlay, all sharing one viewBox so they
// line up without being scaled individually. Standing/idle pose only — this
// is the "what Pao is wearing" view, not an animated pose.
//
//   <PaoLayered equipped={{ hats: 'wizard-hat', clothes: 'cozy-hoodie' }} size={260} />
//
// `ghost` previews a locked item at 60% opacity without actually equipping
// it (merged on top of `equipped` for display only).
const VIEWBOX = '0 -40 300 380'
const ASPECT = 380 / 300

export default function PaoLayered({ equipped = {}, ghost = null, size = 260, className = '' }) {
  const [manifest, setManifest] = useState(null)

  useEffect(() => {
    let cancelled = false
    loadLayerManifest().then((m) => {
      if (cancelled || !m) return
      setManifest(m)
      // Preload every overlay once, so switching items never flickers.
      allLayerFiles(m).forEach((file) => { const img = new Image(); img.src = layerUrl(file) })
    })
    return () => { cancelled = true }
  }, [])

  const shown = ghost ? { ...equipped, ...ghost } : equipped
  const stack = useMemo(() => resolveLayerStack(manifest, shown), [manifest, shown])
  const ghostFiles = useMemo(() => {
    if (!ghost || !manifest) return new Set()
    return new Set(resolveLayerStack(manifest, ghost).map((l) => l.file))
  }, [ghost, manifest])

  const width = size
  const height = Math.round(size * ASPECT)

  return (
    <div className={`relative ${className}`} style={{ width, height }} aria-hidden="true">
      {stack.map((layer) => (
        <img
          key={layer.file}
          src={layerUrl(layer.file)}
          alt=""
          draggable={false}
          className="absolute inset-0 h-full w-full"
          style={{
            objectFit: 'contain',
            opacity: ghostFiles.has(layer.file) ? 0.6 : 1,
            transition: 'opacity .2s ease',
          }}
          onError={(e) => { e.currentTarget.style.display = 'none' }}
        />
      ))}
    </div>
  )
}

export { VIEWBOX }
