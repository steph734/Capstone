// Text-to-speech for Pao the panda, via ElevenLabs.
// (File name kept so the /api/tts route import doesn't change.)
const ELEVENLABS_URL = 'https://api.elevenlabs.io/v1/text-to-speech'

const DEFAULT_MODEL = 'eleven_multilingual_v2'

export async function synthesizeSpeech(text) {
  const apiKey = process.env.ELEVENLABS_API_KEY
  const voiceId = process.env.PAO_VOICE_ID
  if (!apiKey) throw new Error('ELEVENLABS_API_KEY is not set on the server')
  if (!voiceId) throw new Error('PAO_VOICE_ID is not set on the server')

  const modelId = process.env.ELEVENLABS_MODEL_ID || DEFAULT_MODEL

  const response = await fetch(
    `${ELEVENLABS_URL}/${encodeURIComponent(voiceId)}?output_format=mp3_44100_128`,
    {
      method: 'POST',
      headers: {
        'xi-api-key': apiKey,
        'Content-Type': 'application/json',
        Accept: 'audio/mpeg',
      },
      body: JSON.stringify({
        text,
        model_id: modelId,
        // Cheerful, expressive kid-friendly delivery.
        voice_settings: { stability: 0.4, similarity_boost: 0.8, style: 0.4, use_speaker_boost: true },
      }),
    },
  )

  if (!response.ok) {
    const detail = await response.text().catch(() => '')
    const err = new Error(`ElevenLabs TTS failed (${response.status}): ${detail.slice(0, 300)}`)
    // Surfaced by the route handler so callers see the real cause (e.g. 401
    // bad key, 404 unknown voice) instead of a blanket 502.
    err.status = response.status
    throw err
  }

  return Buffer.from(await response.arrayBuffer())
}
