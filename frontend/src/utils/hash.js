// SHA-256 hex digest via the Web Crypto API. Passwords are hashed with this
// before they ever leave the browser, so the request payload (Network tab,
// server logs, proxies) never carries the raw password — only a fixed-length
// digest. The server treats it as an opaque string and bcrypt-hashes/compares
// it exactly like it would a plaintext password, so this must be applied
// consistently at every place a password is sent: sign up, login, and
// password reset.
export async function sha256Hex(text) {
  const bytes = new TextEncoder().encode(text)
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}
