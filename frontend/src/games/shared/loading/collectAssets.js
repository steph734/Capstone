import assetIndex from '../assetIndex.json'

const IMAGE = /\.(png|jpe?g|webp|svg|gif)(\?.*)?$/i
const SOUND = /\.(mp3|wav|ogg|m4a)(\?.*)?$/i

// Every string in a data object that looks like an image or sound URL.
export function urlsInJson(value, found = new Set()) {
  if (typeof value === 'string') { if (IMAGE.test(value) || SOUND.test(value)) found.add(value) }
  else if (Array.isArray(value)) value.forEach((v) => urlsInJson(v, found))
  else if (value && typeof value === 'object') Object.values(value).forEach((v) => urlsInJson(v, found))
  return found
}

const split = (urls) => ({
  images: urls.filter((u) => IMAGE.test(u) && !/pao/i.test(u.split('/').pop())),
  sounds: urls.filter((u) => SOUND.test(u)),
  pao: urls.filter((u) => IMAGE.test(u) && /pao/i.test(u.split('/').pop())),
})

// What to preload for one game. A manifest in the registry wins; otherwise this collects
//   a) the files in public/games/<assetDir>/ (from the build-time asset index), plus
//   b) every image / sound URL found in the game's data (builder games and database definitions).
export function collectAssets(entry, definition) {
  const manifest = entry.manifest?.() || null
  const fromIndex = assetIndex[entry.assetDir || entry.slug] || []
  const fromData = definition ? [...urlsInJson(definition)] : []
  const auto = split([...new Set([...fromIndex, ...fromData])])
  if (!manifest) return auto
  const merge = (a = [], b = []) => [...new Set([...a, ...b])]
  return { images: merge(manifest.images, auto.images), sounds: merge(manifest.sounds, auto.sounds), pao: merge(manifest.pao, auto.pao) }
}
