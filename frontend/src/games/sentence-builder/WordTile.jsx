import { Volume2 } from 'lucide-react'

// One word tile. In the tray it has a small speaker button; in a slot it is plain.
export default function WordTile({ tile, index, colors, glow, hidden, used, disabled, onPick, onHear, inSlot }) {
  const cls = `sb-tile ${colors ? `t-${tile.type}` : 't-plain'}${glow ? ' glow' : ''}${used ? ' used' : ''}${inSlot ? ' in-slot' : ''}`
  if (inSlot) return <span className={cls}><b>{tile.text}</b></span>
  return (
    <div
      className={cls} style={hidden ? { visibility: 'hidden' } : undefined} role="button" tabIndex={disabled ? -1 : 0}
      aria-label={tile.text} aria-disabled={disabled} data-tile={tile.id} data-pos={index + 1}
      onClick={() => !disabled && onPick(tile)}
      onKeyDown={(e) => { if (!disabled && e.key === 'Enter') { e.preventDefault(); onPick(tile) } }}
    >
      <button type="button" className="sb-spk" aria-label={`Hear ${tile.text}`} onClick={(e) => { e.stopPropagation(); onHear(tile.text) }}><Volume2 size={16} aria-hidden="true" /></button>
      {tile.text}
    </div>
  )
}
