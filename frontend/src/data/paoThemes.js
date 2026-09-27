// Seasonal themes for Pao's wardrobe. Each theme gives the clothes
// designer a colour palette and sticker set, plus a ready-made look for
// each slot — together those make up the theme's "set", which the admin can
// add to the wardrobe in one go. Theme ids must match PAO_ITEM_THEMES in
// api/_lib/models/paoItem.js.
const look = (name, description, style, main, trim, pattern = 'solid', patternColor = '#ffffff', decal = '') => ({
  name, description, design: { style, main, trim, pattern, patternColor, decal },
})

export const PAO_THEMES = [
  {
    id: 'halloween', label: 'Halloween', icon: '🎃', bg: '#fff7ed',
    colours: ['#f97316', '#1f2937', '#7c3aed', '#84cc16', '#fef3c7'],
    decals: ['🎃', '👻', '🦇', '🕸️', '🍬', '🌙', '🧙'],
    looks: {
      Hair: look('Monster Spikes', 'Spooky green spikes for trick-or-treat', 'spiky', '#84cc16', '#7c3aed'),
      Hats: look('Witch Hat', 'Starry purple witch hat with an orange band', 'witch', '#7c3aed', '#f97316', 'stars', '#fde68a'),
      Clothes: look('Spooky Cape', 'Swishy bat cape with a pumpkin clasp', 'cape', '#1f2937', '#f97316', 'bats', '#7c3aed', '🎃'),
      Pants: look('Pumpkin Joggers', 'Pumpkin-orange joggers', 'joggers', '#f97316', '#1f2937'),
      Shoes: look('Witchy Boots', 'Black boots with purple cuffs', 'boots', '#1f2937', '#7c3aed'),
    },
  },
  {
    id: 'christmas', label: 'Christmas', icon: '🎄', bg: '#f0fdf4',
    colours: ['#dc2626', '#16a34a', '#ffffff', '#fbbf24', '#14532d'],
    decals: ['🎄', '🎅', '⛄', '🎁', '❄️', '🔔', '🦌', '⭐'],
    looks: {
      Hair: look('Holly Bun', 'A neat bun with a star clip', 'bun', '#5b3a1e', '#dc2626', 'solid', '#ffffff', 'star'),
      Hats: look('Santa Hat', 'Floppy red Santa hat with a fluffy pompom', 'santa', '#dc2626', '#ffffff'),
      Clothes: look('Holiday Sweater', 'Cosy snowflake sweater with a reindeer', 'sweater', '#16a34a', '#dc2626', 'snowflakes', '#ffffff', '🦌'),
      Pants: look('Candy Cane Pants', 'Red-and-white candy cane stripes', 'pants', '#ffffff', '#dc2626', 'candycane', '#dc2626'),
      Shoes: look('Elf Slippers', 'Fluffy red slippers with green trim', 'slippers', '#dc2626', '#16a34a'),
    },
  },
  {
    id: 'valentines', label: "Valentine's", icon: '💝', bg: '#fdf2f8',
    colours: ['#ec4899', '#ef4444', '#f9a8d4', '#ffffff', '#be123c'],
    decals: ['❤️', '💖', '💌', '🌹', '🧸', '🍫', '💘'],
    looks: {
      Hair: look('Sweetheart Pigtails', 'Pigtails with little heart ties', 'pigtails', '#5b3a1e', '#ef4444', 'solid', '#ffffff', 'heart'),
      Hats: look('Heart Headband', 'Red headband with a sparkly heart', 'headband', '#ef4444', '#f9a8d4', 'solid', '#ffffff', '💖'),
      Clothes: look('Love Tee', 'Soft pink tee covered in hearts', 'tee', '#f9a8d4', '#ef4444', 'hearts', '#ef4444'),
      Pants: look('Rosy Skirt', 'Twirly red skirt', 'skirt', '#ef4444', '#ffffff'),
      Shoes: look('Sweet Slippers', 'Pink slippers with white fluff', 'slippers', '#f9a8d4', '#ffffff'),
    },
  },
  {
    id: 'easter', label: 'Easter', icon: '🐣', bg: '#fefce8',
    colours: ['#f9a8d4', '#fde68a', '#a7f3d0', '#c4b5fd', '#bae6fd'],
    decals: ['🐣', '🐰', '🥚', '🌷', '🦋', '🌼', '🥕'],
    looks: {
      Hair: look('Tulip Bun', 'Spring bun with a flower clip', 'bun', '#c68642', '#a7f3d0', 'solid', '#ffffff', 'flower'),
      Hats: look('Bunny Ears', 'Fluffy bunny ears headband', 'bunny', '#ffffff', '#f9a8d4'),
      Clothes: look('Spring Vest', 'Pastel checked vest with a chick', 'vest', '#a7f3d0', '#f9a8d4', 'checks', '#ffffff', '🐣'),
      Pants: look('Pastel Shorts', 'Lilac shorts with yellow cuffs', 'shorts', '#c4b5fd', '#fde68a'),
      Shoes: look('Egg Sneakers', 'Speckled sneakers like a painted egg', 'sneakers', '#bae6fd', '#fde68a', 'dots', '#ffffff'),
    },
  },
  {
    id: 'summer', label: 'Summer', icon: '☀️', bg: '#ecfeff',
    colours: ['#22d3ee', '#fbbf24', '#f97316', '#84cc16', '#ffffff'],
    decals: ['☀️', '🌴', '🍉', '🐚', '🌊', '🍦', '🕶️'],
    looks: {
      Hair: look('Beach Waves', 'Sun-kissed long hair with a snap clip', 'long', '#f5d17a', '#22d3ee', 'solid', '#ffffff', 'snap'),
      Hats: look('Sun Cap', 'Bright cap for sunny days', 'cap', '#fbbf24', '#22d3ee', 'solid', '#ffffff', '☀️'),
      Clothes: look('Beach Tee', 'Striped tee with a palm tree', 'tee', '#22d3ee', '#ffffff', 'stripes', '#ffffff', '🌴'),
      Pants: look('Surf Shorts', 'Orange shorts with flowers', 'shorts', '#f97316', '#ffffff', 'flowers', '#fde68a'),
      Shoes: look('Flip Sandals', 'Beach sandals', 'sandals', '#f97316', '#fbbf24'),
    },
  },
  {
    id: 'birthday', label: 'Birthday', icon: '🎂', bg: '#faf5ff',
    colours: ['#ec4899', '#3b82f6', '#fbbf24', '#22c55e', '#8b5cf6'],
    decals: ['🎂', '🎈', '🎉', '🎁', '🧁', '🍭', '⭐'],
    looks: {
      Hair: look('Party Curls', 'Bouncy curls with a big bow', 'curly', '#f5d17a', '#ec4899', 'solid', '#ffffff', 'bow'),
      Hats: look('Birthday Party Hat', 'Confetti party hat with a pompom', 'party', '#8b5cf6', '#fbbf24', 'confetti', '#ffffff'),
      Clothes: look('Confetti Tee', 'Confetti tee with a birthday cake', 'tee', '#ffffff', '#ec4899', 'confetti', '#ec4899', '🎂'),
      Pants: look('Party Pants', 'Blue pants with a gold waistband', 'pants', '#3b82f6', '#fbbf24'),
      Shoes: look('Balloon Sneakers', 'Pink party sneakers', 'sneakers', '#ec4899', '#ffffff'),
    },
  },
  {
    id: 'lunar_new_year', label: 'Lunar New Year', icon: '🧧', bg: '#fef2f2',
    colours: ['#dc2626', '#fbbf24', '#b91c1c', '#1f2937', '#fef3c7'],
    decals: ['🧧', '🏮', '🐉', '🍊', '🎆', '🌸'],
    looks: {
      Hair: look('Lucky Bun', 'Neat bun with a flower clip', 'bun', '#2a1d13', '#dc2626', 'solid', '#ffffff', 'flower'),
      Hats: look('Lucky Bow', 'Big red bow with a gold knot', 'bow', '#dc2626', '#fbbf24', 'solid', '#ffffff', '🧧'),
      Clothes: look('Golden Blossom Vest', 'Red vest with gold flowers and a dragon', 'vest', '#dc2626', '#fbbf24', 'flowers', '#fbbf24', '🐉'),
      Pants: look('Golden Pants', 'Black pants with a gold waistband', 'pants', '#1f2937', '#fbbf24'),
      Shoes: look('Red Slippers', 'Red slippers with gold trim', 'slippers', '#dc2626', '#fbbf24'),
    },
  },
]

export const themeById = (id) => PAO_THEMES.find((t) => t.id === id) || null
