import { getDb } from './mongo.js'
process.loadEnvFile?.()
const db = await getDb()
const s = await db.collection('game_sessions').findOne({ status: 'completed' })
console.log('session', { patient_id: s.patient_id, patient_id_type: typeof s.patient_id, completed_at: s.completed_at })
console.log('now', new Date())
