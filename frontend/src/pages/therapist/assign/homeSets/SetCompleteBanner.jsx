import { useNavigate } from 'react-router-dom'
import Steps from './Steps'
import { gameEmoji, shortDay } from './gameIcons'

// A finished set: two drafts are ready for the therapist to review and approve (nothing is signed, shared or assigned automatically).
//   SOAP note draft   "Review SOAP note →" opens it in Notes & Progress; after signing it says signed and the next step unlocks
//   Recommended Set N+1  "See why →" opens the recommendation with a reason for every game (assigning stays locked until the note is signed)
export default function SetCompleteBanner({ patient: p, onReview, onRetry }) {
  const navigate = useNavigate()
  const names = p.recommendation?.games.map((g) => g.name) || []
  const signed = p.soapDone
  const openNote = () => navigate(`/therapist/notes-progress?patient=${p.patientId}&draft=${p.soapDraftId}`)

  if (!p.draftReady) {
    return (
      <div className="hs-finish">
        <div className="hs-banner" role="status">
          <img src="/games/pao-money-match-poses/pao-thumbs-up.png" alt="" width="96" height="96" />
          <div className="hs-banner-text">
            <h4>Set {p.setNumber} finished! <span aria-hidden="true">🎉</span></h4>
            <p>{p.draftsError ? "The drafts couldn't be prepared. Write the note manually or try again." : 'Preparing the SOAP note draft and the recommended next set…'}</p>
          </div>
          <div className="hs-banner-actions"><button type="button" className="hs-btn" onClick={onRetry}>Try again</button></div>
        </div>
        <Steps step={2} playsText={`${p.playsUsed} of ${p.playsAllowed} plays done`} labels={[['Home games finished', ''], ['Review SOAP note', 'Preparing draft'], ['Assign new set', 'Locked']]} />
      </div>
    )
  }
  return (
    <div className="hs-finish">
      <div className="hs-banner" role="status">
        <img src="/games/pao-money-match-poses/pao-thumbs-up.png" alt="" width="96" height="96" />
        <div className="hs-banner-text">
          <h4>Set {p.setNumber} finished! Two drafts are ready <span aria-hidden="true">🎉</span></h4>
          <p>Drafted automatically from {p.firstName}&apos;s play data. Nothing changes for {p.firstName} until you review and approve.</p>
        </div>
        <span className="hs-auto-pill">✨ Auto-drafted</span>
      </div>

      <div className="hs-drafts">
        <section className="hs-draft" aria-label="SOAP note draft">
          <header><span className="hs-draft-ico" aria-hidden="true">📝</span><h5>SOAP note draft</h5><span className={`hs-draft-tag${signed ? ' ok' : ''}`}>{signed ? '✓ Signed' : p.draftTouched ? 'In progress' : 'Ready to review'}</span></header>
          <p>{signed ? `Signed ${shortDay(p.soapAt)}. It is saved in ${p.firstName}'s Notes & Progress.` : <>Written from {p.firstName}&apos;s <b>{p.homePlays} home plays</b> and <b>{p.therapyPlays} therapy plays</b>. All four parts are drafted. <span className="hs-mark">Subjective needs your caregiver input.</span></>}</p>
          <div className="hs-soap-badges" aria-hidden="true">{['S', 'O', 'A', 'P'].map((l) => <span key={l} className={`b-${l}`}>{l}</span>)}</div>
          <div className="hs-draft-actions">
            {signed
              ? <button type="button" className="hs-btn green" onClick={onReview}>Review next set →</button>
              : <button type="button" className="hs-btn green" onClick={openNote}>{p.draftTouched ? 'Draft in progress · Continue note →' : 'Review SOAP note →'}</button>}
            <span>{signed ? 'Next set is unlocked' : 'You edit and save it'}</span>
          </div>
        </section>

        <section className="hs-draft" aria-label={`Recommended Set ${p.setNumber + 1}`}>
          <header><span className="hs-draft-ico blue" aria-hidden="true">🎮</span><h5>Recommended Set {p.setNumber + 1}</h5><span className="hs-draft-tag amber">Suggested</span></header>
          <div className="hs-rec-games">
            <span className="hs-rec-ico">{names.map((n) => <i key={n}>{gameEmoji(n)}</i>)}</span>
            <div><b>{names.join(' + ') || 'No suggestion yet'}</b><p style={{ margin: '2px 0 0' }}>Picked from Set {p.setNumber} results, {p.firstName}&apos;s lowest character stat, and the next objectives.</p></div>
          </div>
          {p.recommendation?.games[0]?.reasons.length > 0 && <ul className="hs-reasons">{p.recommendation.games.flatMap((g) => g.reasons.slice(0, 1)).slice(0, 2).map((r) => <li key={r}>✓ {r}</li>)}</ul>}
          <div className="hs-draft-actions">
            <button type="button" className="hs-btn blue-outline" onClick={onReview}>See why →</button>
            <span>{signed ? 'You can assign it now' : 'Assign unlocks after the note is signed'}</span>
          </div>
        </section>
      </div>

      <Steps step={signed ? 3 : 2} playsText={`${p.playsUsed} of ${p.playsAllowed} plays done`} labels={[['Home games finished', ''], ['Review SOAP note', signed ? 'Signed' : 'Draft ready'], ['Assign new set', 'Suggested set ready']]} />
    </div>
  )
}
