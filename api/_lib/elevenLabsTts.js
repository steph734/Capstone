const ELEVENLABS_API_URL = 'https://api.elevenlabs.io/v1/text-to-speech'

// Bella — warm, friendly, expressive voice; good fit for a cheerful mascot.
const DEFAULT_VOICE_ID = 'EXAVITQu4vr4xnSDxMaL'
const DEFAULT_MODEL_ID = 'eleven_turbo_v2_5'

async function synthesizeSpeech(text) {
  const apiKey = process.env.ELEVENLABS_API_KEY
  if (!apiKey) {
    throw new Error('ELEVENLABS_API_KEY is not set on the server')
  }

  const voiceId = process.env.ELEVENLABS_VOICE_ID || DEFAULT_VOICE_ID
  const modelId = process.env.ELEVENLABS_MODEL_ID || DEFAULT_MODEL_ID

  const response = await fetch(`${ELEVENLABS_API_URL}/${voiceId}`, {
    method: 'POST',
    headers: {
      'xi-api-key': apiKey,
      'Content-Type': 'application/json',
      Accept: 'audio/mpeg',
    },
    body: JSON.stringify({
      text,
      model_id: modelId,
      voice_settings: {
        stability: 0.55,
        similarity_boost: 0.8,
        style: 0.4,
        use_speaker_boost: true,
      },
    }),
  })

  if (!response.ok) {
    const detail = await response.text().catch(() => '')
    throw new Error(`ElevenLabs TTS failed (${response.status}): ${detail.slice(0, 300)}`)
  }

  return Buffer.from(await response.arrayBuffer())
}

module.exports = { synthesizeSpeech }
