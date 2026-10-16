// Voice commands for SOAP note dictation. Each FINAL speech result is run through
// parseCommand(); anything that is not a command is dictation.
export const SECTION_KEYS = ['subjective', 'objective', 'assessment', 'plan']
export const SECTION_LABELS = { subjective: 'Subjective', objective: 'Objective', assessment: 'Assessment', plan: 'Plan' }
export const SECTION_LETTER = { subjective: 'S', objective: 'O', assessment: 'A', plan: 'P' }
export const MAX_SECTION_CHARS = 5000

// Shown in the "Voice commands" card.
export const COMMAND_HELP = [
  ['"Next section"', 'Move to the next part'],
  ['"Go to Plan"', 'Jump to any section'],
  ['"New line"', 'Start a new line'],
  ['"Period" / "Comma"', 'Add punctuation'],
  ['"Undo that"', 'Remove the last phrase'],
  ['"Read it back"', 'Hear the section aloud'],
  ['"Save draft"', 'Save without signing'],
  ['"Stop listening"', 'Turn the mic off'],
]

// Lower-case, collapse spaces, drop the punctuation the recognizer tends to add.
const norm = (t) => String(t || '').toLowerCase().replace(/[.,!?;:]+$/g, '').replace(/\s+/g, ' ').trim()

export function parseCommand(raw) {
  const t = norm(raw)
  if (t === 'next section') return { name: 'next_section' }
  if (t === 'previous section') return { name: 'previous_section' }
  const go = t.match(/^go to (subjective|objective|assessment|plan)$/)
  if (go) return { name: 'go_to_section', section: go[1] }
  if (t === 'new line') return { name: 'new_line' }
  if (t === 'period') return { name: 'punctuation', char: '. ' }
  if (t === 'comma') return { name: 'punctuation', char: ',' }
  if (t === 'question mark') return { name: 'punctuation', char: '?' }
  if (t === 'undo that') return { name: 'undo' }
  if (t === 'clear section') return { name: 'clear_section' }
  if (t === 'read it back' || t === 'read back') return { name: 'read_back' }
  if (t === 'save draft') return { name: 'save_draft' }
  if (t === 'pause') return { name: 'pause' }
  if (t === 'stop listening') return { name: 'stop_listening' }
  if (t === 'sign note' || t === 'sign') return { name: 'sign_blocked' }
  return null
}

// Appends a dictated phrase to a section: capitalises sentence starts, adds the
// space, and never goes past the section limit. Returns { text, chunk } where
// `chunk` is what was actually added ('' when the section is full).
export function appendDictation(current, phrase, limit = MAX_SECTION_CHARS) {
  let p = String(phrase || '').trim()
  if (!p) return { text: current, chunk: '', truncated: false }
  const startsSentence = current.trim() === '' || /[.!?]\s*$/.test(current) || /\n\s*$/.test(current)
  if (startsSentence) p = p.charAt(0).toUpperCase() + p.slice(1)
  const sep = current === '' || /\s$/.test(current) || /^[,.?!;:]/.test(p) ? '' : ' '
  let chunk = sep + p
  const room = limit - current.length
  const truncated = chunk.length > room
  if (truncated) chunk = chunk.slice(0, Math.max(0, room))
  return { text: current + chunk, chunk, truncated }
}

// Punctuation attaches to the last word, so trailing spaces are removed first.
export function applyPunctuation(current, char, limit = MAX_SECTION_CHARS) {
  const base = current.replace(/[ \t]+$/, '')
  const next = base + char
  return next.length > limit ? current : next
}
