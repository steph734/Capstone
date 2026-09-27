// Seed catalog for the admin "Clothes" tab (Badges page) and the "Unlocks
// item for Pao" picker in the badge builder. Each item is described by the
// same fields the clothing builder edits — style silhouette, main/trim
// colour, pattern (+ pattern colour), and an optional sticker — matching
// STYLE_OPTIONS/COLOURS/PATTERNS/STICKERS in clothingBuilderData.jsx.
// This is one-way and local-only: editing this list here does not (yet)
// write anything back to PaoCustomizePage's own localStorage-based unlock
// list — wiring an admin-managed catalog to actually grant items on the
// patient side is a separate, larger feature (shared storage + a
// patient-side check) beyond this page.
export const PAO_ITEMS = [
  { id: 'party_hat', name: 'Party Hat', category: 'Hair', style: 'tophat', mainColour: 'yellow', trimColour: 'red', pattern: 'stars', patternColour: 'white', sticker: 'star' },
  { id: 'flower_crown', name: 'Flower Crown', category: 'Hair', style: 'crown', mainColour: 'pink', trimColour: 'green', pattern: 'solid', patternColour: 'pink', sticker: 'flower' },
  { id: 'wizard_hat', name: 'Wizard Hat', category: 'Hair', style: 'tophat', mainColour: 'purple', trimColour: 'yellow', pattern: 'stars', patternColour: 'white', sticker: 'moon' },
  { id: 'backwards_cap', name: 'Backwards Cap', category: 'Hair', style: 'cap', mainColour: 'blue', trimColour: 'white', pattern: 'solid', patternColour: 'blue', sticker: 'none' },
  { id: 'bunny_ears', name: 'Bunny Ears', category: 'Hair', style: 'headband', mainColour: 'white', trimColour: 'pink', pattern: 'solid', patternColour: 'white', sticker: 'none' },
  { id: 'thinking_cap', name: 'Thinking Cap', category: 'Hair', style: 'cap', mainColour: 'black', trimColour: 'green', pattern: 'solid', patternColour: 'black', sticker: 'none' },
  { id: 'rainbow_tee', name: 'Rainbow Tee', category: 'Clothes', style: 'tee', mainColour: 'white', trimColour: 'rose', pattern: 'stripes', patternColour: 'blue', sticker: 'rainbow' },
  { id: 'astronaut', name: 'Astronaut Suit', category: 'Clothes', style: 'jacket', mainColour: 'gray', trimColour: 'blue', pattern: 'solid', patternColour: 'gray', sticker: 'star' },
  { id: 'hero_tee', name: 'Superhero Cape', category: 'Clothes', style: 'tee', mainColour: 'red', trimColour: 'yellow', pattern: 'solid', patternColour: 'red', sticker: 'bolt' },
  { id: 'cozy_hoodie', name: 'Cozy Hoodie', category: 'Clothes', style: 'hoodie', mainColour: 'purple', trimColour: 'white', pattern: 'solid', patternColour: 'purple', sticker: 'paw' },
  { id: 'overalls', name: 'Star Overalls', category: 'Clothes', style: 'overalls', mainColour: 'blue', trimColour: 'yellow', pattern: 'stars', patternColour: 'yellow', sticker: 'star' },
  { id: 'echo_scarf', name: 'Echo Scarf', category: 'Clothes', style: 'vest', mainColour: 'teal', trimColour: 'white', pattern: 'solid', patternColour: 'teal', sticker: 'music' },
  { id: 'puzzle_vest', name: 'Patchwork Puzzle Vest', category: 'Clothes', style: 'vest', mainColour: 'orange', trimColour: 'brown', pattern: 'checks', patternColour: 'brown', sticker: 'none' },
  { id: 'polka_dots', name: 'Polka Dot Leggings', category: 'Pants', style: 'leggings', mainColour: 'purple', trimColour: 'pink', pattern: 'dots', patternColour: 'yellow', sticker: 'none' },
  { id: 'cargo', name: 'Cargo Shorts', category: 'Pants', style: 'shorts', mainColour: 'green', trimColour: 'brown', pattern: 'solid', patternColour: 'green', sticker: 'none' },
  { id: 'pajamas', name: 'Pajama Pants', category: 'Pants', style: 'leggings', mainColour: 'sky', trimColour: 'white', pattern: 'stars', patternColour: 'white', sticker: 'moon' },
  { id: 'overalls_b', name: 'Denim Overalls', category: 'Pants', style: 'overalls', mainColour: 'blue', trimColour: 'yellow', pattern: 'solid', patternColour: 'blue', sticker: 'none' },
  { id: 'rockets', name: 'Rocket Sneakers', category: 'Shoes', style: 'sneakers', mainColour: 'white', trimColour: 'red', pattern: 'stars', patternColour: 'yellow', sticker: 'star' },
  { id: 'rain_boots', name: 'Rain Boots', category: 'Shoes', style: 'boots', mainColour: 'yellow', trimColour: 'white', pattern: 'solid', patternColour: 'yellow', sticker: 'none' },
  { id: 'ballet', name: 'Ballet Flats', category: 'Shoes', style: 'flats', mainColour: 'pink', trimColour: 'rose', pattern: 'solid', patternColour: 'pink', sticker: 'heart' },
  { id: 'hightops', name: 'High-Top Stars', category: 'Shoes', style: 'sneakers', mainColour: 'black', trimColour: 'white', pattern: 'stars', patternColour: 'yellow', sticker: 'star' },
]

export const PAO_ITEM_CATEGORIES = ['Hair', 'Clothes', 'Pants', 'Shoes']
