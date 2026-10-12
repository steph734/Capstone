const { createClient } = require('@supabase/supabase-js');

// Server-only Supabase client using the service role key — bypasses Row
// Level Security, so this file must never be imported by anything that
// ships to the browser. Used to read/write the private "email-attachments"
// bucket (frontend only ever sees short-lived signed URLs, never this key).
let client = null;

function getSupabaseAdmin() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error('SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are not set in backend/.env.');
  }
  if (!client) {
    client = createClient(url, key, { auth: { persistSession: false } });
  }
  return client;
}

const ATTACHMENTS_BUCKET = 'email-attachments';

module.exports = { getSupabaseAdmin, ATTACHMENTS_BUCKET };
