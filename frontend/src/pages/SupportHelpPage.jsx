import OwnerPageShell from './owner/OwnerPageShell'
import TherapistPageShell from './therapist/TherapistPageShell'
import { getOwnerMenuItems } from './owner/ownerSidebarConfig'
import { getTherapistMenuItems } from './therapist/therapistSidebarConfig'
import SupportCenter from '../components/support/SupportCenter'

// /help for owners and therapists (guardians keep the existing Help page, which
// embeds the same SupportCenter). Pao, bottom right, answers quick questions;
// anything it can't answer becomes a ticket here.
export default function SupportHelpPage({ user, onLogout, betaTier }) {
  const owner = user?.role === 'Owner'
  const Shell = owner ? OwnerPageShell : TherapistPageShell
  return (
    <Shell user={user} onLogout={onLogout} title="Help & Support" subtitle="Ask Pao, or send a ticket to our support team" menuItems={owner ? getOwnerMenuItems(betaTier) : getTherapistMenuItems(betaTier)}>
      <div style={{ maxWidth: 760, background: '#fff', border: '1px solid #e3e8e4', borderRadius: 20, padding: 20 }}>
        <p style={{ marginTop: 0, color: '#5d7770', fontSize: 14, lineHeight: 1.5 }}>
          We usually reply within 4 hours. You will see a red dot on Pao and get a notification when we do. For quick how-to questions, tap Pao at the bottom right.
        </p>
        <SupportCenter isOwner={owner} />
      </div>
    </Shell>
  )
}
