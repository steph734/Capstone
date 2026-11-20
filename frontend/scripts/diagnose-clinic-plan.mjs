// READ-ONLY diagnostic: where does each part of the app get the clinic's plan, and does anything disagree?
//   node scripts/diagnose-clinic-plan.mjs
process.loadEnvFile?.(new URL('../.env', import.meta.url))
const { getDb } = await import('../api/_lib/mongo.js')
const { resolveClinicPlan, featuresOf, recordIsValid } = await import('../api/_lib/entitlements.js')
const db = await getDb()
const PLANISH = /plan|tier|subscr/i
const doc = await db.collection('clinic_settings').findOne({ _id: 'clinic' })
const sub = doc?.subscription || null
console.log('== Clinic ==')
console.log(`clinic_settings._id 'clinic': ${doc ? 'found' : 'MISSING'} (${doc?.clinic_name || '-'})`)
console.log('stored subscription record:', sub ? JSON.stringify({ plan_key: sub.plan_key, status: sub.status, billing_period: sub.billing_period, current_period_end: sub.current_period_end, stripe_subscription_id: sub.stripe_subscription_id || null, price_snapshot: sub.price_snapshot ?? null }) : 'NONE (resolver falls back to beta testers / Stripe-by-email)')
if (sub) {
  console.log('  plan_key uppercase:', sub.plan_key === String(sub.plan_key).toUpperCase(), '| valid right now:', recordIsValid(sub), '| has owner_id:', Boolean(sub.owner_id), '| has price_snapshot:', sub.price_snapshot != null)
}
if (doc?.pending_subscription) console.log('pending (not yet confirmed):', JSON.stringify(doc.pending_subscription))
const r = await resolveClinicPlan(db)
console.log(`resolved plan: ${r.plan.slug} (${r.source}${r.why ? ': ' + r.why : ''}); features: ${featuresOf(r.plan, r.plans).join(', ')}`)
console.log('\n== Plans (tier order) ==')
for (const p of r.plans) console.log(`  #${p.sort_order} ${p.slug} status=${p.status || 'live'} features=${(p.feature_keys || []).length} beta_testers=${(p.beta_testers || []).length}`)
console.log('\n== Owners ==')
for (const o of await db.collection('users').find({ role: 'Owner' }, { projection: { email: 1, is_archived: 1 } }).toArray()) console.log(' ', o.email, o.is_archived ? '(archived)' : '')
console.log('\n== Plan-like fields on user / patient documents (no longer read by any code) ==')
let found = 0
for (const [col, filter] of [['users', {}], ['patients', {}]]) {
  for (const d of await db.collection(col).find(filter, { projection: { password: 0 } }).toArray()) {
    const keys = Object.keys(d).filter((k) => PLANISH.test(k))
    if (keys.length) { found += 1; console.log(`  ${col} ${d.email || d._id}:`, keys.map((k) => `${k}=${JSON.stringify(d[k])}`).join(' ')) }
  }
}
if (!found) console.log('  none')
console.log('\n== Branch -> clinic linkage ==')
console.log('  branches:', await db.collection('branchs').countDocuments(), '| patients with a branch field:', await db.collection('patients').countDocuments({ $or: [{ branch_id: { $exists: true } }, { branch: { $exists: true } }] }), '| single clinic: every branch/user resolves to the clinic above')
process.exit(0)
