import { useEffect, useMemo, useRef, useState } from 'react'
import { loadLayerManifest, resolveLayerStack, layerUrl, allLayerFiles, BASE_TOP, poseFile, fxFile, loadPosesManifest, allPoseFiles } from './paoLayers'

// Pao assembled from stacked outfit layers: base-bottom, base-top (or a
// reaction pose, see below), and any equipped hat/clothes/pants/shoes
// overlay, all sharing one viewBox so they line up without being scaled
// individually.
//
//   <PaoLayered equipped={{ hats: 'wizard-hat', clothes: 'cozy-hoodie' }} size={260} pose="wink" />
//
// `ghost` previews a locked item at 60% opacity without actually equipping
// it (merged on top of `equipped` for display only).
//
// `pose` (default 'idle') swaps base-top for poses/pose-<name>.svg — same
// arms+face slot, so the outfit layers never move — and adds its fx overlay
// on top, if any. Pose changes crossfade over 120ms so switching never
// flickers; the outfit layers themselves are unaffected (same <img>, no
// remount) since only the pose/fx layer's file changes.
const VIEWBOX = '0 -40 300 380'
const ASPECT = 380 / 300
const CROSSFADE_MS = 120

export default function PaoLayered({ equipped = {}, ghost = null, size = 260, pose = 'idle', showFx = true, className = '', onClick, interactive = false }) {
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

  useEffect(() => {
    let cancelled = false
    loadPosesManifest().then((pm) => {
      if (cancelled || !pm) return
      allPoseFiles(pm).forEach((file) => { const img = new Image(); img.src = layerUrl(file) })
    })
    return () => { cancelled = true }
  }, [])

  const shown = ghost ? { ...equipped, ...ghost } : equipped
  // base-top (z=4) is handled separately below as the crossfading pose
  // layer, so it's excluded here — everything else (outfit items) renders
  // in its normal stacking order, split around where the pose layer sits.
  const fullStack = useMemo(() => resolveLayerStack(manifest, shown, 'idle'), [manifest, shown])
  const belowPose = useMemo(() => fullStack.filter((l) => l.z < BASE_TOP.z), [fullStack])
  const abovePose = useMemo(() => fullStack.filter((l) => l.z > BASE_TOP.z), [fullStack])
  const ghostFiles = useMemo(() => {
    if (!ghost || !manifest) return new Set()
    return new Set(resolveLayerStack(manifest, ghost, 'idle').map((l) => l.file))
  }, [ghost, manifest])

  // The pose+fx layer crossfades on its own, independent of the outfit
  // layers above, which never remount when only the pose changes.
  const poseKey = pose && pose !== 'idle' ? poseFile(pose) : BASE_TOP.file
  const fxKey = showFx && pose && pose !== 'idle' ? fxFile(pose) : null
  const [frames, setFrames] = useState(() => [{ id: 0, poseFile: poseKey, fxFile: fxKey, visible: true }])
  const nextId = useRef(1)

  useEffect(() => {
    setFrames((prev) => {
      const top = prev[prev.length - 1]
      if (top.poseFile === poseKey && top.fxFile === fxKey) return prev
      return [...prev, { id: nextId.current++, poseFile: poseKey, fxFile: fxKey, visible: false }]
    })
  }, [poseKey, fxKey])

  useEffect(() => {
    if (frames.some((f) => !f.visible)) {
      const raf = requestAnimationFrame(() => setFrames((prev) => prev.map((f) => ({ ...f, visible: true }))))
      return () => cancelAnimationFrame(raf)
    }
    if (frames.length > 1) {
      const t = setTimeout(() => setFrames((prev) => prev.slice(-1)), CROSSFADE_MS + 20)
      return () => clearTimeout(t)
    }
  }, [frames])

  const width = size
  const height = Math.round(size * ASPECT)

  return (
    <div
      className={`relative ${className}`}
      style={{ width, height, cursor: interactive ? 'pointer' : undefined }}
      aria-hidden={interactive ? undefined : 'true'}
      role={interactive ? 'button' : undefined}
      tabIndex={interactive ? 0 : undefined}
      onClick={onClick}
      onKeyDown={interactive ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick?.(e) } } : undefined}
    >
      {belowPose.map((layer) => (
        <img
          key={layer.file}
          src={layerUrl(layer.file)}
          alt=""
          draggable={false}
          className="absolute inset-0 h-full w-full"
          style={{ objectFit: 'contain', opacity: ghostFiles.has(layer.file) ? 0.6 : 1, transition: 'opacity .2s ease' }}
          onError={(e) => { e.currentTarget.style.display = 'none' }}
        />
      ))}
      {/* Pose layer (z=4): crossfades on its own, under the outfit's fore/hat layers. */}
      {frames.map((frame) => (
        <div key={`pose-${frame.id}`} className="absolute inset-0" style={{ opacity: frame.visible ? 1 : 0, transition: `opacity ${CROSSFADE_MS}ms ease` }}>
          <img src={layerUrl(frame.poseFile)} alt="" draggable={false} className="absolute inset-0 h-full w-full" style={{ objectFit: 'contain' }} onError={(e) => { e.currentTarget.style.display = 'none' }} />
        </div>
      ))}
      {abovePose.map((layer) => (
        <img
          key={layer.file}
          src={layerUrl(layer.file)}
          alt=""
          draggable={false}
          className="absolute inset-0 h-full w-full"
          style={{ objectFit: 'contain', opacity: ghostFiles.has(layer.file) ? 0.6 : 1, transition: 'opacity .2s ease' }}
          onError={(e) => { e.currentTarget.style.display = 'none' }}
        />
      ))}
      {/* fx layer (z=7): above everything, including hats. */}
      {frames.map((frame) => frame.fxFile && (
        <div key={`fx-${frame.id}`} className="absolute inset-0" style={{ opacity: frame.visible ? 1 : 0, transition: `opacity ${CROSSFADE_MS}ms ease` }}>
          <img src={layerUrl(frame.fxFile)} alt="" draggable={false} className="absolute inset-0 h-full w-full" style={{ objectFit: 'contain' }} onError={(e) => { e.currentTarget.style.display = 'none' }} />
        </div>
      ))}
    </div>
  )
}

export { VIEWBOX }
