import { useCallback, useEffect, useRef, useState } from 'react'
import { collectAssets } from './collectAssets'

// Games already loaded this session finish instantly.
const loaded = new Set()
export const isGameLoaded = (slug) => loaded.has(slug)

const FILE_TIMEOUT = 10000
const SLOW_AFTER = 8000
const PARALLEL = 6

const withTimeout = (p, ms) => new Promise((resolve, reject) => {
  const t = setTimeout(() => reject(new Error('timeout')), ms)
  p.then((v) => { clearTimeout(t); resolve(v) }, (e) => { clearTimeout(t); reject(e) })
})

const loadImage = (url) => new Promise((resolve, reject) => {
  const img = new Image()
  img.onload = () => resolve()
  img.onerror = () => reject(new Error('image failed'))
  img.src = url
})

const loadSound = async (url) => {
  const res = await fetch(url)
  if (!res.ok) throw new Error('sound failed')
  await res.arrayBuffer()
}

// 10s per file, one retry, then skip with a warning. One missing file never blocks a game.
async function loadFile(kind, url) {
  const run = () => withTimeout(kind === 'sounds' ? loadSound(url) : loadImage(url), FILE_TIMEOUT)
  try { await run() } catch {
    try { await run() } catch (e) { console.warn(`Game loading: skipped ${url} (${e.message})`) }
  }
}

async function pool(tasks, limit) {
  let next = 0
  await Promise.all(Array.from({ length: Math.min(limit, tasks.length) }, async () => {
    while (next < tasks.length) { const task = tasks[next]; next += 1; await task() }
  }))
}

// Loads a game's JS chunk, its database definition (builder games) and its pictures, sounds and Pao art.
// Returns { progress 0-100 (only goes up), status: loading | ready | slow | error, groups, retry }.
export default function useGameAssets(entry, enabled = true) {
  const [state, setState] = useState({ progress: 0, status: 'loading', groups: { pictures: false, sounds: false, pao: false } })
  const [attempt, setAttempt] = useState(0)
  const best = useRef(0)

  const retry = useCallback(() => { best.current = 0; setState({ progress: 0, status: 'loading', groups: { pictures: false, sounds: false, pao: false } }); setAttempt((n) => n + 1) }, [])

  useEffect(() => {
    if (!enabled || !entry) return undefined
    if (loaded.has(entry.slug)) { setState({ progress: 100, status: 'ready', groups: { pictures: true, sounds: true, pao: true } }); return undefined }
    let alive = true
    let finished = false
    const push = (patch) => { if (alive) setState((s) => ({ ...s, ...patch, progress: Math.max(s.progress, patch.progress ?? s.progress) })) }
    const slowTimer = setTimeout(() => { if (alive && !finished) setState((s) => (s.status === 'loading' ? { ...s, status: 'slow' } : s)) }, SLOW_AFTER)
    if (navigator.onLine === false) setState((s) => ({ ...s, status: 'slow' }))

    ;(async () => {
      const hasDef = Boolean(entry.definitionUrl)
      const base = hasDef ? 15 : 0
      const groups = { pictures: false, sounds: false, pao: false }
      let definition = null

      if (hasDef) {
        try {
          const res = await withTimeout(fetch(entry.definitionUrl), FILE_TIMEOUT)
          if (res.ok) definition = await res.json()
        } catch (e) { console.warn(`Game loading: could not fetch the game definition (${e.message})`) }
        push({ progress: base })
      }

      const assets = collectAssets(entry, definition)
      const counts = { pictures: assets.images.length, sounds: assets.sounds.length, pao: assets.pao.length }
      const done = { pictures: 0, sounds: 0, pao: 0 }
      const total = counts.pictures + counts.sounds + counts.pao + 3 // the game's JS chunk counts as 3
      let finishedWeight = 0
      const bump = (w, group) => {
        finishedWeight += w
        if (group) { done[group] += 1; if (done[group] >= counts[group]) groups[group] = true }
        push({ progress: Math.min(99, base + ((100 - base) * finishedWeight) / total), groups: { ...groups } })
      }
      Object.keys(counts).forEach((g) => { if (!counts[g]) groups[g] = true })
      push({ groups: { ...groups } })

      const tasks = [
        async () => {
          try { await withTimeout(entry.load ? entry.load() : Promise.resolve(), 30000) } catch (e) {
            try { await entry.load?.() } catch (err) { throw Object.assign(err, { fatal: true }) }
            console.warn(`Game loading: chunk retry (${e.message})`)
          }
          bump(3)
        },
        ...assets.pao.map((u) => async () => { await loadFile('images', u); bump(1, 'pao') }),
        ...assets.images.map((u) => async () => { await loadFile('images', u); bump(1, 'pictures') }),
        ...assets.sounds.map((u) => async () => { await loadFile('sounds', u); bump(1, 'sounds') }),
      ]
      try { await pool(tasks, PARALLEL) } catch {
        if (alive) setState((s) => ({ ...s, status: 'error' }))
        return
      }
      if (!alive) return
      finished = true
      loaded.add(entry.slug)
      setState((s) => ({ ...s, progress: 100, status: 'ready', groups: { pictures: true, sounds: true, pao: true } }))
    })()

    return () => { alive = false; clearTimeout(slowTimer) }
  }, [entry, enabled, attempt])

  return { ...state, retry }
}
