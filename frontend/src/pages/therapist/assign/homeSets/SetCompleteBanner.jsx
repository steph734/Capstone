// Shown when every game in a patient's home set is finished (all 3 plays used). Two steps: write the SOAP note about the home practice,
// then choose the next set. "Keep this set" hides this banner for this set only (saved on the server).
export default function SetCompleteBanner({ patient, onChoose, onSoap, onKeep, keeping }) {
  const n = patient.games.length
  return (
    <div className="hs-banner" role="status">
      <img src="/games/pao-money-match-poses/pao-level-complete.png" alt="" width="96" height="96" />
      <div className="hs-banner-text">
        <h4>All {n} home games finished! <span aria-hidden="true">🎉</span></h4>
        <p>{patient.firstName} used all {patient.games[0]?.required ?? 3} plays of every game. {patient.soapDone ? 'The SOAP note is saved. Pick a new set of games for the next therapy session and home practice.' : 'Write the SOAP note for this home practice, then pick the next set of games.'}</p>
        <ol className="hs-steps"><li className={patient.soapDone ? 'done' : 'now'}>{patient.soapDone ? '✓' : '1'} SOAP note</li><li className={patient.soapDone ? 'now' : ''}>2 Choose new games</li></ol>
      </div>
      <div className="hs-banner-actions">
        {!patient.soapDone && <button type="button" className="hs-btn green" onClick={onSoap}>Write SOAP note</button>}
        <button type="button" className={`hs-btn${patient.soapDone ? ' green' : ''}`} onClick={onChoose} disabled={!patient.soapDone} title={patient.soapDone ? '' : 'Write the SOAP note first'}>Choose new games →</button>
        {patient.soapDone && <button type="button" className="hs-link" onClick={onSoap}>Write another note</button>}
        <button type="button" className="hs-btn" onClick={onKeep} disabled={keeping}>{keeping ? 'Saving…' : 'Keep this set'}</button>
      </div>
    </div>
  )
}
