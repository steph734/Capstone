// Pao poses and expressions: one collection, `pao_poses_expressions`, with a
// `type` of 'pose' or 'expression'. Everything here is free. The patient's
// choice is stored on the existing pao_profiles document as
// selected_pose_key / selected_expression_key (missing = the default).
import mongoose from 'mongoose'

const { Int32 } = mongoose.mongo

export const COLLECTION = 'pao_poses_expressions'
export const DEFAULTS = { pose: 'relax', expression: 'happy' }
export const SELECT_FIELD = { pose: 'selected_pose_key', expression: 'selected_expression_key' }

const POSES = [
  ['relax', 'Relaxed', 'Just chilling'],
  ['wave', 'Wave', 'Say hello'],
  ['cheer', 'Cheer', 'Hooray!'],
  ['hello', 'Big hello', 'Both paws up'],
  ['jump', 'Jump', 'Up in the air'],
  ['dance', 'Dance', 'Feel the beat'],
  ['groove', 'Groove', 'Music time'],
  ['tada', 'Ta-da', 'Arms wide open'],
  ['think', 'Thinking', 'Paw on chin'],
  ['shy', 'Shy', 'Paws on cheeks'],
  ['hug', 'Cuddle', 'Warm and cozy'],
  ['lean', 'Cozy lean', 'Tilted and relaxed'],
]

const EXPRESSIONS = [
  ['happy', 'Happy', 'Big smile'],
  ['proud', 'Proud', 'So pleased'],
  ['wink', 'Wink', 'Playful'],
  ['excited', 'Excited', 'Wow, wow!'],
  ['laugh', 'Laugh', 'Happy tears'],
  ['surprised', 'Surprised', 'Oh my!'],
  ['silly', 'Silly', 'Tongue out'],
  ['cool', 'Cool', 'Shades on'],
  ['love', 'Love', 'Heart eyes'],
  ['sleepy', 'Sleepy', 'Nap time'],
  ['sad', 'Sad', 'Needs a hug'],
  ['grumpy', 'Grumpy', 'Hmph'],
]

const BASE = '/games/pao-poses-expressions'

// Short card text for the animated expressions (what moves).
const MOTION = {
  happy: 'Bobs and blinks', proud: 'Chin up, glowing', wink: 'Winks, tongue out', excited: 'Bounces, sparkles',
  laugh: 'Shakes, happy tears', surprised: 'Pops, wide eyes', silly: 'Wobbles, tongue out', cool: 'Nods, lens glint',
  love: 'Eyes beat, hearts float', sleepy: 'Drifts down, Zs rise', sad: 'Head sinks, tear rolls', grumpy: 'Shakes, anger mark',
}

// Plain rows (sort_order as a JS number); use toDocs() for driver-ready docs.
export const STYLE_ROWS = [
  ...POSES.map(([key, name, description], i) => ({
    key, type: 'pose', name, description,
    asset_key: `pose_${key}`, preview_image_url: `${BASE}/poses/pose_${key}.png`,
    sort_order: i + 1, is_default: key === DEFAULTS.pose,
  })),
  ...EXPRESSIONS.map(([key, name, description], i) => ({
    key, type: 'expression', name, description,
    asset_key: `expr_${key}`, preview_image_url: `${BASE}/expressions/expr_${key}.png`,
    sort_order: i + 1, is_default: key === DEFAULTS.expression,
    is_animated: true, animation_class: 'x-' + key, motion_description: MOTION[key],
  })),
]

// Driver-ready docs: sort_order is an Int32 (the validator requires "int"),
// no empty strings, dates in UTC.
export function toDocs(now = new Date()) {
  return STYLE_ROWS.map((r) => ({
    ...r,
    sort_order: new Int32(r.sort_order),
    is_free: true, is_active: true, is_archived: false,
    created_at: now, updated_at: now,
  }))
}

const str = (extra = {}) => ({ bsonType: 'string', minLength: 1, ...extra })

export const VALIDATOR = {
  $jsonSchema: {
    bsonType: 'object',
    required: ['key', 'type', 'name', 'asset_key', 'preview_image_url', 'sort_order',
      'is_free', 'is_default', 'is_active', 'is_archived', 'created_at', 'updated_at'],
    properties: {
      key: str({ pattern: '^[a-z][a-z0-9_]*$', maxLength: 32 }),
      type: { enum: ['pose', 'expression'] },
      name: str({ maxLength: 60 }),
      description: str({ maxLength: 200 }),
      asset_key: str({ pattern: '^[a-z][a-z0-9_]*$', maxLength: 64 }),
      preview_image_url: str({ maxLength: 500 }),
      sort_order: { bsonType: 'int', minimum: 0 },
      is_animated: { bsonType: 'bool' },
      animation_class: str({ pattern: '^x-[a-z][a-z0-9_]*$', maxLength: 40 }),
      motion_description: str({ maxLength: 120 }),
      is_free: { bsonType: 'bool' },
      is_default: { bsonType: 'bool' },
      is_active: { bsonType: 'bool' },
      is_archived: { bsonType: 'bool' },
      archived_at: { bsonType: 'date' },
      created_by: str(),
      updated_by: str(),
      created_at: { bsonType: 'date' },
      updated_at: { bsonType: 'date' },
    },
  },
}

// Creates the collection (or updates its validator), indexes, and upserts the
// 24 rows. Safe to run repeatedly; never overwrites created_at or edits made
// to is_active / is_archived.
export async function ensureStyles(db) {
  const exists = (await db.listCollections({ name: COLLECTION }).toArray()).length > 0
  if (exists) await db.command({ collMod: COLLECTION, validator: VALIDATOR, validationLevel: 'moderate' })
  else await db.createCollection(COLLECTION, { validator: VALIDATOR, validationLevel: 'moderate' })

  const col = db.collection(COLLECTION)
  await col.createIndex({ type: 1, key: 1 }, { unique: true, name: 'uniq_type_key' })
  await col.createIndex({ type: 1, sort_order: 1 }, { name: 'type_sort' })
  await col.createIndex(
    { type: 1 },
    { unique: true, partialFilterExpression: { is_default: true, is_archived: false }, name: 'one_default_per_type' },
  )

  const now = new Date()
  const ops = toDocs(now).map((d) => {
    const { created_at, is_active, is_archived, ...rest } = d
    return {
      updateOne: {
        filter: { type: d.type, key: d.key },
        update: { $set: rest, $setOnInsert: { created_at, is_active, is_archived } },
        upsert: true,
      },
    }
  })
  await col.bulkWrite(ops)
  return col.countDocuments({})
}

// Add the two optional selection fields to pao_profiles' $jsonSchema, if that
// collection has one (old documents stay valid because they are not required).
export async function extendProfileValidator(db) {
  const info = (await db.listCollections({ name: 'pao_profiles' }).toArray())[0]
  const schema = info?.options?.validator?.$jsonSchema
  if (!schema) return false
  schema.properties = {
    ...(schema.properties || {}),
    selected_pose_key: { bsonType: 'string', minLength: 1 },
    selected_expression_key: { bsonType: 'string', minLength: 1 },
  }
  await db.command({ collMod: 'pao_profiles', validator: { $jsonSchema: schema } })
  return true
}

// Active styles, ordered by type then sort_order.
export async function listActiveStyles(db) {
  const rows = await db.collection(COLLECTION)
    .find({ is_active: true, is_archived: false })
    .project({ _id: 0, key: 1, type: 1, name: 1, description: 1, asset_key: 1, preview_image_url: 1, is_default: 1, sort_order: 1, is_animated: 1, animation_class: 1, motion_description: 1 })
    .toArray()
  rows.sort((a, b) => (a.type === b.type ? Number(a.sort_order) - Number(b.sort_order) : a.type < b.type ? 1 : -1))
  // type order: pose first, then expression (descending string order does that)
  return rows.map(({ sort_order, ...r }) => r)
}

// The patient's style state. A saved key only counts if it is still an
// active, non-archived row. Pose and expression are exclusive: nothing set
// means plain default Pao. If legacy data has both, the pose wins.
export async function resolveSelection(db, profile) {
  const rows = await db.collection(COLLECTION)
    .find({ is_active: true, is_archived: false }, { projection: { _id: 0, key: 1, type: 1 } })
    .toArray()
  const valid = (type, key) => (key && rows.some((r) => r.type === type && r.key === key) ? key : null)
  const pose = valid('pose', profile?.[SELECT_FIELD.pose])
  const expression = pose ? null : valid('expression', profile?.[SELECT_FIELD.expression])
  return {
    selected_pose_key: pose,
    selected_expression_key: expression,
    active: pose ? 'pose' : expression ? 'expr' : null,
  }
}
