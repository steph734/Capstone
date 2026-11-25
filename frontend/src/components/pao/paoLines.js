// Everything Pao says in Customize Pao, in one place. Components never
// hard-code a line: they call paoSay(event, payload).
// Placeholders: {name}, {slot}, {badge}, {have}, {need}.

const MAX_NAME = 24

export const POSE_LINES = {
  relax: 'Ahh, nice and relaxed.',
  wave: 'Hi there! Waving hello.',
  cheer: 'Hooray! Cheering for you!',
  hello: 'Big hello with both paws!',
  jump: 'Wheee! Watch me jump!',
  dance: "Let's dance! La la la.",
  groove: 'I can feel the groove.',
  tada: 'Ta-da! Here I am!',
  think: 'Hmm, let me think about it.',
  shy: "Oh... you're making me blush.",
  hug: 'Come here, cozy cuddle.',
  lean: 'Ahh, cozy. Leaning back.',
}

export const EXPRESSION_LINES = {
  happy: "I'm so happy today!",
  proud: "I did it, and I'm proud!",
  wink: 'Wink wink, just between us.',
  excited: 'Wow, wow, wow! So exciting!',
  laugh: "Ha ha ha, that's so funny!",
  surprised: "Oh! I didn't see that coming!",
  silly: 'Bleh! Feeling silly.',
  cool: 'Too cool for school.',
  love: 'I love this! Hearts everywhere.',
  sleepy: 'So sleepy... zzz.',
  sad: "Aww, I'm feeling a little sad.",
  grumpy: "Hmph. I'm a bit grumpy.",
}

export const ITEM_LINES = {
  open: 'Hi! Tap an item and I will try it on.',
  wear: {
    hair: 'Fresh style! {name} looks great on me.',
    hats: 'Ooh, a {name}! How do I look?',
    clothes: '{name}! So comfy.',
    pants: '{name}, ready to move!',
    shoes: '{name}, ready to run!',
  },
  remove: 'No {slot} today. Plain and fluffy!',
  // Used when we know how far along the patient is.
  locked: "I can't wear {name} yet. Earn the {badge} badge! {have} of {need} done.",
  // Used when progress numbers are not available for that item.
  lockedNoProgress: "I can't wear {name} yet. Earn the {badge} badge!",
  lockedGoal: "I can't wear {name} yet. Next goal: {badge}.",
  takeOff: 'Back to plain old me!',
  removeStyle: 'Back to my usual self.',
  play: "Let's play! Ready when you are.",
}

const SLOT_WORD = { hair: 'hair', hats: 'hat', clothes: 'clothes', pants: 'pants', shoes: 'shoes' }

function clip(value) {
  const s = String(value ?? '').trim()
  return s.length > MAX_NAME ? `${s.slice(0, MAX_NAME - 1).trimEnd()}…` : s
}

function fill(template, vars) {
  return template.replace(/\{(\w+)\}/g, (_, k) => (vars[k] === undefined ? '' : String(vars[k])))
}

// Returns { text, kind } for an event, or null when there is nothing to say.
//   paoSay('open')
//   paoSay('wear', { slot: 'hats', name: 'Witch Hat' })
//   paoSay('remove', { slot: 'hats' })
//   paoSay('locked', { name, badge, have, need })
//   paoSay('pose', { key })  paoSay('expression', { key })
//   paoSay('takeOff') paoSay('removeStyle') paoSay('play')
export function paoSay(event, p = {}) {
  switch (event) {
    case 'open': return { text: ITEM_LINES.open, kind: 'say' }
    case 'wear': {
      const t = ITEM_LINES.wear[p.slot]
      return t ? { text: fill(t, { name: clip(p.name) }), kind: 'say' } : null
    }
    case 'remove':
      return { text: fill(ITEM_LINES.remove, { slot: SLOT_WORD[p.slot] || 'item' }), kind: 'say' }
    case 'locked': {
      const hasProgress = Number.isFinite(p.have) && Number.isFinite(p.need)
      const template = p.badge
        ? (hasProgress ? ITEM_LINES.locked : ITEM_LINES.lockedNoProgress)
        : p.goal ? ITEM_LINES.lockedGoal : ITEM_LINES.lockedNoProgress
      return {
        text: fill(template, { name: clip(p.name), badge: clip(p.badge || p.goal || 'right'), have: p.have, need: p.need }),
        kind: 'locked',
      }
    }
    case 'pose': {
      const t = POSE_LINES[p.key]
      return t ? { text: t, kind: 'say' } : null
    }
    case 'expression': {
      const t = EXPRESSION_LINES[p.key]
      return t ? { text: t, kind: 'say' } : null
    }
    case 'takeOff': return { text: ITEM_LINES.takeOff, kind: 'say' }
    case 'removeStyle': return { text: ITEM_LINES.removeStyle, kind: 'say' }
    case 'play': return { text: ITEM_LINES.play, kind: 'say' }
    default: return null
  }
}
