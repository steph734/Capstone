import { getResetCredential } from './_lib/credentialStore.js'

// Checks a typed email + password against the server-side reset store (Vercel
// KV). Only knows about passwords set through the "forgot password" flow — the
// built-in prototype passwords are still checked on the client. Returns the
// account role so the client can sign the user in as the right account even if
// this browser has never seen the changed email.
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { email, password } = req.body || {}
  if (!email || !password) {
    return res.status(400).json({ error: 'Missing email or password' })
  }

  try {
    const stored = await getResetCredential(email)
    if (stored && stored.password === password) {
      return res.status(200).json({
        match: true,
        email: String(email).trim().toLowerCase(),
        role: stored.role || null,
      })
    }
    return res.status(200).json({ match: false })
  } catch (err) {
    // Store unreachable — report no match rather than 500 so login still works
    // for built-in / local-reset passwords.
    return res.status(200).json({ match: false, error: err.message })
  }
}
