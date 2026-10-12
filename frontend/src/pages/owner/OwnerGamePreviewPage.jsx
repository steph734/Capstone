import { useParams } from 'react-router-dom'
import GamifiedFullPage from '../GamifiedFullPage'

// /owner/gamified-activities/preview/:gameKey — opens one game from the
// Activity Library in demo mode. There is no ActivitySessionProvider and no
// patient identity here, so the game's PaoProvider has no player: no session
// is started on the server and no score, XP or badge is recorded.
export default function OwnerGamePreviewPage() {
  const { gameKey } = useParams()
  return (
    <>
      <div role="status" style={{ position: 'fixed', top: 10, left: '50%', transform: 'translateX(-50%)', zIndex: 10000, pointerEvents: 'none', background: '#234C40', color: '#fff', borderRadius: 999, padding: '6px 14px', fontSize: 12, fontWeight: 800, fontFamily: "'Segoe UI',system-ui,sans-serif", boxShadow: '0 2px 10px rgba(0,0,0,.2)' }}>
        Preview mode · scores aren't saved
      </div>
      <GamifiedFullPage backPath="/owner/gamified-activities/library" previewGameId={gameKey} />
    </>
  )
}
