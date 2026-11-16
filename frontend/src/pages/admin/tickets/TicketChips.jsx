import { ArrowDown, ArrowUp, ChevronsUp, Check, Circle, CircleDot, PauseCircle, Timer } from 'lucide-react'
import { CATEGORY_LABEL, PRIORITY_META, ROLE_LABEL, STATUS_META, formatAge, initials } from './ticketConfig'

const STATUS_ICON = { circle: Circle, half: CircleDot, pause: PauseCircle, check: Check }
const PRI_ICON = { up2: ChevronsUp, up: ArrowUp, down: ArrowDown }
// Status and priority always carry a text label plus a symbol, so they never rely on colour alone.
export function StatusChip({ status }) {
  const m = STATUS_META[status] || { label: status, icon: 'circle', tone: 'open' }
  return <span className={`tk-chip tk-status tk-status-${m.tone}`}>{(() => { const I = STATUS_ICON[m.icon] || Circle; return <I size={12} aria-hidden="true" /> })()} {m.label}</span>
}
export function PriorityChip({ priority }) {
  const m = PRIORITY_META[priority] || PRIORITY_META.normal
  return <span className={`tk-chip tk-pri tk-pri-${priority}`}>{(() => { const I = PRI_ICON[m.icon]; return I ? <I size={12} aria-hidden="true" /> : null })()}{m.label}</span>
}
export const CategoryChip = ({ category }) => <span className="tk-chip tk-cat">{CATEGORY_LABEL[category] || category}</span>
export const RoleChip = ({ role }) => <span className={`tk-role tk-role-${role}`}>{ROLE_LABEL[role] || role}</span>
export const AgeBadge = ({ ms }) => <span className="tk-chip tk-age"><Timer size={12} aria-hidden="true" /> {formatAge(ms)} old</span>
export const AgeChip = ({ ms }) => <span className="tk-chip tk-age tk-age-soft"><Timer size={12} aria-hidden="true" /> {formatAge(ms)} old</span>
export const Avatar = ({ name, size = 40 }) => <span className="tk-avatar" style={{ width: size, height: size }} aria-hidden="true">{initials(name)}</span>
