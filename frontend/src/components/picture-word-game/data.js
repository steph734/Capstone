// Categories, vocabulary items, and the question builder for Picture-Word
// Matching. Each item is a simple, concrete noun a young child sees every
// day, paired with a big emoji "picture" (see EmojiPicture in
// illustrations.jsx) and a soft tint that matches its category.

export const CATEGORIES = [
  { id: 'fruits',     label: 'Fruits',     light: '#FDE7E6', dark: '#F2B8B5' },
  { id: 'vegetables', label: 'Vegetables', light: '#E3F4E8', dark: '#A9D8B6' },
  { id: 'animals',    label: 'Animals',    light: '#FFF0CC', dark: '#F3D284' },
  { id: 'things',     label: 'Things',     light: '#E9E8FB', dark: '#C4C1F0' },
]

const ITEMS_BY_CATEGORY = {
  fruits: [
    { word: 'Apple',      emoji: '🍎' },
    { word: 'Banana',     emoji: '🍌' },
    { word: 'Orange',     emoji: '🍊' },
    { word: 'Grape',      emoji: '🍇' },
    { word: 'Strawberry', emoji: '🍓' },
    { word: 'Watermelon', emoji: '🍉' },
    { word: 'Pineapple',  emoji: '🍍' },
    { word: 'Mango',      emoji: '🥭' },
    { word: 'Cherry',     emoji: '🍒' },
    { word: 'Peach',      emoji: '🍑' },
  ],
  vegetables: [
    { word: 'Carrot',   emoji: '🥕' },
    { word: 'Broccoli', emoji: '🥦' },
    { word: 'Corn',     emoji: '🌽' },
    { word: 'Tomato',   emoji: '🍅' },
    { word: 'Eggplant', emoji: '🍆' },
    { word: 'Cucumber', emoji: '🥒' },
    { word: 'Pepper',   emoji: '🫑' },
    { word: 'Onion',    emoji: '🧅' },
    { word: 'Potato',   emoji: '🥔' },
    { word: 'Mushroom', emoji: '🍄' },
  ],
  animals: [
    { word: 'Dog',       emoji: '🐶' },
    { word: 'Cat',       emoji: '🐱' },
    { word: 'Elephant',  emoji: '🐘' },
    { word: 'Lion',      emoji: '🦁' },
    { word: 'Rabbit',    emoji: '🐰' },
    { word: 'Duck',      emoji: '🦆' },
    { word: 'Frog',      emoji: '🐸' },
    { word: 'Butterfly', emoji: '🦋' },
    { word: 'Fish',      emoji: '🐠' },
    { word: 'Bear',      emoji: '🐻' },
  ],
  things: [
    { word: 'Ball',     emoji: '⚽' },
    { word: 'Book',     emoji: '📚' },
    { word: 'House',    emoji: '🏠' },
    { word: 'Car',      emoji: '🚗' },
    { word: 'Star',     emoji: '⭐' },
    { word: 'Rainbow',  emoji: '🌈' },
    { word: 'Cake',     emoji: '🎂' },
    { word: 'Airplane', emoji: '✈️' },
    { word: 'Sun',      emoji: '☀️' },
    { word: 'Flower',   emoji: '🌸' },
  ],
}

function shuffle(arr) { return [...arr].sort(() => Math.random() - 0.5) }

export function itemsFor(categoryId) {
  const cat = CATEGORIES.find((c) => c.id === categoryId) || CATEGORIES[0]
  const pool = ITEMS_BY_CATEGORY[cat.id] || ITEMS_BY_CATEGORY.fruits
  return pool.map((it) => ({ ...it, id: `${cat.id}-${it.word}`, categoryId: cat.id, tint: cat.light }))
}

// Builds `count` questions, each with the target item plus `choices` word
// options total (the correct word + choices-1 distractors from the same
// category, so a wrong pick still reads as a plausible, related word).
export function buildQuestions(categoryId, count = 6, choices = 3) {
  const items = itemsFor(categoryId)
  const picked = shuffle(items).slice(0, Math.min(count, items.length))
  return picked.map((item) => {
    const distractorPool = items.filter((i) => i.word !== item.word)
    const distractors = shuffle(distractorPool).slice(0, Math.max(0, choices - 1)).map((d) => d.word)
    const options = shuffle([item.word, ...distractors])
    return { item, options }
  })
}
