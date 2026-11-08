// Render checks for the Home practice tab pieces (run with:  npx vitest run src/pages/therapist/assign/homeSets).
import { describe, expect, it } from 'vitest'
import { createElement as h } from 'react'
import { renderToStaticMarkup as render } from 'react-dom/server'
import PatientHomeCard from './PatientHomeCard.jsx'
import TherapySessionTab from './TherapySessionTab.jsx'

const game = (name, status, plays, masteredPlays = plays) => ({ gameId: name, name, status, masteredPlays, plays, required: 3 })
const base = { patientId: 'p1', name: 'Rene Baterbonia', firstName: 'Rene', setId: 's1', setNumber: 1, startedAt: '2026-10-21T02:00:00Z', assignedAt: '2026-10-21T02:00:00Z', useAtHome: true, nextSession: null, history: [], dismissed: false }
const card = (p) => render(h(PatientHomeCard, { patient: { ...base, ...p }, onChoose() {}, onKeep() {}, openSetup() {} }))

describe('patient home card', () => {
  const done = [game('Money Match', 'mastered', 3), game('Copy the Colors', 'mastered', 3), game('Sort the Basket', 'mastered', 3)]
  it('complete set without a SOAP note: banner asks for the note first and locks Choose new games', () => {
    const html = card({ games: done, complete: true, needsNew: true, soapDone: false, playedCount: 3 })
    expect(html).toContain('Write SOAP note')
    expect(html).toMatch(/<button[^>]*disabled[^>]*>Choose new games →/)
  })
  it('complete set: gold game cards, "Set complete" and the celebration banner with both buttons', () => {
    const html = card({ games: done, complete: true, needsNew: true, soapDone: true, playedCount: 3 })
    expect(html).toContain('✓ Set complete')
    expect(html).toContain('★ Mastered')
    expect(html).toContain('All 3 home games finished!')
    expect(html).toContain('Choose new games →')
    expect(html).not.toContain('Write SOAP note')
    expect(html).toContain('Keep this set')
    expect(html).toContain('3 of 3')
  })
  it('finished with imperfect plays shows the Finished pill', () => {
    expect(card({ games: [game('Money Match', 'finished', 3, 1)], complete: true, needsNew: false, playedCount: 1 })).toContain('✓ Finished')
  })
  it('kept set: no banner, but a way to choose new games later', () => {
    const html = card({ games: done, complete: true, needsNew: false, dismissed: true, soapDone: true, playedCount: 3 })
    expect(html).not.toContain('All 3 home games finished!')
    expect(html).toContain('Choose new games')
  })
  it('partly mastered: per-game progress and no banner', () => {
    const html = card({ games: [game('Money Match', 'practicing', 1, 0), game('Puzzle Pals', 'not_started', 0)], complete: false, needsNew: false, playedCount: 1 })
    expect(html).toContain('▶ Practicing')
    expect(html).toContain('○ Not started')
    expect(html).toContain('1 of 3')
    expect(html).toContain('1 of 2 played')
    expect(html).not.toContain('Choose new games')
    expect(html).toContain('Home practice on')
  })
  it('a new set shows its badge, next session and the collapsed history row', () => {
    const html = card({ setNumber: 2, assignedAt: new Date().toISOString(), nextSession: { date: '2026-11-15', start: '10:00' }, games: [game('Puzzle Pals', 'not_started', 0)], complete: false, needsNew: false, playedCount: 0, history: [{ setId: 'h1', setNumber: 1, startedAt: '2026-10-21T02:00:00Z', completedAt: '2026-11-08T02:00:00Z', games: ['Money Match'] }] })
    expect(html).toContain('● New set active')
    expect(html).toContain('assigned today · next session Nov 15, 10:00')
    expect(html).toContain('Set 1 · completed Nov 8')
    expect(html).toContain('View history')
  })
  it('no games: offers to set up home practice', () => {
    expect(card({ games: [], complete: false, needsNew: false, playedCount: 0 })).toContain('Set up home practice')
  })
})

describe('therapy tab banner', () => {
  it('points to the Home practice tab only when a patient needs new games', () => {
    expect(render(h(TherapySessionTab, { needsNew: [{ firstName: 'Rene' }], onGoHome() {} }, 'x'))).toContain('Home practice is managed separately.')
    expect(render(h(TherapySessionTab, { needsNew: [], onGoHome() {} }, 'x'))).not.toContain('managed separately')
  })
})
