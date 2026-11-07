// Celebration banner shown when every game in a patient's home set is mastered.
// "Choose new games" opens the picker; "Keep this set" hides this banner for this set only (saved on the server).
export default function SetCompleteBanner({ patient, onChoose, onKeep, keeping }) {
  const n = patient.games.length
  return (
    <div className="hs-banner" role="status">
      <img src="/games/pao-money-match-poses/pao-level-complete.png" alt="" width="96" height="96" />
      <div className="hs-banner-text">
        <h4>All {n} home games mastered! <span aria-hidden="true">🎉</span></h4>
        <p>Pick a new set of games for {patient.firstName}&apos;s next therapy session and home practice.</p>
      </div>
      <div className="hs-banner-actions">
        <button type="button" className="hs-btn green" onClick={onChoose}>Choose new games →</button>
        <button type="button" className="hs-btn" onClick={onKeep} disabled={keeping}>{keeping ? 'Saving…' : 'Keep this set'}</button>
      </div>
    </div>
  )
}
