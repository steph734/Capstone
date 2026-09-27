// Data + tiny icon set for the "Design a clothing item" builder on the
// Badges page's Clothes tab. This is a *generative* preview (style
// silhouette + main/trim colour + pattern + sticker), not the same thing
// as the hand-drawn per-item SVGs in PaoOutfits.jsx that the patient-facing
// PaoCustomizePage actually renders — building 20+ bespoke accessory SVGs
// per admin-created item is out of scope, so the preview here is an
// approximation (a colored/patterned icon), consistent with how the badge
// builder also renders a generic medal rather than real trophy art.

function IconBase({ size = 20, children }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {children}
    </svg>
  )
}

/* ── Hair ── */
function BeanieIcon(props) {
  return <IconBase {...props}><path d="M4 16a8 8 0 0 1 16 0" /><line x1="3" y1="16" x2="21" y2="16" /><circle cx="17" cy="7" r="1.3" fill="currentColor" stroke="none" /></IconBase>
}
function CapIcon(props) {
  return <IconBase {...props}><path d="M3 15a9 9 0 0 1 18 0" /><path d="M15 14.5c3 .1 5.5.7 6.5 2c-2 1-4.6 1-6.8.6" /></IconBase>
}
function TopHatIcon(props) {
  return <IconBase {...props}><rect x="8" y="3" width="8" height="9" rx="1" /><ellipse cx="12" cy="16" rx="9" ry="2.2" /></IconBase>
}
function CrownIcon(props) {
  return <IconBase {...props}><path d="M4 18h16l-1-9-4 4-3-6-3 6-4-4-1 9z" /></IconBase>
}
function BowIcon(props) {
  return <IconBase {...props}><path d="M11 12 3 7v10z" /><path d="M13 12l8-5v10z" /><circle cx="12" cy="12" r="1.8" fill="currentColor" stroke="none" /></IconBase>
}
function HeadbandIcon(props) {
  return <IconBase {...props}><path d="M3 13a9 9 0 0 1 18 0" /></IconBase>
}

/* ── Clothes ── */
function TeeIcon(props) {
  return <IconBase {...props}><path d="M9 3 6 5 4 9l2.5 2L8 9.5V20a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V9.5L17.5 11 20 9l-2-4-3-2-3 2z" /></IconBase>
}
function HoodieIcon(props) {
  return <IconBase {...props}><path d="M12 2c-2 0-3.3 1.4-3.3 3L4 8l2 3 2.7-1.6V20a1 1 0 0 0 1 1h4.6a1 1 0 0 0 1-1V9.4L18 11l2-3-4.7-3C15.3 3.4 14 2 12 2z" /><path d="M9.3 6.2a2.7 2.7 0 0 0 5.4 0" /></IconBase>
}
function JacketIcon(props) {
  return <IconBase {...props}><path d="M9 3 6 5 4 9l2 2 1.5-1V20a1 1 0 0 0 1 1h7a1 1 0 0 0 1-1V10l1.5 1 2-2-2-4-3-2-3 2z" /><path d="M9 3l3 4 3-4" /></IconBase>
}
function DressIcon(props) {
  return <IconBase {...props}><path d="M9 3h6l1.2 4-1.8 1 3 13H6.6l3-13-1.8-1z" /></IconBase>
}
function VestIcon(props) {
  return <IconBase {...props}><path d="M8 4 6 8v11a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V8l-2-4-4 2z" /></IconBase>
}
function OveralIconTop(props) {
  return <IconBase {...props}><path d="M7 3v5H5v13h5v-6h4v6h5V8h-2V3h-3v4h-4V3z" /></IconBase>
}

/* ── Pants ── */
function ShortsIcon(props) {
  return <IconBase {...props}><path d="M5 4h14l.8 6-1.8 9h-2.7l-1.3-7-1.3 7H9.3L8 10 6.8 19H4.2L5 4z" transform="scale(1,0.72) translate(0,3)" /></IconBase>
}
function JeansIcon(props) {
  return <IconBase {...props}><path d="M6 3h12l.8 6-1.3 12h-3l-1-9-1 9h-3l-1-9-1 9h-3L5.2 9z" /></IconBase>
}
function LeggingsIcon(props) {
  return <IconBase {...props}><path d="M7.5 3h9l.5 6-1 12h-2.3l-.7-11-.7 11h-2.3l-.7-11-.7 11H6.5l-1-12z" /></IconBase>
}
function OveralIconPants(props) {
  return <IconBase {...props}><rect x="8" y="2.5" width="8" height="6" rx="1" /><path d="M6 8h12l.6 5-1 10h-2.6l-.8-8-.8 8H10.6l-.8-8-.8 8H6.4l-1-10z" /></IconBase>
}

/* ── Shoes ── */
function SneakerIcon(props) {
  return <IconBase {...props}><path d="M3 17.5v-3l4-1 3-3h4.5l2 2H21a2 2 0 0 1 2 0v5z" /><line x1="3" y1="17.5" x2="23" y2="17.5" /></IconBase>
}
function BootIcon(props) {
  return <IconBase {...props}><path d="M8 3v9l-5 3v2.5h16V15l-3-2V3z" /></IconBase>
}
function SandalIcon(props) {
  return <IconBase {...props}><ellipse cx="12" cy="16.5" rx="9" ry="2.3" /><path d="M6 16.5V9M12 16.5V7M18 16.5V9" /></IconBase>
}
function FlatIcon(props) {
  return <IconBase {...props}><path d="M3 16.5c0-2.8 3.8-6.5 8.5-6.5h6.7A1.8 1.8 0 0 1 20 11.8c0 2.7-2.8 4.7-7.4 4.7H3z" /></IconBase>
}

export const STYLE_OPTIONS = {
  Hair: [
    { id: 'beanie', label: 'Beanie', Icon: BeanieIcon },
    { id: 'cap', label: 'Cap', Icon: CapIcon },
    { id: 'tophat', label: 'Top hat', Icon: TopHatIcon },
    { id: 'crown', label: 'Crown', Icon: CrownIcon },
    { id: 'bow', label: 'Bow', Icon: BowIcon },
    { id: 'headband', label: 'Headband', Icon: HeadbandIcon },
  ],
  Clothes: [
    { id: 'tee', label: 'Tee', Icon: TeeIcon },
    { id: 'hoodie', label: 'Hoodie', Icon: HoodieIcon },
    { id: 'jacket', label: 'Jacket', Icon: JacketIcon },
    { id: 'dress', label: 'Dress', Icon: DressIcon },
    { id: 'vest', label: 'Vest', Icon: VestIcon },
    { id: 'overalls', label: 'Overalls', Icon: OveralIconTop },
  ],
  Pants: [
    { id: 'shorts', label: 'Shorts', Icon: ShortsIcon },
    { id: 'jeans', label: 'Jeans', Icon: JeansIcon },
    { id: 'leggings', label: 'Leggings', Icon: LeggingsIcon },
    { id: 'overalls', label: 'Overalls', Icon: OveralIconPants },
  ],
  Shoes: [
    { id: 'sneakers', label: 'Sneakers', Icon: SneakerIcon },
    { id: 'boots', label: 'Boots', Icon: BootIcon },
    { id: 'sandals', label: 'Sandals', Icon: SandalIcon },
    { id: 'flats', label: 'Flats', Icon: FlatIcon },
  ],
}

// The slot picker buttons reuse each category's first style as a stand-in
// icon, same idea as a folder icon standing in for "Documents".
export const SLOT_ICONS = {
  Hair: BeanieIcon, Clothes: TeeIcon, Pants: JeansIcon, Shoes: SneakerIcon,
}

export function styleIconFor(category, styleId) {
  return (STYLE_OPTIONS[category] || []).find((s) => s.id === styleId)?.Icon || SLOT_ICONS[category] || TeeIcon
}

export const COLOURS = [
  { id: 'red', label: 'Red', hex: '#ef4444' },
  { id: 'orange', label: 'Orange', hex: '#f97316' },
  { id: 'yellow', label: 'Yellow', hex: '#eab308' },
  { id: 'lime', label: 'Lime', hex: '#84cc16' },
  { id: 'green', label: 'Green', hex: '#22c55e' },
  { id: 'teal', label: 'Teal', hex: '#14b8a6' },
  { id: 'sky', label: 'Sky', hex: '#38bdf8' },
  { id: 'blue', label: 'Blue', hex: '#3b82f6' },
  { id: 'purple', label: 'Purple', hex: '#a855f7' },
  { id: 'pink', label: 'Pink', hex: '#ec4899' },
  { id: 'rose', label: 'Rose', hex: '#fda4af' },
  { id: 'brown', label: 'Brown', hex: '#92400e' },
  { id: 'black', label: 'Black', hex: '#1f2937' },
  { id: 'gray', label: 'Gray', hex: '#9ca3af' },
  { id: 'white', label: 'White', hex: '#f8fafc' },
]

export const PATTERNS = [
  { id: 'solid', label: 'Solid' },
  { id: 'stripes', label: 'Stripes' },
  { id: 'dots', label: 'Dots' },
  { id: 'stars', label: 'Stars' },
  { id: 'hearts', label: 'Hearts' },
  { id: 'checks', label: 'Checks' },
  { id: 'zigzag', label: 'Zigzag' },
]

export const STICKERS = [
  { id: 'none', label: 'None', glyph: null },
  { id: 'star', label: 'Star', glyph: '⭐' },
  { id: 'heart', label: 'Heart', glyph: '❤️' },
  { id: 'rainbow', label: 'Rainbow', glyph: '🌈' },
  { id: 'bolt', label: 'Bolt', glyph: '⚡' },
  { id: 'music', label: 'Music', glyph: '🎵' },
  { id: 'flower', label: 'Flower', glyph: '🌸' },
  { id: 'paw', label: 'Paw', glyph: '🐾' },
  { id: 'moon', label: 'Moon', glyph: '🌙' },
]

function hexFor(list, id, fallbackHex) {
  return list.find((o) => o.id === id)?.hex ?? fallbackHex
}
export function colourHex(id) { return hexFor(COLOURS, id, '#9ca3af') }

const SCATTER = [[18, 22], [62, 15], [82, 55], [30, 68], [55, 42]]

/* CSS background for the patterned overlay layer — stripes/dots/checks/
   zigzag are pure CSS gradients; stars/hearts scatter a few glyphs instead
   since a tiled glyph background isn't practical without an image asset. */
export function patternBackgroundStyle(patternId, accentHex) {
  switch (patternId) {
    case 'stripes':
      return { backgroundImage: `repeating-linear-gradient(45deg, ${accentHex} 0px, ${accentHex} 6px, transparent 6px, transparent 14px)` }
    case 'dots':
      return { backgroundImage: `radial-gradient(${accentHex} 28%, transparent 30%)`, backgroundSize: '14px 14px' }
    case 'checks':
      return {
        backgroundImage: `linear-gradient(45deg, ${accentHex} 25%, transparent 25%, transparent 75%, ${accentHex} 75%), linear-gradient(45deg, ${accentHex} 25%, transparent 25%, transparent 75%, ${accentHex} 75%)`,
        backgroundSize: '16px 16px',
        backgroundPosition: '0 0, 8px 8px',
      }
    case 'zigzag':
      return {
        backgroundImage: `linear-gradient(135deg, ${accentHex} 25%, transparent 25%), linear-gradient(225deg, ${accentHex} 25%, transparent 25%)`,
        backgroundSize: '14px 14px',
      }
    default:
      return null
  }
}

export function ClothingPreviewIcon({ category, style, mainColour, trimColour, pattern, patternColour, sticker, size = 64 }) {
  const Icon = styleIconFor(category, style)
  const main = colourHex(mainColour)
  const trim = colourHex(trimColour)
  const accent = colourHex(patternColour)
  const patternBg = patternBackgroundStyle(pattern, accent)
  const showGlyphScatter = pattern === 'stars' || pattern === 'hearts'
  const glyph = pattern === 'stars' ? '★' : '♥'
  const stickerDef = STICKERS.find((s) => s.id === sticker)

  return (
    <div
      style={{
        position: 'relative', width: size, height: size, borderRadius: size * 0.26,
        background: main, border: `${Math.max(2, size * 0.045)}px solid ${trim}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        overflow: 'hidden', flexShrink: 0,
      }}
    >
      {patternBg && <div style={{ position: 'absolute', inset: 0, opacity: 0.55, ...patternBg }} />}
      {showGlyphScatter && SCATTER.map(([x, y], i) => (
        <span key={i} style={{ position: 'absolute', left: `${x}%`, top: `${y}%`, transform: 'translate(-50%,-50%)', color: accent, fontSize: size * 0.16, opacity: 0.8, lineHeight: 1 }}>{glyph}</span>
      ))}
      <Icon size={size * 0.52} />
      {stickerDef?.glyph && (
        <span style={{ position: 'absolute', bottom: -size * 0.03, right: -size * 0.03, fontSize: size * 0.3, lineHeight: 1, filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.35))' }}>
          {stickerDef.glyph}
        </span>
      )}
    </div>
  )
}
