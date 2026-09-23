const VOICEAI_TTS_URL = 'https://dev.voice.ai/api/v1/tts/speech'

const DEFAULT_MODEL = 'voiceai-tts-v1-latest'

export async function synthesizeSpeech(text) {
  const apiKey = process.env.VOICEAI_API_KEY
  if (!apiKey) {
    throw new Error('VOICEAI_API_KEY is not set on the server')
  }

  const voiceId = process.env.VOICEAI_VOICE_ID
  const modelId = process.env.VOICEAI_MODEL_ID || DEFAULT_MODEL

  const response = await fetch(VOICEAI_TTS_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      text,
      model: modelId,
      language: 'en',
      audio_format: 'mp3',
      // Pao is a cheerful kid-friendly mascot — pushed up from the API
      // defaults (1 / 0.8) for a livelier, more animated, less flat delivery.
      temperature: 1.35,
      top_p: 0.92,
      ...(voiceId ? { voice_id: voiceId } : {}),
    }),
  })

  if (!response.ok) {
    const detail = await response.text().catch(() => '')
    throw new Error(`Voice.ai TTS failed (${response.status}): ${detail.slice(0, 300)}`)
  }

  return Buffer.from(await response.arrayBuffer())
}
