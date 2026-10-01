process.loadEnvFile?.()
import app from './api/index.js'
import { getMongo, getDb } from './api/_lib/mongo.js'

const server = app.listen(5058, () => console.log('listening'))
const BASE = 'http://localhost:5058'

async function j(method, path, body) {
  const r = await fetch(BASE + path, { method, headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined })
  const data = await r.json().catch(() => ({}))
  return { status: r.status, data }
}

async function run() {
  await getMongo()
  const db = await getDb()

  const create = await j('POST', '/api/badges/create', {
    name: 'Test Badge ' + Date.now(),
    description: 'A badge created to verify the new schema',
    art: { shape: 'circle', color: 'blue', symbol: 'star', banner: false },
    criteriaType: 'reach_level', criteriaValue: 5,
    isActive: true,
  })
  console.log('create ->', create.status, JSON.stringify(create.data, null, 2))
  const id = create.data.badge?.id

  if (id) {
    const patch = await j('PATCH', `/api/badges/${id}`, { isActive: false })
    console.log('patch ->', patch.status, patch.data.badge?.isActive)

    const list = await j('GET', '/api/badges/list')
    console.log('list contains it:', list.data.badges?.some((b) => b.id === id))

    const del = await j('DELETE', `/api/badges/${id}`)
    console.log('delete ->', del.status, del.data)
  }

  server.close()
}
run().catch((err) => { console.error('TEST FAILED:', err); server.close(); process.exit(1) })
