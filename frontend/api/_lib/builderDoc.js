// The Game Builder document: what the Super Admin authors and what the player
// renders. Server side: validate/normalise it (never trust the browser), work
// out the "ready to publish" checklist, and map it onto the fields the rest of
// the app already reads from the `games` collection.
//
// KEEP IN SYNC with src/pages/admin/builder/model.js (the browser copy of
// checklist() / constants) — the server runs this one before publishing.
import { Int32 } from 'mongodb'

export const DOC_SCHEMA = 1
export const STAGE = { w: 1024, h: 768 }
export const TEMPLATES = ['picture_match', 'put_in_order', 'copy_pattern', 'sort_groups', 'find_sound', 'say_word']
// Template -> the `game_type` enum the games collection's validator allows.
export const TEMPLATE_GAME_TYPE = {
  picture_match: 'picture_match', put_in_order: 'step_by_step', copy_pattern: 'step_by_step',
  sort_groups: 'sort_place', find_sound: 'choose_picture', say_word: 'say_it',
}
export const ELEMENT_TYPES = ['image_card', 'text', 'drop_slot', 'voice_prompt', 'speak_answer', 'button', 'timer', 'star_reward', 'pao_helper', 'sound_effect', 'animation', 'hint']
// 'sel' (Attention / SEL) is a skill area of its own; in the games collection it is stored
// as therapy_type 'cognitive' plus skill_area 'sel'.
export const THERAPY_TYPES = ['cognitive', 'speech', 'physical', 'occupational', 'sel']
export const DIFFICULTIES = ['easy', 'medium', 'hard']
const LANGS = ['en', 'fil', 'ceb']
const MAX_LEVELS = 30
const MAX_ELEMENTS = 60

const clamp = (n, lo, hi, d) => { const v = Number(n); return Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : d }
// eslint-disable-next-line no-control-regex
const str = (v, max) => String(v ?? '').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').slice(0, max)
const oneOf = (v, list, d) => (list.includes(v) ? v : d)
// Images may only come from our own asset store or https.
const url = (v) => { const s = str(v, 500).trim(); return s.startsWith('/api/game-assets/') || /^https:\/\//.test(s) ? s : '' }
const color = (v, d) => (/^#[0-9a-fA-F]{6}$/.test(String(v)) ? String(v) : d)
const id = (v, d) => (/^[\w-]{1,40}$/.test(String(v)) ? String(v) : d)

function cleanProps(type, p = {}) {
  const base = {
    label: str(p.label, 80), alt: str(p.alt, 200), emoji: str(p.emoji, 8), imageUrl: url(p.imageUrl),
    voice: str(p.voice, 200), language: oneOf(p.language, LANGS, 'en'), readOnTap: p.readOnTap !== false, acceptSpoken: !!p.acceptSpoken,
    correctSlot: str(p.correctSlot, 30), isAnswer: !!p.isAnswer,
    slot: str(p.slot, 30), multiple: !!p.multiple,
    text: str(p.text, 300), size: clamp(p.size, 10, 120, 28), textColor: color(p.textColor, '#1f3d36'), weight: oneOf(p.weight, ['normal', 'bold'], 'bold'),
    expected: str(p.expected, 80), action: oneOf(p.action, ['next', 'hint', 'check', 'restart'], 'next'),
    seconds: clamp(p.seconds, 0, 600, 60), message: str(p.message, 200),
    sound: oneOf(p.sound, ['cheer', 'pop', 'ding', 'none'], 'ding'), animation: oneOf(p.animation, ['none', 'bounce_in', 'fade_in', 'pulse', 'confetti', 'sparkle'], 'none'),
    xp: clamp(p.xp, 0, 500, 20), onWrong: oneOf(p.onWrong, ['retry', 'hint'], 'retry'), hintAfter: clamp(p.hintAfter, 1, 10, 2),
    bg: color(p.bg, '#ffffff'),
  }
  return base
}

// Normalises whatever the browser sent into a safe document.
export function sanitizeDoc(input) {
  const d = input && typeof input === 'object' ? input : {}
  const m = d.meta || {}
  const s = d.settings || {}
  const levels = (Array.isArray(d.levels) ? d.levels : []).slice(0, MAX_LEVELS).map((lv, li) => ({
    id: id(lv?.id, `lv${li + 1}`),
    title: str(lv?.title, 80) || `Level ${li + 1}`,
    difficulty: oneOf(lv?.difficulty, DIFFICULTIES, 'easy'),
    instructions: str(lv?.instructions, 300),
    voice: str(lv?.voice, 300),
    timeLimit: clamp(lv?.timeLimit, 0, 600, 0),
    stars: { three: clamp(lv?.stars?.three, 0, 20, 0), two: clamp(lv?.stars?.two, 0, 20, 2) },
    background: color(lv?.background, '#FFF4DE'),
    elements: (Array.isArray(lv?.elements) ? lv.elements : []).slice(0, MAX_ELEMENTS).filter((e) => ELEMENT_TYPES.includes(e?.type)).map((e, ei) => ({
      id: id(e.id, `e${li}_${ei}`),
      type: e.type,
      x: clamp(e.x, -200, STAGE.w + 200, 0), y: clamp(e.y, -200, STAGE.h + 200, 0),
      w: clamp(e.w, 16, STAGE.w * 2, 120), h: clamp(e.h, 16, STAGE.h * 2, 120),
      z: clamp(e.z, 0, 999, ei),
      props: cleanProps(e.type, e.props),
    })),
  }))
  return {
    schema: DOC_SCHEMA,
    meta: {
      name: str(m.name, 80).trim() || 'Untitled game',
      description: str(m.description, 500),
      template: oneOf(m.template, TEMPLATES, null),
      therapyType: oneOf(m.therapyType, THERAPY_TYPES, null),
      skillArea: str(m.skillArea, 60),
      difficulty: oneOf(m.difficulty, DIFFICULTIES, 'easy'),
      ageMin: m.ageMin === '' || m.ageMin == null ? null : clamp(m.ageMin, 0, 99, null),
      ageMax: m.ageMax === '' || m.ageMax == null ? null : clamp(m.ageMax, 0, 99, null),
      pointsPerPlay: m.pointsPerPlay === '' || m.pointsPerPlay == null ? null : clamp(m.pointsPerPlay, 0, 10000, null),
      badgeName: str(m.badgeName, 80),
      icon: typeof m.icon === 'string' && /^[a-z0-9-]{2,30}$/.test(m.icon) ? m.icon : 'gamepad-2', // a lucide icon name
      thumbnailUrl: url(m.thumbnailUrl),
      color: color(m.color, '#1FA58A'),
      therapistNote: str(m.therapistNote, 1000),
      testPlayed: !!m.testPlayed,
    },
    settings: { language: oneOf(s.language, LANGS, 'en'), device: oneOf(s.device, ['tablet', 'phone', 'desktop'], 'tablet'), grid: clamp(s.grid, 0, 64, 8), snap: s.snap !== false, readAloud: s.readAloud !== false },
    levels,
  }
}

// ── Ready to publish ───────────────────────────────────────────────────────
// Whether a level has something to get right.
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
  const lv = doc.levels
  const m = doc.meta
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

// Fields mirrored onto the games document so the rest of the app (owner
// library, hub, badges, validators) keeps working off the same columns.
export function gameFields(doc) {
  const m = doc.meta
  const f = {
    name: m.name,
    therapy_type: m.therapyType === 'sel' ? 'cognitive' : (m.therapyType || 'cognitive'),
    skill_area: m.therapyType || 'cognitive',
    icon: m.icon,
    difficulty: m.difficulty,
    game_type: TEMPLATE_GAME_TYPE[m.template] || 'step_by_step',
    points_per_play: new Int32(m.pointsPerPlay ?? 100),
  }
  if (m.description) f.description = m.description
  if (m.therapistNote) f.therapist_note = m.therapistNote
  if (m.ageMin != null && m.ageMax != null) f.age_range = { min: new Int32(m.ageMin), max: new Int32(m.ageMax) }
  return f
}

export function blankDoc(overrides = {}) {
  return sanitizeDoc({
    meta: { name: 'Untitled game', ...overrides },
    levels: [{ id: 'lv1', title: 'Level 1', elements: [] }],
  })
}
