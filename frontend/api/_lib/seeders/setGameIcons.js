// One-off: gives every existing game a lucide icon name in its `icon` field
// (the Games page shows icons, never emojis). Only fills games that have none.
//   node api/_lib/seeders/setGameIcons.js
import { getMongo, getDb } from '../mongo.js'

process.loadEnvFile?.()
const ICONS = {
  'alphabet blast': 'mic', 'copy the colors': 'palette', 'picture-word matching': 'image', 'story builder': 'book-open',
  'sound hunt': 'ear', 'emoji emotion match': 'smile', 'daily routines': 'clock', 'puzzle pals': 'puzzle',
  'slow-motion echo': 'turtle', 'sentence builder': 'type', 'rhyme time': 'music', 'sort the basket': 'shopping-basket',
  'money match': 'coins', 'feed pao': 'utensils', 'spot the difference': 'search', 'emergency ready': 'shield-alert',
}
await getMongo()
const db = await getDb()
const games = await db.collection('games').find({ $or: [{ icon: { $exists: false } }, { icon: null }, { icon: '' }] }, { projection: { name: 1 } }).toArray()
let n = 0
for (const g of games) {
  const icon = ICONS[String(g.name).trim().toLowerCase()] || 'gamepad-2'
  await db.collection('games').updateOne({ _id: g._id }, { $set: { icon } })
  n += 1
  console.log(`${g.name} -> ${icon}`)
}
console.log(`${n} game(s) updated`)
process.exit(0)
