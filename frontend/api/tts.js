const { synthesizeSpeech } = require('./_lib/elevenLabsTts')

const MAX_TEXT_LENGTH = 600

module.exports = async function handler(req, res) {
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
    return res.status(502).json({ error: err.message })
  }
}
