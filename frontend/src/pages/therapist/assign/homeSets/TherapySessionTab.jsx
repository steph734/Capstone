// Therapy session tab: everything the page already had (today's schedule, alerts, play time, games for the session),
// plus a banner when a patient finished all their home games. The home-practice work itself lives in the other tab.
export default function TherapySessionTab({ needsNew, onGoHome, children }) {
  return (
    <div role="tabpanel" id="panel-therapy" aria-labelledby="tab-therapy" className="hs-therapy">
      {needsNew.length > 0 && (
        <div className="hs-note" role="status">
          <span aria-hidden="true" className="hs-note-ico">🏠</span>
          <p><b>Home practice is managed separately.</b> {needsNew.map((p) => p.firstName).join(' and ')} finished all home games — pick the next set in the Home practice tab.</p>
          <button type="button" className="hs-btn blue" onClick={onGoHome}>Go to Home practice →</button>
        </div>
      )}
      {children}
    </div>
  )
}
