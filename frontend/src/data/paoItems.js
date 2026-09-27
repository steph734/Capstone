// Seed catalog for the admin "Clothes" tab (Badges page) and the "Unlocks
// item for Pao" picker in the badge builder — names/ids/emoji/description
// mirror the real wardrobe items a patient actually sees in
// src/pages/games/PaoCustomizePage.jsx (CATEGORIES), so an admin's choice
// here reads as the same item a patient would recognize. Each id also
// matches an entry in PaoOutfits.jsx's OUTFIT_MAP, so these seeded items
// render with Pao's original hand-drawn art (WardrobeItemThumb falls back
// to OutfitThumbnail when an item has no `design` object of its own).
// This is one-way and local-only: editing this list here does not (yet)
// write anything back to PaoCustomizePage's own localStorage-based unlock
// list — wiring an admin-managed catalog to actually grant items on the
// patient side is a separate, larger feature (shared storage + a
// patient-side check) beyond this page.
// The 6 items below are hats, not hairstyles — they keep category 'Hats'
// here, but the patient-facing PaoCustomizePage.jsx still wears them in
// its "hair" slot, and their hand-drawn art lives at OUTFIT_MAP.hair.
export const PAO_ITEMS = [
  { id: 'party_hat',     name: 'Party Hat',              category: 'Hats',    emoji: '🎉', description: 'Cone hat with pompom — celebrate your first win!' },
  { id: 'flower_crown',  name: 'Flower Crown',           category: 'Hats',    emoji: '🌸', description: 'Soft daisy chain crown, cute & gender-neutral' },
  { id: 'wizard_hat',    name: 'Wizard Hat',             category: 'Hats',    emoji: '🧙', description: 'Starry wizard hat — perfect for the Word Wizard!' },
  { id: 'backwards_cap', name: 'Backwards Cap',          category: 'Hats',    emoji: '🧢', description: 'Casual & playful, a mid-tier look' },
  { id: 'bunny_ears',    name: 'Bunny Ears',             category: 'Hats',    emoji: '🐰', description: 'Soft rounded bunny ears headband' },
  { id: 'thinking_cap',  name: 'Thinking Cap',           category: 'Hats',    emoji: '🎓', description: 'Graduation cap with a green tassel — for great problem solvers!' },
  { id: 'rainbow_tee',   name: 'Rainbow Tee',            category: 'Clothes', emoji: '🌈', description: 'Simple tee with a rainbow stripe across the chest' },
  { id: 'astronaut',     name: 'Astronaut Suit',         category: 'Clothes', emoji: '👨‍🚀', description: 'Puffy white suit with round belly window' },
  { id: 'hero_tee',      name: 'Superhero Cape',         category: 'Clothes', emoji: '🦸', description: 'Logo on chest + tiny cape flutter!' },
  { id: 'cozy_hoodie',   name: 'Cozy Hoodie',            category: 'Clothes', emoji: '🧥', description: 'Hoodie with panda ears sewn on top & paw-print pocket' },
  { id: 'overalls',      name: 'Star Overalls',          category: 'Clothes', emoji: '⭐', description: 'Denim overalls with one big star patch on the pocket' },
  { id: 'echo_scarf',    name: 'Echo Scarf',             category: 'Clothes', emoji: '🧣', description: 'Soft scarf stitched with little sound-wave patterns' },
  { id: 'puzzle_vest',   name: 'Patchwork Puzzle Vest',  category: 'Clothes', emoji: '🧩', description: 'Vest stitched from colorful puzzle-piece patches' },
  { id: 'polka_dots',    name: 'Polka Dot Leggings',     category: 'Pants',   emoji: '🟣', description: 'Colorful dots all over — fun & easy to spot!' },
  { id: 'cargo',         name: 'Cargo Shorts',           category: 'Pants',   emoji: '🩳', description: 'Adventurer look, matches Explorer badge' },
  { id: 'pajamas',       name: 'Pajama Pants',           category: 'Pants',   emoji: '😴', description: 'Cozy striped sleepwear for bedtime stories' },
  { id: 'overalls_b',    name: 'Denim Overalls',         category: 'Pants',   emoji: '👖', description: 'Pairs as a matching set with Star Overalls top' },
  { id: 'rockets',       name: 'Rocket Sneakers',        category: 'Shoes',   emoji: '🚀', description: 'Sneakers with little flame & star trail graphic' },
  { id: 'rain_boots',    name: 'Rain Boots',             category: 'Shoes',   emoji: '🟡', description: 'Bright yellow boots — fun rounded shape' },
  { id: 'ballet',        name: 'Ballet Flats',           category: 'Shoes',   emoji: '🩰', description: 'Soft ballet flats with a little bow' },
  { id: 'hightops',      name: 'High-Top Stars',         category: 'Shoes',   emoji: '👟', description: 'High-tops covered in star motifs' },
]

export const PAO_ITEM_CATEGORIES = ['Hair', 'Hats', 'Clothes', 'Pants', 'Shoes']
