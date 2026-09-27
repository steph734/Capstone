import { getMongo } from '../mongo.js'
import { PaoTheme } from '../models/paoTheme.js'
import { serializePaoTheme } from '../serializePaoTheme.js'

// Theme metadata (palette/stickers/icon) — mirrors src/data/paoThemes.js,
// seeded into pao_themes the first time the collection is empty. The
// ready-made "look" for each slot stays defined client-side (it's just a
// design object, not something patients see directly); this collection
// only needs to track which pao_items/pao_hair codes ended up in each
// theme's one-click set once an admin adds them.
const THEMES = [
  { code: 'halloween', name: 'Halloween', icon: '🎃', background_color: '#fff7ed', colors: ['#f97316', '#1f2937', '#7c3aed', '#84cc16', '#fef3c7'], stickers: ['🎃', '👻', '🦇', '🕸️', '🍬', '🌙', '🧙'] },
  { code: 'christmas', name: 'Christmas', icon: '🎄', background_color: '#f0fdf4', colors: ['#dc2626', '#16a34a', '#ffffff', '#fbbf24', '#14532d'], stickers: ['🎄', '🎅', '⛄', '🎁', '❄️', '🔔', '🦌', '⭐'] },
  { code: 'valentines', name: "Valentine's", icon: '💝', background_color: '#fdf2f8', colors: ['#ec4899', '#ef4444', '#f9a8d4', '#ffffff', '#be123c'], stickers: ['❤️', '💖', '💌', '🌹', '🧸', '🍫', '💘'] },
  { code: 'easter', name: 'Easter', icon: '🐣', background_color: '#fefce8', colors: ['#f9a8d4', '#fde68a', '#a7f3d0', '#c4b5fd', '#bae6fd'], stickers: ['🐣', '🐰', '🥚', '🌷', '🦋', '🌼', '🥕'] },
  { code: 'summer', name: 'Summer', icon: '☀️', background_color: '#ecfeff', colors: ['#22d3ee', '#fbbf24', '#f97316', '#84cc16', '#ffffff'], stickers: ['☀️', '🌴', '🍉', '🐚', '🌊', '🍦', '🕶️'] },
  { code: 'birthday', name: 'Birthday', icon: '🎂', background_color: '#faf5ff', colors: ['#ec4899', '#3b82f6', '#fbbf24', '#22c55e', '#8b5cf6'], stickers: ['🎂', '🎈', '🎉', '🎁', '🧁', '🍭', '⭐'] },
  { code: 'lunar_new_year', name: 'Lunar New Year', icon: '🧧', background_color: '#fef2f2', colors: ['#dc2626', '#fbbf24', '#b91c1c', '#1f2937', '#fef3c7'], stickers: ['🧧', '🏮', '🐉', '🍊', '🎆', '🌸'] },
]

// GET /api/pao-themes/list -> the 7 seasonal themes and, once an admin has
// added a theme set, which pao_items/pao_hair codes make it up.
export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    await getMongo()

    if ((await PaoTheme.estimatedDocumentCount()) === 0) {
      await PaoTheme.insertMany(
        THEMES.map((t, i) => ({ ...t, set_items: null, is_active: true, sort_order: i })),
        { ordered: false },
      ).catch(() => { /* another warm container seeded it first — fine */ })
    }

    const themes = await PaoTheme.find({}).sort({ sort_order: 1, created_at: 1 }).lean()
    return res.status(200).json({ themes: themes.map(serializePaoTheme) })
  } catch (err) {
    console.error('pao-themes/list error:', err)
    return res.status(500).json({ error: err.message || 'Could not load themes.' })
  }
}
