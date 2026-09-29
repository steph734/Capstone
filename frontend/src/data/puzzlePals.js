// Shapes are drawn in a 100×100 box. `peg` and `emojiY` are fractions of the piece size;
// they move the wooden peg and the picture so both sit nicely inside each shape.
const poly = (n, r, cx, cy, rot) => Array.from({ length: n }, (_, i) => {
  const t = (i / n) * Math.PI * 2 + rot
  return `${(cx + r * Math.cos(t)).toFixed(1)},${(cy + r * Math.sin(t)).toFixed(1)}`
}).join(' ')
const star = (points, outer, inner, cy) => Array.from({ length: points * 2 }, (_, i) => {
  const r = i % 2 ? inner : outer, t = (i / (points * 2)) * Math.PI * 2 - Math.PI / 2
  return `${(50 + r * Math.cos(t)).toFixed(1)},${(cy + r * Math.sin(t)).toFixed(1)}`
}).join(' ')

// Each shape: tag + attrs for an SVG element. Render with <PuzzleShape shape={id} .../> (see PuzzleShapes.jsx).
export const SHAPES = {
  circle:     { el: 'circle',  a: { cx: 50, cy: 50, r: 46 } },
  square:     { el: 'rect',    a: { x: 5, y: 5, width: 90, height: 90, rx: 16 } },
  triangle:   { el: 'path',    a: { d: 'M50 5 Q55 5 58 10 L95 84 Q98 94 88 94 H12 Q2 94 5 84 L42 10 Q45 5 50 5Z' }, peg: .2, emojiY: .12, emojiSize: .4 },
  rectangle:  { el: 'rect',    a: { x: 3, y: 20, width: 94, height: 60, rx: 12 }, peg: .2, emojiSize: .4 },
  oval:       { el: 'ellipse', a: { cx: 50, cy: 50, rx: 48, ry: 36 }, peg: .14 },
  star:       { el: 'polygon', a: { points: star(5, 50, 25, 54) }, peg: .2, emojiY: .06, emojiSize: .34 },
  heart:      { el: 'path',    a: { d: 'M50 94 C22 74 3 56 3 33 C3 16 16 5 31 5 C41 5 47 11 50 19 C53 11 59 5 69 5 C84 5 97 16 97 33 C97 56 78 74 50 94Z' }, peg: .1, emojiSize: .42 },
  semicircle: { el: 'path',    a: { d: 'M3 78 A47 47 0 0 1 97 78 Q97 84 91 84 H9 Q3 84 3 78Z' }, peg: .36, emojiY: .14, emojiSize: .36 },
  flower:     { el: 'polygon', a: { points: star(8, 48, 38, 50) } },
  diamond:    { el: 'polygon', a: { points: '50,2 97,50 50,98 3,50' }, peg: .1, emojiSize: .4 },
  pentagon:   { el: 'polygon', a: { points: poly(5, 49, 50, 54, -Math.PI / 2) }, peg: .1, emojiY: .04 },
  hexagon:    { el: 'polygon', a: { points: poly(6, 47, 50, 50, 0) } },
  octagon:    { el: 'polygon', a: { points: poly(8, 49, 50, 50, Math.PI / 8) } },
}

export const SHAPE_NAMES = {
  circle:     { en: 'circle',      tl: 'bilog',             ceb: 'lingin' },
  square:     { en: 'square',      tl: 'parisukat',         ceb: 'kwadrado' },
  triangle:   { en: 'triangle',    tl: 'tatsulok',          ceb: 'trayanggulo' },
  rectangle:  { en: 'rectangle',   tl: 'parihaba',          ceb: 'rektanggulo' },
  oval:       { en: 'oval',        tl: 'biluhaba',          ceb: 'obalo' },
  star:       { en: 'star',        tl: 'bituin',            ceb: 'bituon' },
  heart:      { en: 'heart',       tl: 'puso',              ceb: 'kasingkasing' },
  semicircle: { en: 'half circle', tl: 'kalahating bilog',  ceb: 'tunga nga lingin' },
  flower:     { en: 'flower',      tl: 'bulaklak',          ceb: 'bulak' },
  diamond:    { en: 'diamond',     tl: 'diyamante',         ceb: 'diyamante' },
  pentagon:   { en: 'pentagon',    tl: 'pentagon',          ceb: 'pentagon' },
  hexagon:    { en: 'hexagon',     tl: 'heksagon',          ceb: 'heksagon' },
  octagon:    { en: 'octagon',     tl: 'oktagon',           ceb: 'oktagon' },
}

// What Pao says about the shape when a piece is placed.
export const SHAPE_FACTS = {
  circle:     { en: 'A circle is round. It has no corners!',          tl: 'Bilog ang bilog. Wala itong sulok!',                 ceb: 'Lingin ang lingin. Wala kini eskina!' },
  square:     { en: 'A square has 4 sides, all the same!',             tl: 'May 4 na gilid ang parisukat, pare-pareho lahat!',  ceb: 'Ang kwadrado adunay 4 ka kilid, parehas tanan!' },
  triangle:   { en: 'A triangle has 3 sides. Count them: 1, 2, 3!',   tl: 'May 3 gilid ang tatsulok. Bilangin: 1, 2, 3!',      ceb: 'Ang trayanggulo adunay 3 ka kilid. Ihapa: 1, 2, 3!' },
  rectangle:  { en: 'A rectangle has 4 sides. 2 are long!',           tl: 'May 4 na gilid ang parihaba. 2 ang mahaba!',        ceb: 'Ang rektanggulo adunay 4 ka kilid. 2 ang taas!' },
  oval:       { en: 'An oval looks like an egg!',                      tl: 'Ang biluhaba ay parang itlog!',                     ceb: 'Ang obalo morag itlog!' },
  star:       { en: 'A star has 5 points. Count them: 1, 2, 3, 4, 5!', tl: 'May 5 na tulis ang bituin. Bilangin: 1, 2, 3, 4, 5!', ceb: 'Ang bituon adunay 5 ka tumoy. Ihapa: 1, 2, 3, 4, 5!' },
  heart:      { en: 'A heart has 2 bumps and 1 point!',                tl: 'May 2 umbok at 1 tulis ang puso!',                  ceb: 'Ang kasingkasing adunay 2 ka bukol ug 1 ka tumoy!' },
  semicircle: { en: 'A half circle is round on top and flat at the bottom!', tl: 'Bilog sa itaas at patag sa ibaba ang kalahating bilog!', ceb: 'Lingin sa taas ug patag sa ubos ang tunga nga lingin!' },
  flower:     { en: 'This flower shape has 8 petals!',                 tl: 'May 8 talulot ang hugis-bulaklak na ito!',          ceb: 'Kining porma sa bulak adunay 8 ka talulot!' },
  diamond:    { en: 'A diamond is a square standing on its corner!',   tl: 'Ang diyamante ay parisukat na nakatayo sa sulok!',  ceb: 'Ang diyamante kay kwadrado nga nagtindog sa eskina!' },
  pentagon:   { en: 'A pentagon has 5 sides, like a little house!',    tl: 'May 5 gilid ang pentagon, parang maliit na bahay!', ceb: 'Ang pentagon adunay 5 ka kilid, morag gamay nga balay!' },
  hexagon:    { en: 'A hexagon has 6 sides, like a honeycomb!',        tl: 'May 6 na gilid ang heksagon, parang bahay-pukyutan!', ceb: 'Ang heksagon adunay 6 ka kilid, morag balay sa putyokan!' },
  octagon:    { en: 'An octagon has 8 sides, like a stop sign!',       tl: 'May 8 gilid ang oktagon, parang karatulang STOP!',  ceb: 'Ang oktagon adunay 8 ka kilid, morag karatula nga STOP!' },
}

export const LEVELS = [
  { id: 'easy',   label: 'Easy',   shapes: ['circle', 'square', 'triangle', 'rectangle'],          decoy: false, colour: '#34d399', dark: '#047857' },
  { id: 'medium', label: 'Medium', shapes: ['oval', 'star', 'heart', 'semicircle', 'flower'],     decoy: true,  colour: '#fbbf24', dark: '#b45309' },
  { id: 'hard',   label: 'Hard',   shapes: ['diamond', 'pentagon', 'hexagon', 'octagon'],         decoy: true,  colour: '#f87171', dark: '#b91c1c' },
]

// Every item in a set has a different colour, so "the red one" always means one piece.
const it = (id, emoji, colorName, color, dark, en, tl, ceb) => ({ id, emoji, colorName, color, dark, names: { en, tl, ceb } })
export const PUZZLE_SETS = [
  { id: 'animals', label: 'Animals', icon: '🦁', items: [
    it('lion', '🦁', 'Orange', '#f59e0b', '#b45309', 'Lion', 'Leon', 'Leon'),
    it('bear', '🐻', 'Brown', '#a16207', '#713f12', 'Bear', 'Oso', 'Oso'),
    it('giraffe', '🦒', 'Yellow', '#facc15', '#a16207', 'Giraffe', 'Giraffe', 'Giraffe'),
    it('elephant', '🐘', 'Blue', '#3b82f6', '#1d4ed8', 'Elephant', 'Elepante', 'Elepante'),
    it('zebra', '🦓', 'Grey', '#64748b', '#334155', 'Zebra', 'Sebra', 'Sebra'),
  ] },
  { id: 'fruits', label: 'Fruits', icon: '🍎', isNew: true, items: [
    it('apple', '🍎', 'Red', '#ef4444', '#991b1b', 'Apple', 'Mansanas', 'Mansanas'),
    it('banana', '🍌', 'Yellow', '#facc15', '#a16207', 'Banana', 'Saging', 'Saging'),
    it('orange', '🍊', 'Orange', '#fb923c', '#c2410c', 'Orange', 'Dalandan', 'Dalandan'),
    it('grapes', '🍇', 'Purple', '#a855f7', '#6b21a8', 'Grapes', 'Ubas', 'Ubas'),
    it('watermelon', '🍉', 'Green', '#22c55e', '#15803d', 'Watermelon', 'Pakwan', 'Pakwan'),
  ] },
  { id: 'vehicles', label: 'Vehicles', icon: '🚗', isNew: true, items: [
    it('car', '🚗', 'Red', '#ef4444', '#991b1b', 'Car', 'Kotse', 'Awto'),
    it('bus', '🚌', 'Yellow', '#facc15', '#a16207', 'Bus', 'Bus', 'Bus'),
    it('bike', '🚲', 'Blue', '#3b82f6', '#1d4ed8', 'Bike', 'Bisikleta', 'Bisikleta'),
    it('tractor', '🚜', 'Green', '#22c55e', '#15803d', 'Tractor', 'Traktora', 'Traktor'),
    it('helicopter', '🚁', 'Orange', '#fb923c', '#c2410c', 'Helicopter', 'Helikopter', 'Helikopter'),
  ] },
  { id: 'sea', label: 'Under the Sea', icon: '🐠', isNew: true, items: [
    it('fish', '🐟', 'Blue', '#3b82f6', '#1d4ed8', 'Fish', 'Isda', 'Isda'),
    it('octopus', '🐙', 'Purple', '#a855f7', '#6b21a8', 'Octopus', 'Pugita', 'Kugita'),
    it('turtle', '🐢', 'Green', '#22c55e', '#15803d', 'Turtle', 'Pagong', 'Pawikan'),
    it('crab', '🦀', 'Red', '#ef4444', '#991b1b', 'Crab', 'Alimango', 'Alimango'),
    it('shell', '🐚', 'Pink', '#f472b6', '#be185d', 'Shell', 'Kabibe', 'Kinhason'),
  ] },
  { id: 'toys', label: 'Toys', icon: '🧸', isNew: true, items: [
    it('teddy', '🧸', 'Brown', '#a16207', '#713f12', 'Teddy Bear', 'Teddy Bear', 'Teddy Bear'),
    it('ball', '⚽', 'Grey', '#64748b', '#334155', 'Ball', 'Bola', 'Bola'),
    it('balloon', '🎈', 'Red', '#ef4444', '#991b1b', 'Balloon', 'Lobo', 'Lobo'),
    it('kite', '🪁', 'Yellow', '#facc15', '#a16207', 'Kite', 'Saranggola', 'Tabanog'),
    it('gift', '🎁', 'Purple', '#a855f7', '#6b21a8', 'Gift', 'Regalo', 'Regalo'),
  ] },
  { id: 'home', label: 'Things at Home', icon: '🏠', isNew: true, items: [
    it('cup', '☕', 'Blue', '#3b82f6', '#1d4ed8', 'Cup', 'Tasa', 'Tasa'),
    it('chair', '🪑', 'Brown', '#a16207', '#713f12', 'Chair', 'Upuan', 'Lingkoranan'),
    it('lamp', '💡', 'Yellow', '#facc15', '#a16207', 'Lamp', 'Lampara', 'Suga'),
    it('clock', '⏰', 'Red', '#ef4444', '#991b1b', 'Clock', 'Orasan', 'Relo'),
    it('bed', '🛏️', 'Green', '#22c55e', '#15803d', 'Bed', 'Kama', 'Katre'),
  ] },
]

const shuffle = (arr) => [...arr].sort(() => Math.random() - 0.5)

// One round: 3 board pieces (+1 decoy on Medium/Hard), each item gets a different shape from the level.
// setId 'surprise' mixes items from every set; level 'surprise' picks a random level.
export function buildPuzzleRound(setId, levelId) {
  const level = levelId === 'surprise' ? shuffle(LEVELS)[0] : LEVELS.find((l) => l.id === levelId) || LEVELS[0]
  let pool = setId === 'surprise'
    ? PUZZLE_SETS.flatMap((s) => s.items)
    : (PUZZLE_SETS.find((s) => s.id === setId) || PUZZLE_SETS[0]).items
  // Keep colours unique inside a round, so colour words stay unambiguous.
  const picked = []
  for (const item of shuffle(pool)) {
    if (!picked.some((p) => p.colorName === item.colorName)) picked.push(item)
    if (picked.length === (level.decoy ? 4 : 3)) break
  }
  const shapes = shuffle(level.shapes)
  const pieces = picked.map((item, i) => ({ ...item, shape: shapes[i % shapes.length] }))
  const [top, under, nextTo, decoy = null] = pieces
  return { level: level.id, board: { top, under, nextTo }, decoy }
}
