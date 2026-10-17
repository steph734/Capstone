// Lists every file in public/games/<folder>/ so the loading modal can preload a game's assets without a
// hand-written manifest. Writes src/games/shared/assetIndex.json = { "<folder>": ["/games/<folder>/file.svg", ...] }.
// Runs automatically before `npm run dev` and `npm run build` (see package.json).
import { readdirSync, statSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const gamesDir = join(root, 'public', 'games')
const out = join(root, 'src', 'games', 'shared', 'assetIndex.json')
const KINDS = /\.(png|jpe?g|webp|svg|gif|mp3|wav|ogg|m4a)$/i

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name)
    return statSync(p).isDirectory() ? walk(p) : [p]
  })
}

const index = {}
try {
  for (const folder of readdirSync(gamesDir)) {
    const dir = join(gamesDir, folder)
    if (!statSync(dir).isDirectory()) continue
    index[folder] = walk(dir).filter((f) => KINDS.test(f)).map((f) => '/games/' + relative(gamesDir, f).split('\\').join('/')).sort()
  }
} catch { /* no public/games yet */ }

mkdirSync(dirname(out), { recursive: true })
writeFileSync(out, JSON.stringify(index, null, 2) + '\n')
console.log(`asset index: ${Object.keys(index).length} game folders`)
