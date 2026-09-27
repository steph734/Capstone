// Display-only catalog for the "Unlocks item for Pao" picker on the admin
// Badges page — names/ids/emoji mirror the real wardrobe items a patient
// actually sees in src/pages/games/PaoCustomizePage.jsx (CATEGORIES), so an
// admin's choice here reads as the same item a patient would recognize.
// This is one-way: picking an item here does not (yet) write anything back
// to PaoCustomizePage's own localStorage-based unlock list — wiring an
// admin-defined badge to actually grant that item is a separate, larger
// feature (shared badge storage + a patient-side check) beyond this page.
export const PAO_ITEMS = [
  { id: 'party_hat',     name: 'Party Hat',              category: 'Hair',    emoji: '🎉' },
  { id: 'flower_crown',  name: 'Flower Crown',           category: 'Hair',    emoji: '🌸' },
  { id: 'wizard_hat',    name: 'Wizard Hat',             category: 'Hair',    emoji: '🧙' },
  { id: 'backwards_cap', name: 'Backwards Cap',          category: 'Hair',    emoji: '🧢' },
  { id: 'bunny_ears',    name: 'Bunny Ears',             category: 'Hair',    emoji: '🐰' },
  { id: 'thinking_cap',  name: 'Thinking Cap',           category: 'Hair',    emoji: '🎓' },
  { id: 'rainbow_tee',   name: 'Rainbow Tee',            category: 'Clothes', emoji: '🌈' },
  { id: 'astronaut',     name: 'Astronaut Suit',         category: 'Clothes', emoji: '👨‍🚀' },
  { id: 'hero_tee',      name: 'Superhero Cape',         category: 'Clothes', emoji: '🦸' },
  { id: 'cozy_hoodie',   name: 'Cozy Hoodie',            category: 'Clothes', emoji: '🧥' },
  { id: 'overalls',      name: 'Star Overalls',          category: 'Clothes', emoji: '⭐' },
  { id: 'echo_scarf',    name: 'Echo Scarf',             category: 'Clothes', emoji: '🧣' },
  { id: 'puzzle_vest',   name: 'Patchwork Puzzle Vest',  category: 'Clothes', emoji: '🧩' },
  { id: 'polka_dots',    name: 'Polka Dot Leggings',     category: 'Pants',   emoji: '🟣' },
  { id: 'cargo',         name: 'Cargo Shorts',           category: 'Pants',   emoji: '🩳' },
  { id: 'pajamas',       name: 'Pajama Pants',           category: 'Pants',   emoji: '😴' },
  { id: 'overalls_b',    name: 'Denim Overalls',         category: 'Pants',   emoji: '👖' },
  { id: 'rockets',       name: 'Rocket Sneakers',        category: 'Shoes',   emoji: '🚀' },
  { id: 'rain_boots',    name: 'Rain Boots',             category: 'Shoes',   emoji: '🟡' },
  { id: 'ballet',        name: 'Ballet Flats',           category: 'Shoes',   emoji: '🩰' },
  { id: 'hightops',      name: 'High-Top Stars',         category: 'Shoes',   emoji: '👟' },
]

export const PAO_ITEM_CATEGORIES = ['Hair', 'Clothes', 'Pants', 'Shoes']
