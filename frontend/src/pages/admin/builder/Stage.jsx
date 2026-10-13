import { useCallback, useLayoutEffect, useRef, useState } from 'react'
import StageViewport from './StageViewport'
import ElementView from './ElementView'
import { STAGE, snapTo } from './model'
import { speak } from './speak'
import { Caption } from './Player'

// The editable canvas: the current level inside a device frame, drawn with the
// same ElementView the player uses. Select (click / shift-click), drag to move,
// 8 resize handles, snap to grid, floating toolbar, drop from the palette.
// Edits are reported as live patches; the page keeps the undo history (one
// entry per gesture, started by onGestureStart).
const HANDLES = [
  ['nw', 0, 0, 'nwse-resize'], ['n', 0.5, 0, 'ns-resize'], ['ne', 1, 0, 'nesw-resize'], ['e', 1, 0.5, 'ew-resize'],
  ['se', 1, 1, 'nwse-resize'], ['s', 0.5, 1, 'ns-resize'], ['sw', 0, 1, 'nesw-resize'], ['w', 0, 0.5, 'ew-resize'],
]
const MIN = 28

export default function Stage({ level, device, zoom, selection, grid, snap, showGrid, onSelect, onGestureStart, onLive, onGestureEnd, onPaletteDrop, onToolbar, disabled }) {
  const stageRef = useRef(null)
  const [sc, setSc] = useState(1)
  const [layerMenu, setLayerMenu] = useState(false)

  // On-screen scale of the stage, so the toolbar and handles stay a fixed
  // readable size no matter the zoom / device.
  useLayoutEffect(() => {
    const el = stageRef.current
    if (!el) return undefined
    const measure = () => setSc((el.getBoundingClientRect().width / STAGE.w) || 1)
    measure()
    if (typeof ResizeObserver === 'undefined') return undefined
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [device, zoom])

  const toStage = useCallback((clientX, clientY) => {
    const r = stageRef.current.getBoundingClientRect()
    return { x: ((clientX - r.left) / r.width) * STAGE.w, y: ((clientY - r.top) / r.height) * STAGE.h }
  }, [])

  const els = [...level.elements].sort((a, b) => a.z - b.z)
  const selected = level.elements.filter((e) => selection.includes(e.id))
  const sn = (v) => snapTo(v, grid, snap)

  const startGesture = (e, mode, el, handle) => {
    if (disabled || e.button > 0) return
    e.stopPropagation()
    let ids = selection
    if (mode === 'move') {
      if (e.shiftKey) { onSelect(selection.includes(el.id) ? selection.filter((i) => i !== el.id) : [...selection, el.id]); return }
      if (!selection.includes(el.id)) { ids = [el.id]; onSelect(ids) }
    }
    const start = toStage(e.clientX, e.clientY)
    const origs = new Map(level.elements.filter((x) => (mode === 'move' ? ids.includes(x.id) : x.id === el.id)).map((x) => [x.id, { x: x.x, y: x.y, w: x.w, h: x.h }]))
    let began = false
    const altKey = { current: false }

    const move = (ev) => {
      const p = toStage(ev.clientX, ev.clientY)
      const dx = p.x - start.x, dy = p.y - start.y
      if (!began) { if (Math.hypot(dx, dy) * sc < 4) return; began = true; onGestureStart() }
      altKey.current = ev.altKey
      const sx = (v) => (altKey.current ? Math.round(v) : sn(v))
      const patch = {}
      if (mode === 'move') {
        for (const [id, o] of origs) patch[id] = { x: Math.min(STAGE.w - 24, Math.max(-o.w + 24, sx(o.x + dx))), y: Math.min(STAGE.h - 24, Math.max(-o.h + 24, sx(o.y + dy))) }
      } else {
        const o = origs.get(el.id)
        let { x, y, w, h } = o
        if (handle.includes('e')) w = Math.max(MIN, sx(o.x + o.w + dx) - o.x)
        if (handle.includes('s')) h = Math.max(MIN, sx(o.y + o.h + dy) - o.y)
        if (handle.includes('w')) { const nx = Math.min(sx(o.x + dx), o.x + o.w - MIN); w = o.x + o.w - nx; x = nx }
        if (handle.includes('n')) { const ny = Math.min(sx(o.y + dy), o.y + o.h - MIN); h = o.y + o.h - ny; y = ny }
        if (ev.shiftKey && o.w && o.h) { const r = o.w / o.h; if (handle.length === 2) { h = Math.round(w / r); if (handle.includes('n')) y = o.y + o.h - h } }
        patch[el.id] = { x, y, w, h }
      }
      onLive(patch)
    }
    const up = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      if (began) onGestureEnd()
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }

  const single = selected.length === 1 ? selected[0] : null
  const toolbarBelow = single && single.y * sc < 70

  return (
    <StageViewport device={device} zoom={zoom} background={level.background} stageRef={stageRef}
      onBackgroundClick={() => { onSelect([]); setLayerMenu(false) }}
      onStageDragOver={(e) => { if (e.dataTransfer.types.includes('application/x-gb-type')) e.preventDefault() }}
      onStageDrop={(e) => {
        const type = e.dataTransfer.getData('application/x-gb-type')
        if (!type) return
        e.preventDefault()
        const p = toStage(e.clientX, e.clientY)
        onPaletteDrop(type, p.x, p.y)
      }}>
      {showGrid && grid > 0 && <div aria-hidden="true" style={{ position: 'absolute', inset: 0, pointerEvents: 'none', backgroundImage: 'radial-gradient(rgba(0,0,0,.18) 1px, transparent 1.4px)', backgroundSize: `${grid * 4}px ${grid * 4}px` }} />}

      {els.map((el) => {
        const isSel = selection.includes(el.id)
        return (
          <div key={el.id} role="button" tabIndex={0} aria-label={`${el.type.replace('_', ' ')}${el.props.label ? `: ${el.props.label}` : ''}`}
            onPointerDown={(e) => startGesture(e, 'move', el)}
            onKeyDown={(e) => { if (e.key === 'Enter') onSelect([el.id]) }}
            style={{ position: 'absolute', left: el.x, top: el.y, width: el.w, height: el.h, zIndex: el.z + 1, cursor: disabled ? 'default' : 'move', outline: isSel ? `${2 / sc}px solid #2563eb` : 'none', outlineOffset: 2 / sc, touchAction: 'none' }}>
            <ElementView el={el} mode="edit" />
          </div>
        )
      })}

      {/* Resize handles (single selection) */}
      {!disabled && single && HANDLES.map(([name, fx, fy, cursor]) => (
        <div key={name} onPointerDown={(e) => startGesture(e, 'resize', single, name)}
          style={{ position: 'absolute', zIndex: 5000, left: single.x + single.w * fx - 6 / sc, top: single.y + single.h * fy - 6 / sc, width: 12 / sc, height: 12 / sc, background: '#fff', border: `${2 / sc}px solid #2563eb`, borderRadius: 3 / sc, cursor, touchAction: 'none' }} />
      ))}

      {/* Floating toolbar */}
      {!disabled && single && (
        <div role="toolbar" aria-label="Element tools" onPointerDown={(e) => e.stopPropagation()}
          style={{ position: 'absolute', zIndex: 6000, left: single.x + single.w / 2, top: toolbarBelow ? single.y + single.h + 10 / sc : single.y - 10 / sc, transform: `translate(-50%, ${toolbarBelow ? '0' : '-100%'}) scale(${1 / sc})`, transformOrigin: toolbarBelow ? 'top center' : 'bottom center', display: 'flex', gap: 2, background: '#17302a', color: '#fff', borderRadius: 12, padding: 4, whiteSpace: 'nowrap', boxShadow: '0 6px 18px rgba(0,0,0,.3)' }}>
          {[['edit', '✎ Edit'], ['duplicate', '⧉ Duplicate'], ['layer', '⇅ Layer'], ['voice', '🔊 Voice'], ['delete', '🗑']].map(([k, label]) => (
            <button key={k} type="button" aria-label={k} onClick={() => { if (k === 'layer') setLayerMenu((v) => !v); else if (k === 'voice') speak(single.props.voice || single.props.label || single.props.text, single.props.language); else onToolbar(k, single.id) }}
              style={{ minHeight: 34, border: 'none', background: 'transparent', color: k === 'delete' ? '#fca5a5' : '#fff', fontWeight: 700, fontSize: 13, padding: '0 10px', borderRadius: 8, cursor: 'pointer', fontFamily: 'inherit' }}>{label}</button>
          ))}
          {layerMenu && (
            <div style={{ position: 'absolute', top: '100%', left: 0, marginTop: 4, background: '#17302a', borderRadius: 10, padding: 4, display: 'flex', flexDirection: 'column', minWidth: 150 }}>
              {[['front', 'Bring to front'], ['forward', 'Bring forward'], ['backward', 'Send backward'], ['back', 'Send to back']].map(([k, label]) => (
                <button key={k} type="button" onClick={() => { onToolbar(`layer-${k}`, single.id); setLayerMenu(false) }}
                  style={{ minHeight: 32, border: 'none', background: 'transparent', color: '#fff', textAlign: 'left', padding: '0 10px', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>{label}</button>
              ))}
            </div>
          )}
        </div>
      )}

      <Caption text={level.instructions} />

      {level.elements.length === 0 && (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none', color: '#8a6d2f', fontSize: 28, fontWeight: 800, textAlign: 'center', padding: 60 }}>
          Drag elements here, or pick a game template on the left
        </div>
      )}
    </StageViewport>
  )
}
