// Idempotent repair for the clinic's stored subscription record. Always run with --dry-run first.
//   node scripts/repair-clinic-plan.mjs --dry-run
//   node scripts/repair-clinic-plan.mjs                      applies the fixes below (after writing a JSON backup)
//   node scripts/repair-clinic-plan.mjs --link-from-stripe   ALSO creates the record from the Owner's live Stripe subscription
//                                                            (needs STRIPE_SECRET_KEY; matches by the Owner's account email)
// Fixes: plan_key missing or not uppercase, missing owner_id, missing price_snapshot. Old plan fields on user/patient
// documents are only listed (diagnose-clinic-plan.mjs), never deleted.
import { writeFileSync, mkdirSync } from 'node:fs'
process.loadEnvFile?.(new URL('../.env', import.meta.url))
const { getDb } = await import('../api/_lib/mongo.js')
const { recordFromStripe, CLINIC_ID } = await import('../api/_lib/entitlements.js')
const { loadSubscriptions, isLive } = await import('../api/_lib/plans.js')
const dry = process.argv.includes('--dry-run')
const db = await getDb()
const cs = db.collection('clinic_settings')
const doc = await cs.findOne({ _id: CLINIC_ID })
const sub = doc?.subscription || null
const changes = {}
const owner = await db.collection('users').findOne({ role: 'Owner', is_archived: { $ne: true } })

if (sub) {
  if (!sub.plan_key) console.log('! record has no plan_key: cannot guess it, fix by hand or re-subscribe')
  else if (sub.plan_key !== String(sub.plan_key).toUpperCase()) changes.plan_key = String(sub.plan_key).toUpperCase()
  if (!sub.owner_id && owner) changes.owner_id = owner._id
} else if (process.argv.includes('--link-from-stripe')) {
  const subs = await loadSubscriptions()
  if (!subs) console.log('! Stripe unreadable (STRIPE_SECRET_KEY missing?)')
  else {
    const mine = subs.filter((s) => isLive(s) && String(s.customer?.email || '').toLowerCase() === String(owner?.email || '').toLowerCase())
    console.log(`live Stripe subscriptions for ${owner?.email}: ${mine.length}`)
    if (mine.length) { // most expensive = highest tier
      const best = mine.sort((a, b) => (b.items.data[0].price.unit_amount || 0) - (a.items.data[0].price.unit_amount || 0))[0]
      const plan = await db.collection('subscription').find({}).toArray().then((ps) => ps.find((p) => (p.price_versions || []).some((v) => v.stripe_price_id === best.items.data[0].price.id)))
      if (!plan?.slug) console.log('! could not match the Stripe price to a plan; set plan_key by hand')
      else changes.__new = recordFromStripe(best, { plan_key: plan.slug.toUpperCase(), owner_id: owner._id })
    }
  }
} else console.log('no stored record; nothing to repair (use --link-from-stripe to create one from Stripe)')

if (!Object.keys(changes).length) { console.log('Nothing to change.'); process.exit(0) }
console.log(dry ? 'DRY RUN, would change:' : 'Changing:', JSON.stringify(changes))
if (!dry) {
  mkdirSync(new URL('../backups/', import.meta.url), { recursive: true })
  const file = new URL(`../backups/clinic_settings-${Date.now()}.json`, import.meta.url)
  writeFileSync(file, JSON.stringify(doc, null, 2))
  console.log('backup written:', file.pathname)
  if (changes.__new) await cs.updateOne({ _id: CLINIC_ID }, { $set: { subscription: changes.__new } }, { upsert: true })
  else await cs.updateOne({ _id: CLINIC_ID }, { $set: Object.fromEntries(Object.entries(changes).map(([k, v]) => [`subscription.${k}`, v])) })
  console.log('done')
}
process.exit(0)
