// What the real MongoDB collections can actually store, so the designer
// never offers (and theme sets never try to save) a combination Mongo will
// reject. pao_hair's enums cover every hair style/pattern the app defines,
// so Hair has no restriction; pao_items (hats/clothes/pants/shoes) only
// allows the original 19 styles and 7 patterns — the extra seasonal hat
// styles (witch/santa/antlers/bunny/party), the cape style, and the 5 new
// patterns (snowflakes/candycane/bats/flowers/confetti) have no legal
// representation there yet.
export const SCHEMA_STYLES = {
  Hats: ['beanie', 'cap', 'tophat', 'crown', 'bow', 'headband'],
  Clothes: ['tee', 'sweater', 'hoodie', 'vest', 'scarf'],
  Pants: ['pants', 'shorts', 'skirt', 'joggers'],
  Shoes: ['sneakers', 'boots', 'slippers', 'sandals'],
}

export const SCHEMA_PATTERNS = ['solid', 'stripes', 'dots', 'stars', 'hearts', 'checks', 'zigzag']

// Hair (pao_hair) has no restriction of its own — everything the designer
// offers for that slot is legal there.
export function isSchemaLegal(category, design) {
  if (category === 'Hair') return true
  const styles = SCHEMA_STYLES[category]
  if (!styles || !styles.includes(design.style)) return false
  if (!design.pattern || design.pattern === 'solid') return true
  return SCHEMA_PATTERNS.includes(design.pattern)
}
