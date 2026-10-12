// Server-only Supabase client using the service role key — bypasses Row
// Level Security. Must never be imported by anything that ships to the
// browser (client-side code only ever sees short-lived signed URLs). Used to
// read/write the private "email-attachments" bucket.
import { createClient } from '@supabase/supabase-js'

let client = null

export function getSupabaseAdmin() {
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    throw new Error('SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are not set.')
  }
  if (!client) {
    client = createClient(url, key, { auth: { persistSession: false } })
  }
  return client
}

export const ATTACHMENTS_BUCKET = 'email-attachments'
