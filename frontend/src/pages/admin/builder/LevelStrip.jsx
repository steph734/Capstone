import { useState } from 'react'
import ElementView from './ElementView'
import { DIFFICULTIES, STAGE } from './model'

// Bottom strip: one thumbnail per level (drawn with the real ElementView),
// drag to reorder, add / duplicate / delete, difficulty per level.
const GREEN = '#234C40'
const W = 150
const H = Math.round((W * STAGE.h) / STAGE.w)

export default function LevelStrip({ levels, current, onSelect, onAdd, onDuplicate, onDelete, onMove, onDifficulty, disabled }) {
  const [dragIndex, setDragIndex] = useState(null)
  const [overIndex, setOverIndex] = useState(null)
  return (
    <div role="list" aria-label="Levels" style={{ display: 'flex', gap: 12, alignItems: 'flex-start', overflowX: 'auto', padding: '12px 16px', borderTop: '1px solid #e3e8e4', background: '#fff', flexShrink: 0, opacity: disabled ? 0.5 : 1, pointerEvents: disabled ? 'none' : 'auto' }}>
      {levels.map((lv, i) => {
        const cards = lv.elements.filter((e) => e.type === 'image_card').length
        const on = i === current
        return (
          <div key={lv.id} role="listitem" draggable onDragStart={() => setDragIndex(i)} onDragOver={(e) => { e.preventDefault(); setOverIndex(i) }} onDragEnd={() => { setDragIndex(null); setOverIndex(null) }}
            onDrop={(e) => { e.preventDefault(); if (dragIndex !== null && dragIndex !== i) onMove(dragIndex, i); setDragIndex(null); setOverIndex(null) }}
            style={{ width: W + 4, flexShrink: 0, opacity: dragIndex === i ? 0.4 : 1, outline: overIndex === i && dragIndex !== null && dragIndex !== i ? `2px dashed ${GREEN}` : 'none', outlineOffset: 4, borderRadius: 12 }}>
            <button type="button" onClick={() => onSelect(i)} aria-label={`Level ${i + 1}: ${lv.title}`} aria-current={on}
              style={{ display: 'block', width: W + 4, height: H + 4, padding: 0, borderRadius: 12, border: `2px solid ${on ? '#1FA58A' : '#e3e8e4'}`, background: lv.background, overflow: 'hidden', position: 'relative', cursor: 'pointer' }}>
              <div style={{ position: 'absolute', left: 0, top: 0, width: STAGE.w, height: STAGE.h, transform: `scale(${W / STAGE.w})`, transformOrigin: 'top left', pointerEvents: 'none' }}>
                {[...lv.elements].sort((a, b) => a.z - b.z).map((e) => <div key={e.id} style={{ position: 'absolute', left: e.x, top: e.y, width: e.w, height: e.h }}><ElementView el={e} mode="play" /></div>)}
              </div>
            </button>
            <div style={{ marginTop: 6, fontSize: 12.5, fontWeight: 800, color: '#1f3d36', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Level {i + 1} · {lv.title}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11.5, color: '#6b7c75' }}>
              {cards} card{cards === 1 ? '' : 's'} ·
              <select aria-label={`Level ${i + 1} difficulty`} value={lv.difficulty} onChange={(e) => onDifficulty(i, e.target.value)} style={{ border: 'none', background: 'transparent', color: '#6b7c75', fontSize: 11.5, fontFamily: 'inherit', cursor: 'pointer' }}>{DIFFICULTIES.map((d) => <option key={d} value={d}>{d[0].toUpperCase() + d.slice(1)}</option>)}</select>
            </div>
            {on && (
              <div style={{ display: 'flex', gap: 4, marginTop: 2 }}>
                <button type="button" onClick={() => onDuplicate(i)} aria-label="Duplicate level" style={{ minHeight: 30, border: '1px solid #dbe3df', background: '#fff', borderRadius: 8, fontSize: 12, cursor: 'pointer', padding: '0 8px' }}>⧉</button>
                <button type="button" onClick={() => onDelete(i)} disabled={levels.length < 2} aria-label="Delete level" style={{ minHeight: 30, border: '1px solid #dbe3df', background: '#fff', borderRadius: 8, fontSize: 12, cursor: 'pointer', padding: '0 8px', color: '#b91c1c' }}>🗑</button>
              </div>
            )}
          </div>
        )
      })}
      <button type="button" onClick={onAdd} style={{ width: W, height: H, flexShrink: 0, border: '2px dashed #cfe0d8', borderRadius: 12, background: 'transparent', color: '#5d7770', fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit' }}>＋ Add level</button>
    </div>
  )
}
