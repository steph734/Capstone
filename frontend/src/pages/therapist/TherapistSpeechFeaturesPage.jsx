import TherapistPageShell from './TherapistPageShell'
import { getTherapistMenuItems } from './therapistSidebarConfig'
import SpeechFeaturesUI from '../SpeechFeaturesUI'

export default function TherapistSpeechFeaturesPage({ user, onLogout, betaTier }) {
  return (
    <TherapistPageShell
      user={user}
      onLogout={onLogout}
      title="Speech Features"
      subtitle="Voice recorder and text-to-speech tools"
      icon="🎙️"
      menuItems={getTherapistMenuItems(betaTier)}
      beta={betaTier === 'silver' || betaTier === 'gold'}
    >
      <SpeechFeaturesUI />
    </TherapistPageShell>
  )
}
