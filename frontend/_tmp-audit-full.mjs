process.loadEnvFile?.()
import { getMongo, getDb } from './api/_lib/mongo.js'
await getMongo()
const db = await getDb()
const names = ['badges','clothes','pao_hair','pao_themes','games','employees','activity_sessions','patient_badges','patient_unlocks']
for (const name of names) {
  const info = await db.command({ listCollections: 1, filter: { name } })
  const validator = info.cursor.firstBatch[0]?.options?.validator
  console.log(`\n\n========== ${name} ==========`)
  console.log(JSON.stringify(validator, null, 1))
  const idx = await db.collection(name).indexes()
  console.log('INDEXES:', JSON.stringify(idx.map(i => ({ key: i.key, unique: i.unique, partialFilterExpression: i.partialFilterExpression }))))
}
process.exit(0)
