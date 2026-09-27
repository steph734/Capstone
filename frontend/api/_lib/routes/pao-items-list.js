import { getMongo } from '../mongo.js'
import { PaoItem } from '../models/paoItem.js'
import { serializePaoItem } from '../serializePaoItem.js'

// The original hand-drawn wardrobe (OUTFIT_MAP in PaoOutfits.jsx) — seeded
// into the `clothes` collection the first time it's empty, same idea as a
// migration's initial data. is_builtin items keep design: null forever
// unless an admin explicitly redesigns them.
const BUILT_INS = [
  { code: 'party_hat', name: 'Party Hat', category: 'hats', emoji: '🎉', description: 'Cone hat with pompom — celebrate your first win!' },
  { code: 'flower_crown', name: 'Flower Crown', category: 'hats', emoji: '🌸', description: 'Soft daisy chain crown, cute & gender-neutral' },
  { code: 'wizard_hat', name: 'Wizard Hat', category: 'hats', emoji: '🧙', description: 'Starry wizard hat — perfect for the Word Wizard!' },
  { code: 'backwards_cap', name: 'Backwards Cap', category: 'hats', emoji: '🧢', description: 'Casual & playful, a mid-tier look' },
  { code: 'bunny_ears', name: 'Bunny Ears', category: 'hats', emoji: '🐰', description: 'Soft rounded bunny ears headband' },
  { code: 'thinking_cap', name: 'Thinking Cap', category: 'hats', emoji: '🎓', description: 'Graduation cap with a green tassel — for great problem solvers!' },
  { code: 'rainbow_tee', name: 'Rainbow Tee', category: 'clothes', emoji: '🌈', description: 'Simple tee with a rainbow stripe across the chest' },
  { code: 'astronaut', name: 'Astronaut Suit', category: 'clothes', emoji: '👨‍🚀', description: 'Puffy white suit with round belly window' },
  { code: 'hero_tee', name: 'Superhero Cape', category: 'clothes', emoji: '🦸', description: 'Logo on chest + tiny cape flutter!' },
  { code: 'cozy_hoodie', name: 'Cozy Hoodie', category: 'clothes', emoji: '🧥', description: 'Hoodie with panda ears sewn on top & paw-print pocket' },
  { code: 'overalls', name: 'Star Overalls', category: 'clothes', emoji: '⭐', description: 'Denim overalls with one big star patch on the pocket' },
  { code: 'echo_scarf', name: 'Echo Scarf', category: 'clothes', emoji: '🧣', description: 'Soft scarf stitched with little sound-wave patterns' },
  { code: 'puzzle_vest', name: 'Patchwork Puzzle Vest', category: 'clothes', emoji: '🧩', description: 'Vest stitched from colorful puzzle-piece patches' },
  { code: 'polka_dots', name: 'Polka Dot Leggings', category: 'pants', emoji: '🟣', description: 'Colorful dots all over — fun & easy to spot!' },
  { code: 'cargo', name: 'Cargo Shorts', category: 'pants', emoji: '🩳', description: 'Adventurer look, matches Explorer badge' },
  { code: 'pajamas', name: 'Pajama Pants', category: 'pants', emoji: '😴', description: 'Cozy striped sleepwear for bedtime stories' },
  { code: 'overalls_b', name: 'Denim Overalls', category: 'pants', emoji: '👖', description: 'Pairs as a matching set with Star Overalls top' },
  { code: 'rockets', name: 'Rocket Sneakers', category: 'shoes', emoji: '🚀', description: 'Sneakers with little flame & star trail graphic' },
  { code: 'rain_boots', name: 'Rain Boots', category: 'shoes', emoji: '🟡', description: 'Bright yellow boots — fun rounded shape' },
  { code: 'ballet', name: 'Ballet Flats', category: 'shoes', emoji: '🩰', description: 'Soft ballet flats with a little bow' },
  { code: 'hightops', name: 'High-Top Stars', category: 'shoes', emoji: '👟', description: 'High-tops covered in star motifs' },
]

// GET /api/pao-items/list -> Pao's hats/clothes/pants/shoes wardrobe.
export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    await getMongo()

    if ((await PaoItem.estimatedDocumentCount()) === 0) {
      await PaoItem.insertMany(
        BUILT_INS.map((item, i) => ({ ...item, is_builtin: true, design: null, is_active: true, sort_order: i })),
        { ordered: false },
      ).catch(() => { /* another warm container seeded it first — fine */ })
    }

    const items = await PaoItem.find({}).sort({ sort_order: 1, created_at: 1 }).lean()
    return res.status(200).json({ items: items.map(serializePaoItem) })
  } catch (err) {
    console.error('pao-items/list error:', err)
    return res.status(500).json({ error: err.message || "Could not load Pao's wardrobe." })
  }
}
