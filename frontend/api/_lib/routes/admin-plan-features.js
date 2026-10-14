import { ObjectId } from 'mongodb'
import { getMongo } from '../mongo.js'
import { requireSession } from '../session.js'
import { auditAdmin } from '../adminAudit.js'
import { loadPlansAndFeatures, serializeFeature, slugify, str } from '../plans.js'

// Shared plan features (the `plan_features` collection that also feeds Compare plans).
// POST   /api/admin/plan-features        { label }
// PATCH  /api/admin/plan-features/:id    { label?, minTier? }
// DELETE /api/admin/plan-features/:id    only when no plan uses it
export default async function handler(req, res) {
  if (!['POST', 'PATCH', 'DELETE'].includes(req.method)) {
    res.setHeader('Allow', 'POST, PATCH, DELETE')
    return res.status(405).json({ error: 'Method not allowed' })
  }
  try {
    await getMongo()
    const ctx = await requireSession(req, res, { roles: ['Super Admin'] })
    if (!ctx) return
    const { plans, features } = await loadPlansAndFeatures(ctx.db)
    const col = ctx.db.collection('plan_features')
    // Plans keep a string[] of feature labels (the collection's validator); refresh it after a rename.
    const refreshLabels = async (list) => {
      const label = new Map(list.map((f) => [f.key, f.label]))
      for (const p of plans) {
        if (!(p.feature_keys || []).length) continue
        await ctx.db.collection('subscription').updateOne({ _id: p._id }, { $set: { features: p.feature_keys.map((k) => label.get(k)).filter(Boolean) } })
      }
    }

    if (req.method === 'POST') {
      const label = str(req.body?.label)
      const fail = (m) => res.status(400).json({ error: m, fields: { label: m } })
      if (!label) return fail('Give the feature a name.')
      if (label.length > 60) return fail('Keep it under 60 characters.')
      if (features.some((f) => f.label.toLowerCase() === label.toLowerCase())) return fail('That feature already exists.')
      let key = slugify(label) || 'feature'
      for (let n = 2; features.some((f) => f.key === key); n += 1) key = `${slugify(label)}_${n}`
      const doc = { key, label, min_tier: null, order: features.reduce((m, f) => Math.max(m, f.order || 0), 0) + 1, is_custom: true, created_at: new Date() }
      const { insertedId } = await col.insertOne(doc)
      await auditAdmin(ctx, 'plan_feature_created', `Added plan feature "${label}".`, { key })
      return res.status(201).json({ feature: serializeFeature({ ...doc, _id: insertedId }) })
    }

    const id = req.params.id
    if (!ObjectId.isValid(id)) return res.status(400).json({ error: 'Invalid feature id.' })
    const feature = features.find((f) => String(f._id) === id)
    if (!feature) return res.status(404).json({ error: 'Feature not found.' })

    if (req.method === 'DELETE') {
      if (plans.some((p) => (p.feature_keys || []).includes(feature.key))) return res.status(400).json({ error: 'A plan still includes this feature. Untick it there first.' })
      await col.deleteOne({ _id: feature._id })
      await auditAdmin(ctx, 'plan_feature_deleted', `Deleted plan feature "${feature.label}".`, { key: feature.key })
      return res.json({ ok: true })
    }

    const set = {}
    if (req.body?.label !== undefined) {
      const label = str(req.body.label)
      if (!label || label.length > 60) return res.status(400).json({ error: 'Feature names are 1 to 60 characters.' })
      if (features.some((f) => f !== feature && f.label.toLowerCase() === label.toLowerCase())) return res.status(400).json({ error: 'That feature already exists.' })
      set.label = label
    }
    if (req.body?.minTier !== undefined) {
      const t = req.body.minTier
      if (t !== null && t !== 'all' && !plans.some((p) => p.slug === t)) return res.status(400).json({ error: 'Choose a valid plan tier.' })
      set.min_tier = t
    }
    if (!Object.keys(set).length) return res.json({ ok: true })
    await col.updateOne({ _id: feature._id }, { $set: set })
    if (set.label) await refreshLabels(features.map((f) => (f === feature ? { ...f, label: set.label } : f)))
    await auditAdmin(ctx, 'plan_feature_updated', `Edited plan feature "${feature.label}".`, { key: feature.key, ...set })
    return res.json({ ok: true })
  } catch (err) {
    console.error('admin plan features error:', err)
    return res.status(err.status || 500).json({ error: err.status ? err.message : 'Could not complete that request.' })
  }
}
