process.loadEnvFile?.()
import app from './api/index.js'
const server = app.listen(5055, () => console.log('listening'))

async function run() {
  const r1 = await fetch('http://localhost:5055/api/employees')
  console.log('GET /api/employees ->', r1.status)
  const d1 = await r1.json()
  console.log('employees count:', (d1.employees || []).length)
  if (d1.employees?.length) {
    console.log('sample:', JSON.stringify({
      name: `${d1.employees[0].first_name} ${d1.employees[0].last_name}`,
      status: d1.employees[0].status,
      branch: d1.employees[0].branch_id?.branch_name,
    }))
  }

  const r2 = await fetch('http://localhost:5055/api/branches')
  console.log('GET /api/branches ->', r2.status)
  const d2 = await r2.json()
  console.log('branches:', d2.branches?.map(b => b.branch_name))

  server.close()
}
run().catch((err) => { console.error(err); server.close(); process.exit(1) })
