// One-time, idempotent, ADDITIVE migration for the `subscription` (plans) collection. Never drops or overwrites data.
//   node scripts/migrate-plans.mjs                       adds version / name_lower / is_default + indexes
//   node scripts/migrate-plans.mjs --with-placeholders   also inserts STARTER and PLATINUM as HIDDEN placeholders ($setOnInsert only)
// Safe to run repeatedly. Needs MONGO_URI (frontend/.env).
import { Decimal128, Int32 } from 'mongodb'
process.loadEnvFile?.(new URL('../.env', import.meta.url))
const { getDb } = await import('../api/_lib/mongo.js')
const { planName, slugify } = await import('../api/_lib/plans.js')

const db = await getDb()
const col = db.collection('subscription')
const now = new Date()
let touched = 0

for (const p of await col.find({}).toArray()) {
  const set = {}
  if (p.version == null) set.version = new Int32(1)
  if (!p.name_lower) set.name_lower = planName(p).toLowerCase()
  if (p.slug === 'free' && p.is_default !== true) set.is_default = true
  if (Object.keys(set).length) { await col.updateOne({ _id: p._id }, { $set: set }); touched += 1 }
}
await col.createIndex({ name_lower: 1 }, { unique: true, name: 'name_lower_1_unique', partialFilterExpression: { name_lower: { $type: 'string' } } })
await col.createIndex({ status: 1, sort_order: 1 }, { name: 'status_1_sort_order_1' })
await col.createIndex({ slug: 1 }, { unique: true, name: 'slug_1_unique', partialFilterExpression: { slug: { $type: 'string' } } })
console.log(`plans updated: ${touched}`)

if (process.argv.includes('--with-placeholders')) {
  const feats = (await db.collection('plan_features').find({}).sort({ order: 1, created_at: 1 }).toArray())
  const pick = (n) => feats.slice(0, n)
  const maxOrder = (await col.find({}).sort({ sort_order: -1 }).limit(1).next())?.sort_order || 0
  const placeholders = [
    { name: 'Starter', tagline: 'Between Free and Silver', price: 149, feats: pick(4), limits: { branches: 1, therapists: 3, patients: 30 }, icon: 'sprout', color: '#1fa37a' },
    { name: 'Platinum', tagline: 'Priority support for large clinics', price: 1299, feats: feats, limits: { branches: null, therapists: null, patients: null }, icon: 'gem', color: '#7c5ce0' },
  ]
  let order = Number(maxOrder)
  for (const x of placeholders) {
    order += 1
    const slug = slugify(x.name)
    const r = await col.updateOne({ slug }, {
      $setOnInsert: {
        slug, name: x.name, name_lower: x.name.toLowerCase(), tier_name: `THERAPYPRO: ${x.name.toUpperCase()}`, description: x.tagline,
        price: Decimal128.fromString(x.price.toFixed(2)), currency: 'PHP', billing_cycle: 'monthly', trial_period_days: new Int32(0),
        features: x.feats.map((f) => f.label), feature_keys: x.feats.map((f) => f.key), is_active: false, status: 'hidden', is_popular: false,
        limits: Object.fromEntries(Object.entries(x.limits).map(([k, v]) => [k, v == null ? null : new Int32(v)])),
        icon: x.icon, color: x.color, sort_order: new Int32(order), version: new Int32(1), beta_testers: [], created_at: now, updated_at: now,
      },
    }, { upsert: true })
    console.log(`${x.name}: ${r.upsertedCount ? 'inserted (hidden)' : 'already exists, left unchanged'}`)
  }
}
process.exit(0)
