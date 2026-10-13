import { useLayoutEffect, useRef, useState } from 'react'
import { DEVICES, STAGE } from './model'
import { builderKeyframes } from './ElementView'

// A device frame (tablet / phone / desktop) with the 1024×768 game stage
// scaled to fit inside it. Used by the editor canvas, the test-play modal and
// (with device="fill", no bezel) the patient player — one geometry everywhere.
// `children` are positioned in stage units (0..1024 × 0..768). `onMetrics`
// reports the stage's on-screen rectangle scale so pointer positions can be
// turned back into stage coordinates.
export default function StageViewport({ device = 'tablet', zoom = 1, background = '#FFF4DE', children, stageRef, overlay, onBackgroundClick, onStageDrop, onStageDragOver }) {
  const outer = useRef(null)
  const [box, setBox] = useState({ w: 800, h: 600 })

  useLayoutEffect(() => {
    const el = outer.current
    if (!el) return undefined
    const measure = () => setBox({ w: el.clientWidth, h: el.clientHeight })
    measure()
    if (typeof ResizeObserver === 'undefined') return undefined
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const fill = device === 'fill'
  const d = fill ? { w: box.w, h: box.h, bezel: 0, radius: 0 } : DEVICES[device] || DEVICES.tablet
  const pad = fill ? 0 : 36
  const fit = Math.max(0.05, Math.min((box.w - pad) / (d.w + d.bezel * 2), (box.h - pad) / (d.h + d.bezel * 2)))
  const s = fit * (fill ? 1 : zoom)
  const c = Math.min(d.w / STAGE.w, d.h / STAGE.h) // stage letterboxed inside the device viewport
  const stageW = STAGE.w * c, stageH = STAGE.h * c

  return (
    <div ref={outer} style={{ width: '100%', height: '100%', overflow: fill ? 'hidden' : 'auto', display: 'flex', alignItems: fill ? 'stretch' : 'flex-start', justifyContent: 'center' }}>
      <style>{builderKeyframes}</style>
      <div style={{ margin: fill ? 0 : 'auto', padding: fill ? 0 : 18, flexShrink: 0 }}>
        <div style={{ width: (d.w + d.bezel * 2) * s, height: (d.h + d.bezel * 2) * s, position: 'relative' }}>
          <div style={{ position: 'absolute', left: 0, top: 0, width: d.w + d.bezel * 2, height: d.h + d.bezel * 2, transform: `scale(${s})`, transformOrigin: 'top left', background: fill ? 'transparent' : '#17302a', borderRadius: d.radius + d.bezel, padding: d.bezel, boxSizing: 'border-box', boxShadow: fill ? 'none' : '0 12px 40px rgba(0,0,0,.28)' }}>
            <div onMouseDown={(e) => { if (e.target === e.currentTarget) onBackgroundClick?.() }} onDragOver={onStageDragOver} onDrop={onStageDrop}
              style={{ position: 'relative', width: d.w, height: d.h, background, borderRadius: d.radius, overflow: 'hidden' }}>
              <div ref={stageRef} onMouseDown={(e) => { if (e.target === e.currentTarget) onBackgroundClick?.() }}
                style={{ position: 'absolute', left: (d.w - stageW) / 2, top: (d.h - stageH) / 2, width: STAGE.w, height: STAGE.h, transform: `scale(${c})`, transformOrigin: 'top left', fontFamily: "'Atkinson Hyperlegible','Segoe UI',system-ui,sans-serif" }}>
                {children}
              </div>
              {overlay}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
