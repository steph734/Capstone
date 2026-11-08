// Render checks for the Home practice tab pieces (run with:  npx vitest run src/pages/therapist/assign/homeSets).
import { describe, expect, it } from 'vitest'
import { createElement as h } from 'react'
import { MemoryRouter } from 'react-router-dom'
import { renderToStaticMarkup as render } from 'react-dom/server'
import PatientHomeCard from './PatientHomeCard.jsx'
import TherapySessionTab from './TherapySessionTab.jsx'

const game = (name, status, plays, masteredPlays = plays) => ({ gameId: name, name, status, masteredPlays, plays, required: 3 })
const base = { patientId: 'p1', name: 'Rene Baterbonia', firstName: 'Rene', setId: 's1', setNumber: 1, startedAt: '2026-10-21T02:00:00Z', assignedAt: '2026-10-21T02:00:00Z', useAtHome: true, nextSession: null, history: [], dismissed: false }
const card = (p) => render(h(MemoryRouter, null, h(PatientHomeCard, { patient: { ...base, ...p }, onReview() {}, onRetry() {}, openSetup() {} })))

describe('patient home card', () => {
  const list = (p) => ({ n: 1, accuracy: p, seconds: 60 })
  const done = [game('Money Match', 'finished', 3, 3), game('Copy the Colors', 'finished', 3, 1), game('Sort the Basket', 'mastered', 3, 3)].map((g) => ({ ...g, playList: [list(100), list(90), list(60)] }))
  const sums = { playsUsed: 9, playsAllowed: 9 }
  const rec = { games: [{ gameId: 'p', name: 'Puzzle Pals', reasons: ["Resistance is Rene's lowest stat (7 / 100), and Puzzle Pals builds it"] }, { gameId: 'f', name: 'Feed Pao', reasons: ['New for Rene'] }], reviewGame: null }
  const ready = { ...sums, games: done, complete: true, draftReady: true, soapDraftId: 'n1', homePlays: 9, therapyPlays: 3, recommendation: rec }
  it('finished set: two drafts are ready, nothing is assigned, step 3 stays locked until the note is signed', () => {
    const html = card({ ...ready, soapDone: false, needsSoap: true })
    expect(html).toContain('✓ Set finished')
    expect(html).toContain('Set 1 finished! Two drafts are ready')
    expect(html).toContain('Nothing changes for Rene until you review and approve')
    expect(html).toContain('SOAP note draft')
    expect(html).toContain('9 home plays')
    expect(html).toContain('Subjective needs your caregiver input')
    expect(html).toContain('Review SOAP note →')
    expect(html).toContain('Recommended Set 2')
    expect(html).toContain('Puzzle Pals + Feed Pao')
    expect(html).toContain('See why →')
    expect(html).toContain('Assign unlocks after the note is signed')
    expect(html).toContain('9 of 9 plays done')
    expect(html).toContain('★ Finished')
    expect(html).toContain('PLAY 1')
    expect(html).not.toContain('Review next set')
  })
  it('a draft that was started says Draft in progress', () => {
    expect(card({ ...ready, soapDone: false, draftTouched: true })).toContain('Draft in progress · Continue note →')
  })
  it('after signing: signed tag and Review next set', () => {
    const html = card({ ...ready, soapDone: true, soapAt: '2026-11-08T02:00:00Z' })
    expect(html).toContain('✓ Signed')
    expect(html).toContain('Signed Nov 8')
    expect(html).toContain('Review next set →')
    expect(html).not.toContain('Review SOAP note →')
  })
  it('drafts not ready yet: preparing message and a retry', () => {
    const html = card({ ...sums, games: done, complete: true, draftReady: false })
    expect(html).toContain('Preparing the SOAP note draft')
    expect(html).toContain('Try again')
  })
  it('partly played: Playing pill, play chips and no banner', () => {
    const g = { ...game('Money Match', 'practicing', 2, 0), playList: [list(60), list(80)] }
    const html = card({ playsUsed: 2, playsAllowed: 6, games: [g, game('Puzzle Pals', 'not_started', 0)], complete: false })
    expect(html).toContain('▶ Playing')
    expect(html).toContain('○ Not started')
    expect(html).toContain('2 of 3')
    expect(html).toContain('2 of 6 plays used')
    expect(html).not.toContain('finished every home game')
    expect(html).toContain('Home practice on')
  })
  it('a new set shows its badge, next session and the collapsed history row', () => {
    const html = card({ ...sums, playsUsed: 0, playsAllowed: 3, setNumber: 2, assignedAt: new Date().toISOString(), nextSession: { date: '2026-11-15', start: '10:00' }, games: [game('Puzzle Pals', 'not_started', 0)], complete: false, history: [{ setId: 'h1', setNumber: 1, startedAt: '2026-10-21T02:00:00Z', completedAt: '2026-11-08T02:00:00Z', games: ['Money Match'] }] })
    expect(html).toContain('● New set active')
    expect(html).toContain('assigned today · next session Nov 15, 10:00')
    expect(html).toContain('Set 1 · completed Nov 8')
    expect(html).toContain('View history')
  })
  it('no games: offers to set up home practice', () => {
    expect(card({ ...sums, games: [], complete: false })).toContain('Set up home practice')
  })
})

describe('therapy tab banner', () => {
  it('points to the Home practice tab only when a patient needs new games', () => {
    expect(render(h(TherapySessionTab, { needsNew: [{ firstName: 'Rene' }], onGoHome() {} }, 'x'))).toContain('Home practice is managed separately.')
    expect(render(h(TherapySessionTab, { needsNew: [], onGoHome() {} }, 'x'))).not.toContain('managed separately')
  })
})
