// Game Builder document model — pure functions only (no React), so the same
// rules drive the editor, the test-play modal and the patient player.
//
// Document: { schema, meta, settings, levels: [{ id, title, difficulty,
// instructions, voice, timeLimit, stars:{three,two}, background, elements: [
// { id, type, x, y, w, h, z, props } ] }] } on a fixed 1024×768 stage.
//
// checklist()/levelProblem() are mirrored in api/_lib/builderDoc.js, which is
// what the server runs before it lets a game publish. Keep the two in sync.
export const STAGE = { w: 1024, h: 768 }
export const DEVICES = {
  tablet: { label: 'Tablet', icon: '▭', w: 1024, h: 768, radius: 28, bezel: 14 },
  phone: { label: 'Phone', icon: '▯', w: 390, h: 780, radius: 40, bezel: 12 },
  desktop: { label: 'Desktop', icon: '▭', w: 1280, h: 720, radius: 14, bezel: 10 },
}
export const LANGUAGES = [['en', 'English'], ['fil', 'Filipino'], ['ceb', 'Bisaya']]
export const THERAPY_TYPES = [['speech', 'Speech & language'], ['cognitive', 'Cognitive'], ['occupational', 'Occupational'], ['physical', 'Physical / motor']]
export const DIFFICULTIES = ['easy', 'medium', 'hard']
export const ANIMATIONS = [['none', 'None'], ['bounce_in', 'Bounce in'], ['fade_in', 'Fade in'], ['pulse', 'Pulse'], ['confetti', 'Confetti'], ['sparkle', 'Sparkle']]
export const SOUNDS = [['ding', 'Ding'], ['cheer', 'Cheer'], ['pop', 'Pop'], ['none', 'None']]

let counter = 0
export const uid = (p = 'e') => `${p}${Date.now().toString(36)}${(counter++).toString(36)}${Math.random().toString(36).slice(2, 5)}`
export const clone = (v) => JSON.parse(JSON.stringify(v))

const baseProps = {
  label: '', alt: '', emoji: '', imageUrl: '', voice: '', language: 'en', readOnTap: true, acceptSpoken: false,
  correctSlot: '', isAnswer: false, slot: '', multiple: false,
  text: '', size: 28, textColor: '#1f3d36', weight: 'bold',
  expected: '', action: 'next', seconds: 60, message: '',
  sound: 'ding', animation: 'none', xp: 20, onWrong: 'retry', hintAfter: 2, bg: '#ffffff',
}

// What the left palette offers. `w`/`h` are the default size on the stage.
export const ELEMENT_CATALOG = [
  { type: 'image_card', label: 'Image card', icon: '🖼️', w: 170, h: 170, props: { emoji: '⭐', label: 'Card' } },
  { type: 'text', label: 'Text', icon: '🔤', w: 420, h: 60, props: { text: 'Write something', size: 30 } },
  { type: 'drop_slot', label: 'Drop slot', icon: '⬚', w: 170, h: 170, props: { slot: '1' } },
  { type: 'voice_prompt', label: 'Voice prompt', icon: '🔊', w: 84, h: 84, props: { voice: 'Listen carefully!' } },
  { type: 'speak_answer', label: 'Speak answer', icon: '🎤', w: 110, h: 110, props: { expected: '', acceptSpoken: true } },
  { type: 'button', label: 'Button', icon: '🔘', w: 200, h: 64, props: { label: 'Next', action: 'next' } },
  { type: 'timer', label: 'Timer', icon: '⏱', w: 140, h: 50, props: { seconds: 60 } },
  { type: 'star_reward', label: 'Star reward', icon: '⭐', w: 220, h: 56, props: {} },
  { type: 'pao_helper', label: 'Pao helper', icon: '🐼', w: 300, h: 110, props: { message: 'You can do it!' } },
  { type: 'sound_effect', label: 'Sound effect', icon: '🎵', w: 120, h: 44, props: { sound: 'cheer' } },
  { type: 'animation', label: 'Animation', icon: '✨', w: 120, h: 44, props: { animation: 'confetti' } },
  { type: 'hint', label: 'Hint', icon: '💡', w: 300, h: 70, props: { text: 'Try the first one!' } },
]
export const CATALOG_BY_TYPE = Object.fromEntries(ELEMENT_CATALOG.map((c) => [c.type, c]))

export function newElement(type, x = 100, y = 100, extra = {}) {
  const c = CATALOG_BY_TYPE[type]
  return { id: uid(), type, x, y, w: c.w, h: c.h, z: 0, props: { ...baseProps, ...c.props, ...extra } }
}

export function newLevel(n = 1, elements = []) {
  return { id: uid('lv'), title: `Level ${n}`, difficulty: 'easy', instructions: '', voice: '', timeLimit: 0, stars: { three: 0, two: 2 }, background: '#FFF4DE', elements }
}

export function blankDoc() {
  return {
    schema: 1,
    meta: { name: 'Untitled game', description: '', template: null, therapyType: null, skillArea: '', difficulty: 'easy', ageMin: null, ageMax: null, pointsPerPlay: 100, badgeName: '', icon: '🎮', thumbnailUrl: '', color: '#1FA58A', therapistNote: '', testPlayed: false },
    settings: { language: 'en', device: 'tablet', grid: 8, snap: true, readAloud: true },
    levels: [newLevel(1)],
  }
}

// ── Templates: ready-made level layouts ─────────────────────────────────────
const el = (type, x, y, w, h, props, z = 0) => ({ id: uid(), type, x, y, w, h, z, props: { ...baseProps, ...CATALOG_BY_TYPE[type].props, ...props } })
const title = (text) => el('text', 112, 36, 800, 70, { text, size: 40 })
const pao = (message) => el('pao_helper', 30, 640, 330, 110, { message })

export const TEMPLATES = [
  { id: 'picture_match', label: 'Picture match', icon: '🖼️', gameType: 'picture_match',
    build: () => [title('Match each picture to its word!'),
      ...[['🐶', 'dog'], ['🐱', 'cat'], ['🐟', 'fish']].flatMap(([emoji, key], i) => [
        el('image_card', 110, 150 + i * 190, 160, 160, { emoji, label: '', alt: key, correctSlot: key, voice: key, readOnTap: true }, 2),
        el('drop_slot', 640, 150 + i * 190, 250, 160, { slot: key, label: key.toUpperCase() }, 1)]),
      el('voice_prompt', 900, 36, 84, 84, { voice: 'Drag each picture to its word.' }), pao('Match them up!')] },
  { id: 'put_in_order', label: 'Put in order', icon: '🔢', gameType: 'step_by_step',
    build: () => {
      const steps = [['🛏️', 'Wake up'], ['🪥', 'Brush teeth'], ['👕', 'Get dressed'], ['🥣', 'Eat breakfast']]
      const shuffled = [1, 3, 0, 2]
      return [title('Put the morning steps in order!'),
        ...steps.map(([emoji, label], i) => el('image_card', 76 + shuffled.indexOf(i) * 220, 160, 180, 180, { emoji, label, alt: label, correctSlot: String(i + 1), voice: label }, 2)),
        ...steps.map((_, i) => el('drop_slot', 76 + i * 220, 430, 180, 180, { slot: String(i + 1) }, 1)),
        el('voice_prompt', 900, 36, 84, 84, { voice: 'What do you do first?' }), pao('What do you do first?')]
    } },
  { id: 'copy_pattern', label: 'Copy pattern', icon: '🎨', gameType: 'step_by_step',
    build: () => [title('Copy the pattern!'), el('text', 262, 120, 500, 80, { text: '🔴  🔵  🔴', size: 64 }),
      ...[['🔴', '1'], ['🔵', '2'], ['🔴', '3']].map(([emoji, key], i) => el('image_card', 160 + i * 260, 290, 150, 150, { emoji, label: '', alt: emoji === '🔴' ? 'Red circle' : 'Blue circle', correctSlot: key }, 2)),
      ...['1', '2', '3'].map((key, i) => el('drop_slot', 160 + i * 260, 500, 150, 150, { slot: key }, 1)), pao('Look, then copy it!')] },
  { id: 'sort_groups', label: 'Sort into groups', icon: '🧺', gameType: 'sort_place',
    build: () => [title('Sort the things into the right basket!'),
      el('drop_slot', 90, 130, 400, 260, { slot: 'red', label: 'Red things', multiple: true, bg: '#fee2e2' }, 1),
      el('drop_slot', 534, 130, 400, 260, { slot: 'blue', label: 'Blue things', multiple: true, bg: '#dbeafe' }, 1),
      ...[['🍎', 'Apple', 'red'], ['🍓', 'Strawberry', 'red'], ['🍒', 'Cherries', 'red'], ['🫐', 'Blueberries', 'blue'], ['🐳', 'Whale', 'blue'], ['💧', 'Water drop', 'blue']]
        .map(([emoji, label, key], i) => el('image_card', 60 + i * 160, 500, 130, 130, { emoji, label, alt: label, correctSlot: key }, 2)), pao('Which basket?')] },
  { id: 'find_sound', label: 'Find the sound', icon: '👂', gameType: 'choose_picture',
    build: () => [title('Which one says "moo"?'), el('voice_prompt', 470, 130, 100, 100, { voice: 'Which one says moo?' }),
      ...[['🐄', 'Cow', true], ['🐶', 'Dog', false], ['🐱', 'Cat', false]].map(([emoji, label, ok], i) => el('image_card', 130 + i * 280, 330, 200, 200, { emoji, label, alt: label, isAnswer: ok, voice: label }, 2)), pao('Listen, then tap!')] },
  { id: 'say_word', label: 'Say the word', icon: '🗣️', gameType: 'say_it',
    build: () => [title('Say the word!'), el('image_card', 362, 150, 300, 300, { emoji: '🍎', label: 'apple', alt: 'A red apple', voice: 'apple' }, 1),
      el('speak_answer', 457, 490, 110, 110, { expected: 'apple', acceptSpoken: true }), el('voice_prompt', 900, 36, 84, 84, { voice: 'Say apple' }), pao('Say it out loud!')] },
]
export const TEMPLATE_BY_ID = Object.fromEntries(TEMPLATES.map((t) => [t.id, t]))

// ── Geometry (edit mode) ────────────────────────────────────────────────────
export const snapTo = (v, grid, on = true) => (on && grid > 0 ? Math.round(v / grid) * grid : Math.round(v))
export const bounds = (els) => {
  const x1 = Math.min(...els.map((e) => e.x)), y1 = Math.min(...els.map((e) => e.y))
  const x2 = Math.max(...els.map((e) => e.x + e.w)), y2 = Math.max(...els.map((e) => e.y + e.h))
  return { x: x1, y: y1, w: x2 - x1, h: y2 - y1 }
}
// Aligns the given elements to each other (or to the stage when only one).
export function alignElements(els, mode) {
  if (!els.length) return {}
  const b = els.length === 1 ? { x: 0, y: 0, w: STAGE.w, h: STAGE.h } : bounds(els)
  const patch = {}
  for (const e of els) {
    const p = {}
    if (mode === 'left') p.x = b.x
    if (mode === 'right') p.x = b.x + b.w - e.w
    if (mode === 'hcenter') p.x = Math.round(b.x + (b.w - e.w) / 2)
    if (mode === 'top') p.y = b.y
    if (mode === 'bottom') p.y = b.y + b.h - e.h
    if (mode === 'vcenter') p.y = Math.round(b.y + (b.h - e.h) / 2)
    patch[e.id] = p
  }
  return patch
}
export function distribute(els, axis) {
  if (els.length < 3) return {}
  const key = axis === 'h' ? 'x' : 'y'; const size = axis === 'h' ? 'w' : 'h'
  const sorted = [...els].sort((a, b) => a[key] - b[key])
  const first = sorted[0], last = sorted[sorted.length - 1]
  const total = last[key] + last[size] - first[key] - sorted.reduce((a, e) => a + e[size], 0)
  const gap = total / (sorted.length - 1)
  let cur = first[key] + first[size] + gap
  const patch = {}
  for (const e of sorted.slice(1, -1)) { patch[e.id] = { [key]: Math.round(cur) }; cur += e[size] + gap }
  return patch
}

// ── Play rules (shared by test play and the patient player) ─────────────────
export function levelMode(level) {
  const els = level.elements
  if (els.some((e) => e.type === 'drop_slot')) return 'slots'
  if (els.some((e) => e.type === 'speak_answer')) return 'speak'
  return 'tap'
}
export const levelCards = (level) => level.elements.filter((e) => e.type === 'image_card')
// 3 stars for ≤ `three` wrong tries, 2 for ≤ `two`, otherwise 1.
export function starsFor(level, wrongs, timedOut = false) {
  if (timedOut) return 1
  if (wrongs <= (level.stars?.three ?? 0)) return 3
  if (wrongs <= (level.stars?.two ?? 2)) return 2
  return 1
}
export const isCorrectDrop = (card, slot) => Boolean(card.props.correctSlot) && card.props.correctSlot === slot.props.slot
export const normalizeSpeech = (s) => String(s || '').toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, '').trim()
export function speechMatches(heard, expected) {
  const h = normalizeSpeech(heard); const e = normalizeSpeech(expected)
  if (!e) return false
  if (h === e || h.includes(e)) return true
  // allow one slip (insert / delete / swap one letter) per word of 4+ letters
  const near = (w, t) => {
    if (w === t) return true
    if (t.length < 4 || Math.abs(w.length - t.length) > 1) return false
    let i = 0
    while (i < w.length && i < t.length && w[i] === t[i]) i++
    if (w.length === t.length) return w.slice(i + 1) === t.slice(i + 1)
    return w.length > t.length ? w.slice(i + 1) === t.slice(i) : w.slice(i) === t.slice(i + 1)
  }
  const words = e.split(/\s+/)
  const heardWords = h.split(/\s+/)
  return words.every((t) => heardWords.some((w) => near(w, t)))
}

// ── Ready to publish (mirror of api/_lib/builderDoc.js) ─────────────────────
export function levelProblem(level) {
  const els = level.elements
  const cards = els.filter((e) => e.type === 'image_card')
  const slots = els.filter((e) => e.type === 'drop_slot')
  const speak = els.filter((e) => e.type === 'speak_answer')
  if (!els.length) return 'is empty'
  if (slots.length) {
    if (!cards.length) return 'has drop slots but no cards'
    const keys = new Set(slots.map((s) => s.props.slot).filter(Boolean))
    if (slots.some((s) => !s.props.slot)) return 'has a drop slot without a slot number'
    if (cards.some((c) => !c.props.correctSlot || !keys.has(c.props.correctSlot))) return 'has no correct slot set for every card'
    return null
  }
  if (speak.length) return speak.every((s) => s.props.expected.trim()) ? null : 'has no expected spoken answer'
  if (cards.length) return cards.some((c) => c.props.isAnswer) ? null : 'has no correct answer marked'
  return 'has no cards or answer'
}
export function checklist(doc, { testPlayed = false } = {}) {
  const lv = doc.levels; const m = doc.meta
  const problems = lv.map((l, i) => ({ i, p: levelProblem(l) })).filter((x) => x.p)
  const missingAlt = lv.flatMap((l) => l.elements).filter((e) => e.type === 'image_card' && e.props.imageUrl && !e.props.alt.trim()).length
  const items = [
    { id: 'structure', ok: Boolean(m.template) && lv.length > 0 && lv.every((l) => l.elements.length > 0), label: 'Template, levels and cards set', hint: !m.template ? 'Pick a game template.' : lv.length === 0 ? 'Add a level.' : 'Every level needs at least one element.' },
    { id: 'answers', ok: lv.length > 0 && problems.length === 0, label: 'Every level has a correct answer', hint: problems[0] ? `Level ${problems[0].i + 1} ${problems[0].p}.` : 'Add a level first.' },
    { id: 'alt', ok: missingAlt === 0, label: 'All images have alt text', hint: `${missingAlt} image${missingAlt === 1 ? '' : 's'} missing alt text.` },
    { id: 'meta', ok: Boolean(m.therapyType) && m.ageMin != null && m.ageMax != null && m.ageMin <= m.ageMax && m.pointsPerPlay != null && m.name.trim().length > 0, label: 'Skill area, ages and points set', hint: 'Fill in the Game tab: therapy type, age range and points per play.' },
    { id: 'tested', ok: Boolean(testPlayed || m.testPlayed), label: 'Test-played at least once', hint: 'Press Test play and finish the game once.' },
  ]
  return { items, ready: items.every((i) => i.ok), done: items.filter((i) => i.ok).length, total: items.length }
}
