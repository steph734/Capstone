// `game_play_events`: what the patient's device reports while a planned game is open (started, heartbeat, retry, hint,
// finished, exited). The $jsonSchema validator lives in MongoDB; this model mirrors it. Nothing personal is stored.
// Events older than 90 days are removed by a TTL index on `at` (created by ensureEventIndexes()).
import mongoose from 'mongoose'

const { ObjectId } = mongoose.Schema.Types

const gamePlayEventSchema = new mongoose.Schema(
  {
    plan_id: { type: ObjectId, required: true },
    patient_id: { type: ObjectId, required: true },
    game_id: { type: ObjectId, required: true },
    game_session_id: { type: ObjectId, default: null },
    type: { type: String, required: true, enum: ['game_started', 'heartbeat', 'round_retry', 'hint_used', 'game_finished', 'game_exited'] },
    round: { type: Number, default: null },
    total_rounds: { type: Number, default: null },
    score: { type: Number, default: null },
    accuracy: { type: Number, default: null, min: 0, max: 100 },
    hints: { type: Number, default: null },
    last_input_at: { type: Date, default: null },
    at: { type: Date, required: true },
  },
  { collection: 'game_play_events', versionKey: false, timestamps: false }
)

export const GamePlayEvent = mongoose.models.GamePlayEvent || mongoose.model('GamePlayEvent', gamePlayEventSchema)

let indexed = false
export async function ensureEventIndexes() {
  if (indexed) return
  indexed = true
  try {
    await GamePlayEvent.collection.createIndex({ plan_id: 1, at: 1 })
    await GamePlayEvent.collection.createIndex({ at: 1 }, { expireAfterSeconds: 90 * 24 * 3600 })
  } catch (err) { console.error('game_play_events indexes:', err.message); indexed = false }
}
