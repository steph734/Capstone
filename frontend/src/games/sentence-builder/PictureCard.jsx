import { Volume2 } from 'lucide-react'
import Scene from './pictures/Scene'
import WordTile from './WordTile'

// Scene picture, one slot per word (single row) and "Hear my sentence".
export default function PictureCard({ puzzle, slots, done, colors, onHear }) {
  const n = puzzle.words.length
  const nextIdx = slots.findIndex((s) => !s)
  return (
    <div className={`sb-card${done ? ' done' : ''}`}>
      <div className="sb-scene"><Scene id={puzzle.picture} window={puzzle.id === 'cat-sleeping'} /></div>
      <div className="sb-cardtext">
        <span className="sb-label">{done ? 'You built it!' : 'Look at the picture. Build the sentence.'}</span>
        <div className={`sb-slots n${n}`}>
          {slots.map((tile, i) => (
            tile
              ? <WordTile key={i} tile={tile} colors={colors} inSlot />
              : <span key={i} className={`sb-slot${i === nextIdx ? ' next' : ''}`} data-slot={i} aria-label={`word ${i + 1} of ${n}, empty`}>{i === nextIdx && <b>?</b>}</span>
          ))}
          <span className="sb-period" aria-hidden="true" />
        </div>
        <button type="button" className="sb-hearbtn" onClick={onHear}><Volume2 size={20} aria-hidden="true" /> Hear my sentence</button>
      </div>
    </div>
  )
}
