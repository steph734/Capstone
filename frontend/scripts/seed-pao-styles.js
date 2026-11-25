// Creates the pao_poses_expressions collection (validator, indexes), upserts
// the 24 rows, and adds the optional selection fields to pao_profiles' schema.
//   node scripts/seed-pao-styles.js
import mongoose from 'mongoose'
import { getMongo, getDb } from '../api/_lib/mongo.js'
import { ensureStyles, extendProfileValidator } from '../api/_lib/paoStyles.js'

process.loadEnvFile?.()

await getMongo()
const db = await getDb()
const count = await ensureStyles(db)
console.log(`pao_poses_expressions ready: ${count} rows.`)
const extended = await extendProfileValidator(db)
console.log(extended ? 'pao_profiles validator extended.' : 'pao_profiles has no $jsonSchema; nothing to extend.')
await mongoose.disconnect()
