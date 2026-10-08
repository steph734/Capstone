import { useEffect, useState } from 'react'
import { PuzzleIcon, GridIcon, CheckIcon, ChevronLeftIcon } from '../../components/icons/SpeechIcons'
import { PUZZLE_SETS, LEVELS } from '../../data/puzzlePals'
import { ShapeEl, PuzzlePiece } from './PuzzleShapes'
import { speakPao } from '../../utils/paoVoice'
import { PUZZLE_LINES, pickLine } from '../../utils/paoLines'

const LAST_KEY = 'puzzle_pals_last'

function readLastSet() {
  try {
    return localStorage.getItem(LAST_KEY) || 'animals'
  } catch {
    return 'animals'
  }
}

function saveLastSet(id) {
  try { localStorage.setItem(LAST_KEY, id) } catch { /* no-op */ }
}

export default function PuzzlePickerModal({ lang = 'en', onStart, onBack }) {
  const [setId, setSetId] = useState(readLastSet)
  const [level, setLevel] = useState('easy')

  useEffect(() => {
    speakPao(pickLine(PUZZLE_LINES.pickPuzzle, lang), { pitch: 1.62, rate: 1.1 })
  }, []) // eslint-disable-line

  const selectedSet = PUZZLE_SETS.find((s) => s.id === setId) || PUZZLE_SETS[0]

  const handleStart = () => {
    saveLastSet(setId)
    onStart({ setId, level })
  }

  const handleSurprise = () => {
    onStart({ setId: 'surprise', level: 'surprise' })
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(8px)', background: 'rgba(60,50,90,.45)', fontFamily: "'Segoe UI',system-ui,sans-serif" }}>
      <style>{`@keyframes gfModalIn{from{opacity:0;transform:scale(.88) translateY(18px)}to{opacity:1;transform:scale(1) translateY(0)}}`}</style>
      <div style={{
        width: 560, maxWidth: '92vw', maxHeight: '92vh', overflowY: 'auto',
        background: 'linear-gradient(145deg,#ffffff,#fdf3e3)', borderRadius: 28, padding: '28px 26px',
        animation: 'gfModalIn .45s cubic-bezier(.34,1.56,.64,1)', boxShadow: '0 24px 64px rgba(80,60,20,.25)',
      }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 4 }}>
          <div style={{ width: 58, height: 58, borderRadius: 16, background: '#ede9fe', color: '#5b21b6', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <PuzzleIcon size={28}/>
          </div>
          <div>
            <h2 style={{ margin: 0, fontSize: 28, fontWeight: 900, color: '#3b1f5c' }}>Pick a puzzle</h2>
            <p style={{ margin: '2px 0 0', fontSize: 13, color: '#64748b', fontWeight: 600 }}>Choose the pictures and how tricky the shapes are</p>
          </div>
        </div>

        {/* PICTURES */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, fontWeight: 900, letterSpacing: 1, color: '#0f766e', textTransform: 'uppercase', margin: '22px 0 10px' }}>
          <GridIcon size={14}/> Pictures
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
          {PUZZLE_SETS.map((set) => {
            const selected = set.id === setId
            const miniShapes = LEVELS[0].shapes
            const miniSize = typeof window !== 'undefined' && window.innerWidth < 640 ? 34 : 50
            return (
              <button
                key={set.id}
                type="button"
                onClick={() => setSetId(set.id)}
                style={{
                  position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
                  padding: '10px 4px 10px', borderRadius: 20, cursor: 'pointer', fontFamily: 'inherit',
                  background: selected ? '#e6fbf2' : '#f2fbf7',
                  border: `2px solid ${selected ? '#34d399' : '#d9efe6'}`,
                  boxShadow: selected ? '0 0 0 4px rgba(52,211,153,.2)' : 'none',
                  transition: 'all .15s',
                }}
              >
                {set.isNew && (
                  <span style={{ position: 'absolute', top: -6, left: -6, background: '#fbbf24', color: '#78350f', fontSize: 9.5, fontWeight: 900, borderRadius: 8, padding: '2px 6px', letterSpacing: .4 }}>
                    NEW
                  </span>
                )}
                {selected && (
                  <span style={{ position: 'absolute', top: -8, right: -8, width: 26, height: 26, borderRadius: '50%', background: '#34d399', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 6px rgba(0,0,0,.2)' }}>
                    <CheckIcon size={14}/>
                  </span>
                )}
                <div style={{ display: 'flex', gap: 2, maxWidth: '100%', justifyContent: 'center' }}>
                  {set.items.slice(0, 3).map((item, i) => (
                    <PuzzlePiece key={item.id} item={{ ...item, shape: miniShapes[i % miniShapes.length] }} size={miniSize}/>
                  ))}
                </div>
                <span style={{ fontSize: 20 }}>{set.icon}</span>
                <span style={{ fontSize: 12.5, fontWeight: 800, color: '#1e293b' }}>{set.label}</span>
              </button>
            )
          })}
        </div>

        {/* SHAPES */}
        <div style={{ fontSize: 12.5, fontWeight: 900, letterSpacing: 1, color: '#0f766e', textTransform: 'uppercase', margin: '22px 0 10px' }}>
          Shapes
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          {LEVELS.map((lvl) => {
            const selected = lvl.id === level
            return (
              <button
                key={lvl.id}
                type="button"
                onClick={() => setLevel(lvl.id)}
                style={{
                  flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
                  padding: '12px 8px', borderRadius: 18, cursor: 'pointer', fontFamily: 'inherit',
                  background: selected ? '#fffbeb' : '#fff',
                  border: `2px solid ${selected ? '#fbbf24' : '#e2e8f0'}`,
                  boxShadow: selected ? '0 0 0 4px rgba(251,191,36,.2)' : 'none',
                  transition: 'all .15s',
                }}
              >
                <div style={{ display: 'flex', gap: 4 }}>
                  {lvl.shapes.slice(0, 3).map((s) => (
                    <svg key={s} viewBox="0 0 100 100" width={22} height={22}>
                      <ShapeEl shape={s} fill={lvl.colour}/>
                    </svg>
                  ))}
                </div>
                <span style={{ fontSize: 13.5, fontWeight: 900, color: '#1e293b' }}>{lvl.label}</span>
                <span style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8' }}>{lvl.shapes.length} shapes</span>
              </button>
            )
          })}
        </div>

        {/* Surprise me */}
        <button
          type="button"
          onClick={handleSurprise}
          style={{
            width: '100%', marginTop: 16, padding: '12px', borderRadius: 999, cursor: 'pointer', fontFamily: 'inherit',
            background: '#faf5ff', border: '2px dashed #c4b5fd', color: '#5b21b6', fontSize: 13.5, fontWeight: 800,
          }}
        >
          🔀 Surprise me: random pictures and shapes
        </button>

        {/* Start */}
        <button
          type="button"
          onClick={handleStart}
          style={{ width: '100%', marginTop: 14, background: '#34d399', border: 'none', color: '#fff', borderRadius: 14, padding: '13px', cursor: 'pointer', fontFamily: 'inherit', fontSize: 15, fontWeight: 800, boxShadow: '0 6px 16px rgba(52,211,153,.4)' }}
        >
          Start {selectedSet.label} puzzle 🎮
        </button>

        {/* Back */}
        <button
          type="button"
          onClick={onBack}
          style={{ width: '100%', marginTop: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, background: '#fdf2f4', border: '1.5px solid #f3e1e5', color: '#64748b', borderRadius: 12, padding: '10px', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: 700 }}
        >
          <ChevronLeftIcon size={15}/> Back
        </button>

        {/* Progress line */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 16, fontSize: 11.5, fontWeight: 700 }}>
          <span style={{ color: '#34d399' }}>● About the game</span>
          <span style={{ color: '#cbd5e1' }}>›</span>
          <span style={{ color: '#34d399' }}>● Pick a puzzle</span>
          <span style={{ color: '#cbd5e1' }}>›</span>
          <span style={{ color: '#94a3b8' }}>○ Play</span>
        </div>
      </div>
    </div>
  )
}
