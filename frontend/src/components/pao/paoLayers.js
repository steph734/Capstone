// Loads public/pao/pao-layers/manifest.json once and looks up which overlay
// files to stack for a given set of equipped items. See PaoLayered.jsx.
const LAYERS_ROOT = '/pao/pao-layers'
const MANIFEST_URL = `${LAYERS_ROOT}/manifest.json`

export const BASE_BOTTOM = { file: 'base-bottom.svg', z: 1 }
export const BASE_TOP = { file: 'base-top.svg', z: 4 }
export const HAIR_Z = 7 // reserved: no hair overlay art exists yet (see PaoLayered)

export const LAYER_CATEGORIES = ['hats', 'clothes', 'pants', 'shoes']

// "Orange Bowtie" -> "orange-bowtie" — matches manifest.json's item_key
// convention without needing a stored asset_key field.
export function slugifyItemName(name) {
  return String(name || '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
}

let manifestPromise = null
export function loadLayerManifest() {
  if (!manifestPromise) {
    manifestPromise = fetch(MANIFEST_URL).then((r) => (r.ok ? r.json() : null)).catch(() => null)
  }
  return manifestPromise
}

// equipped: { hats, clothes, pants, shoes } of item_key strings (or null).
// Returns [{ file, z }] sorted low to high, including the two base layers.
export function resolveLayerStack(manifest, equipped) {
  const stack = [{ ...BASE_BOTTOM }, { ...BASE_TOP }]
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
