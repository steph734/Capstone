// Categories, vocabulary items, and the question builder for Picture-Word
// Matching. Each item is a simple, concrete noun a young child sees every
// day, paired with a flat SVG picture (see WordPicture in wordArt.jsx) and a
// soft tint that matches its category.

export const CATEGORIES = [
  { id: 'fruits',     label: 'Fruits',     light: '#FFE3E6', dark: '#F2A6B0', ink: '#9B1C4B', art: 'Apple' },
  { id: 'vegetables', label: 'Vegetables', light: '#DDF7E5', dark: '#86D3A0', ink: '#14724A', art: 'Carrot' },
  { id: 'animals',    label: 'Animals',    light: '#FFF1CC', dark: '#F0CF72', ink: '#7A5300', art: 'Cat' },
  { id: 'things',     label: 'Things',     light: '#E7E4FF', dark: '#A9A2F0', ink: '#3B2BB0', art: 'Ball' },
]

const ITEMS_BY_CATEGORY = {
  fruits: [
    { word: 'Apple' },
    { word: 'Banana' },
    { word: 'Orange' },
    { word: 'Grape' },
    { word: 'Strawberry' },
    { word: 'Watermelon' },
    { word: 'Pineapple' },
    { word: 'Mango' },
    { word: 'Cherry' },
    { word: 'Peach' },
  ],
  vegetables: [
    { word: 'Carrot' },
    { word: 'Broccoli' },
    { word: 'Corn' },
    { word: 'Tomato' },
    { word: 'Eggplant' },
    { word: 'Cucumber' },
    { word: 'Pepper' },
    { word: 'Onion' },
    { word: 'Potato' },
    { word: 'Mushroom' },
  ],
  animals: [
    { word: 'Dog' },
    { word: 'Cat' },
    { word: 'Elephant' },
    { word: 'Lion' },
    { word: 'Rabbit' },
    { word: 'Duck' },
    { word: 'Frog' },
    { word: 'Butterfly' },
    { word: 'Fish' },
    { word: 'Bear' },
  ],
  things: [
    { word: 'Ball' },
    { word: 'Book' },
    { word: 'House' },
    { word: 'Car' },
    { word: 'Star' },
    { word: 'Rainbow' },
    { word: 'Cake' },
    { word: 'Airplane' },
    { word: 'Sun' },
    { word: 'Flower' },
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
