import { synthesizeSpeech } from '../voiceAiTts.js'

const MAX_TEXT_LENGTH = 600

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { text } = req.body || {}
  if (!text || typeof text !== 'string' || !text.trim()) {
    return res.status(400).json({ error: 'Missing "text" in request body' })
  }
  if (text.length > MAX_TEXT_LENGTH) {
    return res.status(400).json({ error: 'Text too long' })
  }

  try {
    const audio = await synthesizeSpeech(text.trim())
    res.setHeader('Content-Type', 'audio/mpeg')
    res.setHeader('Cache-Control', 'no-store')
    return res.status(200).send(audio)
  } catch (err) {
    // Pass through the upstream Voice.ai status (e.g. 402 insufficient
    // credits, 404 unknown voice_id) when we have one; only fall back to a
    // generic 502 for setup/network failures that have no real status.
    return res.status(err.status || 502).json({ error: err.message })
  }
}
