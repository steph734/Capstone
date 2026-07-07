import OwnerPageShell from './OwnerPageShell'
import { getOwnerMenuItems } from './ownerSidebarConfig'
import SpeechFeaturesUI from '../SpeechFeaturesUI'

export default function OwnerSpeechFeaturesPage({ user, onLogout, betaTier }) {
  return (
    <OwnerPageShell
      user={user}
      onLogout={onLogout}
      title="Speech Features"
      subtitle="Voice recorder and text-to-speech tools"
      icon="🎙️"
      menuItems={getOwnerMenuItems(betaTier)}
    >
      <SpeechFeaturesUI />
    </OwnerPageShell>
  )
}
