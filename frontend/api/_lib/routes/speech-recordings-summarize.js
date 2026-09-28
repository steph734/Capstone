import mongoose from 'mongoose'
import Anthropic from '@anthropic-ai/sdk'
import { getMongo } from '../mongo.js'
import { SpeechToTextRecording } from '../models/speechToTextRecording.js'
import { resolveSpeechCreator } from '../resolveSpeechCreator.js'
import { serializeSttRecording } from '../serializeSttRecording.js'

const str = (v) => (v == null ? '' : String(v).trim())

const SYSTEM_PROMPT = `You are helping a speech/occupational therapist write a short, parent-friendly summary of a therapy session from its transcript.

Use ONLY what is actually said in the transcript. Never invent scores, accuracy percentages, or details that aren't there — if the transcript doesn't mention something, leave it out rather than guessing.

Reply with JSON ONLY (no markdown fences, no commentary) in exactly this shape:
{
  "overview": "2-3 sentences describing what happened in the session, in plain language a parent would understand.",
  "goals": ["short phrase for each goal worked on"],
  "progress": ["short phrase per point of progress, including accuracy numbers ONLY if the transcript actually states them"],
  "next_steps": ["short phrase per next step, including at least one home-practice suggestion if the transcript supports one"]
}`

// POST /api/speech-recordings/:id/summarize -> same behaviour as before,
// just pointed at speech_to_text_recordings: safe with no transcript (a
// no-op) or no ANTHROPIC_API_KEY configured (marks the summary failed).
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const id = req.params?.id
  const { therapistEmail } = req.body || {}
  if (!mongoose.isValidObjectId(id)) return res.status(400).json({ error: 'Invalid recording id.' })

  try {
    await getMongo()
    const creator = await resolveSpeechCreator(therapistEmail)
    if (!creator) return res.status(404).json({ error: 'Recording not found.' })

    const doc = await SpeechToTextRecording.findOne({ _id: id, is_deleted: false })
    if (!doc) return res.status(404).json({ error: 'Recording not found.' })
    if (String(doc.created_by) !== String(creator.id)) return res.status(404).json({ error: 'Recording not found.' })

    if (!doc.transcript?.trim()) {
      doc.summary_status = 'none'
      await doc.save()
      return res.status(200).json({ recording: serializeSttRecording(doc) })
    }

    doc.summary_status = 'pending'
    await doc.save()

    if (!process.env.ANTHROPIC_API_KEY) {
      console.warn('speech-recordings/summarize: ANTHROPIC_API_KEY not set — marking summary failed.')
      doc.summary_status = 'failed'
      await doc.save()
      return res.status(200).json({ recording: serializeSttRecording(doc) })
    }

    try {
      const client = new Anthropic()
      const response = await client.messages.create({
        model: 'claude-opus-5',
        max_tokens: 16000,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: doc.transcript }],
      })

      if (response.stop_reason === 'refusal') {
        throw new Error('Model declined to summarize this transcript.')
      }

      const textBlock = response.content.find((b) => b.type === 'text')
      if (!textBlock?.text) throw new Error('No summary text returned.')

      const parsed = JSON.parse(textBlock.text.trim())
      doc.summary = {
        overview: str(parsed.overview),
        goals: Array.isArray(parsed.goals) ? parsed.goals.map(str).filter(Boolean) : [],
        progress: Array.isArray(parsed.progress) ? parsed.progress.map(str).filter(Boolean) : [],
        next_steps: Array.isArray(parsed.next_steps) ? parsed.next_steps.map(str).filter(Boolean) : [],
        generated_at: new Date(),
      }
      doc.summary_status = 'ready'
      await doc.save()
    } catch (aiErr) {
      console.error('speech-recordings/summarize AI error:', aiErr)
      doc.summary_status = 'failed'
      await doc.save()
    }

    return res.status(200).json({ recording: serializeSttRecording(doc) })
  } catch (err) {
    console.error('speech-recordings/summarize error:', err)
    return res.status(500).json({ error: err.message || 'Could not summarize the recording.' })
  }
}
