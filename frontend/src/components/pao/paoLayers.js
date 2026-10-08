// Loads public/pao/pao-layers/manifest.json once and looks up which overlay
// files to stack for a given set of equipped items. See PaoLayered.jsx.
const LAYERS_ROOT = '/pao/pao-layers'
const MANIFEST_URL = `${LAYERS_ROOT}/manifest.json`

export const BASE_BOTTOM = { file: 'base-bottom.svg', z: 1 }
export const BASE_TOP = { file: 'base-top.svg', z: 4 }
export const HAIR_Z = 7 // reserved: no hair overlay art exists yet (see PaoLayered)

// ─── Reaction poses (PROMPT-pao-reactions.md) ────────────────────────────────
// A pose REPLACES base-top.svg (z=4): same arms+face slot, so hat/clothes/
// pants/shoes never move. Its matching fx- file (if any) sits on top at z=7.
const POSES_URL = `${LAYERS_ROOT}/poses.json`
let posesPromise = null
export function loadPosesManifest() {
  if (!posesPromise) posesPromise = fetch(POSES_URL).then((r) => (r.ok ? r.json() : null)).catch(() => null)
  return posesPromise
}

export const BUBBLE_FOR_POSE = {
  idle: '', happy: 'Yippee!', wow: 'Wow, look at me!', wave: 'Hi friend! Do you like it?',
  hips: 'Ta-da! How do I look?', flex: 'I feel super strong!', love: "It's so pretty!",
  wink: 'Looking good!', giggle: 'Hee hee hee!', shy: 'Aww, so cozy!', proud: 'I feel so proud!',
  cheer: 'Yay! I love it!', dance: "Let's dance!", sleepy: 'Ready for bedtime stories.',
}

// Poses with real motion/energy — swapped for `happy` (and their fx hidden)
// under calm_visuals / prefers-reduced-motion. Every equip stays a
// celebration either way; this never falls back to idle.
export const ENERGETIC_POSES = new Set(['cheer', 'dance', 'flex', 'wow'])
export function calmSafePose(pose) {
  return ENERGETIC_POSES.has(pose) ? 'happy' : pose
}

// Which pose plays for a given equipped (or unequipped) item.
export function reactionPoseFor(posesManifest, category, itemKey, { isUnequip = false, lastPose = null } = {}) {
  if (isUnequip) return 'happy'
  const mapped = posesManifest?.item_reaction?.[category]?.[itemKey]
  if (mapped) return mapped
  const pool = posesManifest?.random_pool_for_any_equip || ['happy']
  const choices = pool.length > 1 ? pool.filter((p) => p !== lastPose) : pool
  return choices[Math.floor(Math.random() * choices.length)] || pool[0]
}

export function poseFile(pose) {
  return `poses/pose-${pose}.svg`
}
export function fxFile(pose) {
  return `fx/fx-${pose}.svg`
}

export const LAYER_CATEGORIES = ['hats', 'clothes', 'pants', 'shoes']

// "Orange Bowtie" -> "orange-bowtie" — matches manifest.json's item_key
// convention without needing a stored asset_key field.
export function slugifyItemName(name) {
  return String(name || '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
}

// The one name that doesn't slugify to its manifest item_key as-is.
const ITEM_KEY_OVERRIDES = { 'patchwork-puzzle-vest': 'patchwork-vest' }

// Same as slugifyItemName, but corrected for names that don't match their
// manifest item_key 1:1 — use this (not slugifyItemName directly) to look
// up layer art.
export function resolveItemKey(name) {
  const slug = slugifyItemName(name)
  return ITEM_KEY_OVERRIDES[slug] || slug
}

let manifestPromise = null
export function loadLayerManifest() {
  if (!manifestPromise) {
    manifestPromise = fetch(MANIFEST_URL).then((r) => (r.ok ? r.json() : null)).catch(() => null)
  }
  return manifestPromise
}

// equipped: { hats, clothes, pants, shoes } of item_key strings (or null).
// pose (optional): 'idle' or any PROMPT-pao-reactions.md pose — replaces the
// plain base-top with that pose's arms+face, plus its fx overlay at z=7.
// Returns [{ file, z }] sorted low to high, including the two base layers.
export function resolveLayerStack(manifest, equipped, pose = 'idle', { includeFx = true } = {}) {
  const stack = [{ ...BASE_BOTTOM }]
  stack.push(pose && pose !== 'idle' ? { file: poseFile(pose), z: BASE_TOP.z } : { ...BASE_TOP })
  if (pose && pose !== 'idle' && includeFx) stack.push({ file: fxFile(pose), z: 7 })
  if (!manifest?.layers) return stack.sort((a, b) => a.z - b.z)
  for (const category of LAYER_CATEGORIES) {
    const key = equipped?.[category]
    if (!key) continue
    for (const layer of manifest.layers) {
      if (layer.category === category && layer.item_key === key) {
        stack.push({ file: layer.file, z: layer.z })
      }
    }
  }
  return stack.sort((a, b) => a.z - b.z)
}

export function layerUrl(file) {
  return `${LAYERS_ROOT}/${file}`
}

// Every file a given equipped set might need, for preloading when the
// modal opens (so switching items never flickers).
export function allLayerFiles(manifest) {
  if (!manifest?.layers) return [BASE_BOTTOM.file, BASE_TOP.file]
  return [BASE_BOTTOM.file, BASE_TOP.file, ...manifest.layers.map((l) => l.file)]
}

// Every pose + fx file, for preloading once poses.json has loaded.
export function allPoseFiles(posesManifest) {
  const poses = posesManifest?.poses || []
  const fx = posesManifest?.fx || []
  return [...poses.map(poseFile), ...fx.map(fxFile)]
}
