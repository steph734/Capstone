import { Archive, Check, CircleCheck, Copy, EllipsisVertical, EyeOff, FlaskConical, Pencil, Star, Trash2, Users, X } from 'lucide-react'
import { ICON_MAP, peso, monthsFree, monthsFreeText } from './planConstants'

const MAX_ROWS = 6

function StatusPill({ status }) {
  if (status === 'beta') return <span className="pcx-pill purple"><FlaskConical size={13} aria-hidden="true" /> Beta</span>
  if (status === 'hidden') return <span className="pcx-pill gray"><EyeOff size={13} aria-hidden="true" /> Hidden</span>
  return <span className="pcx-pill green"><CircleCheck size={13} aria-hidden="true" /> Live</span>
}

// One component for both places a plan appears: the Super Admin grid
// (variant="admin") and the live preview in the Add/Edit plan modal
// (variant="preview"), so the preview is exactly what the card will look like.
export default function PlanCard({
  plan, features, variant = 'admin', menuOpen = false, onMenu, onSubscribers, onEdit, onBeta, onToggleHidden, onDuplicate, onDelete, onArchive,
}) {
  const preview = variant === 'preview'
  const Icon = ICON_MAP[plan.icon] || ICON_MAP.rocket
  const byKey = new Map(features.map((f) => [f.key, f]))
  const included = plan.featureKeys.map((k) => byKey.get(k)).filter(Boolean)
  let rows = included.map((f) => ({ f, on: true }))
  if (!preview) {
    const have = new Set(plan.featureKeys)
    rows = [...rows, ...features.filter((f) => !have.has(f.key)).map((f) => ({ f, on: false }))]
  }
  const shown = preview ? rows : rows.slice(0, MAX_ROWS)
  const hidden = rows.length - shown.length
  const free = monthsFree(plan.priceMonthly, plan.priceYearly)
  const canDelete = plan.subscribers === 0 && !plan.isDefault
  const canArchive = plan.subscribers === 0 && !plan.isDefault

  return (
    <article className={`pcx-card${plan.mostPopular && !preview ? ' popular' : ''}${plan.status === 'hidden' ? ' is-hidden' : ''}${preview ? ' preview' : ''}`} style={{ '--accent': plan.color }}>
      {plan.mostPopular && !preview && <span className="pcx-ribbon"><Star size={13} aria-hidden="true" /> Most popular</span>}
      <header className="pcx-card-head">
        <span className="pcx-icon"><Icon size={24} aria-hidden="true" /></span>
        <div className="pcx-card-title">
          <h3>{plan.name || 'Plan name'} Plan</h3>
          <p>{plan.tagline || (preview ? 'Your tagline appears here' : '')}</p>
        </div>
        {!preview && (
          <div className="pcx-menu-wrap">
            <button type="button" className="pcx-icon-btn" aria-label={`Actions for ${plan.name}`} aria-haspopup="menu" aria-expanded={menuOpen}
              onClick={(e) => { e.stopPropagation(); onMenu(menuOpen ? null : plan.id) }}>
              <EllipsisVertical size={17} />
            </button>
            {menuOpen && (
              <div className="pcx-menu" role="menu" onClick={(e) => e.stopPropagation()}>
                <button type="button" role="menuitem" onClick={() => onBeta(plan)}><FlaskConical size={15} /> Manage beta testers</button>
                <button type="button" role="menuitem" onClick={() => onToggleHidden(plan)}>
                  {plan.status === 'hidden' ? <><CircleCheck size={15} /> Show plan</> : <><EyeOff size={15} /> Hide plan</>}
                </button>
                <button type="button" role="menuitem" onClick={() => onDuplicate(plan)}><Copy size={15} /> Duplicate</button>
                <button type="button" role="menuitem" disabled={!canArchive} onClick={() => onArchive(plan)}
                  title={plan.isDefault ? 'The Free plan is the fallback plan' : canArchive ? undefined : plan.subscribers == null ? 'Subscriber data is unavailable' : 'Hide the plan instead: it has subscribers'}>
                  <Archive size={15} /> Archive
                </button>
                <button type="button" role="menuitem" className="danger" disabled={!canDelete} onClick={() => onDelete(plan)}
                  title={canDelete ? undefined : plan.subscribers == null ? 'Subscriber data is unavailable' : 'Only plans with 0 subscribers can be deleted'}>
                  <Trash2 size={15} /> Delete
                </button>
              </div>
            )}
          </div>
        )}
      </header>

      <div className="pcx-pills">
        <StatusPill status={plan.status} />
        {plan.status === 'beta' && !preview && plan.betaTesters.length > 0 && (
          <span className="pcx-pill purple soft"><FlaskConical size={13} aria-hidden="true" /> {plan.betaTesters.length} beta tester{plan.betaTesters.length === 1 ? '' : 's'}</span>
        )}
        {plan.trialDays > 0 && <span className="pcx-pill gray soft">{plan.trialDays}-day free trial</span>}
      </div>

      <p className="pcx-price"><strong>{peso(plan.priceMonthly || 0)}</strong><span> / month</span></p>
      {preview && plan.priceYearly != null && (
        <p className="pcx-yearly">or {peso(plan.priceYearly)} / year{free ? ` (${monthsFreeText(free)})` : ''}</p>
      )}

      {!preview && (
        <>
          <div className="pcx-metrics">
            <div><strong>{plan.subscribers ?? '—'}</strong><span>subscribers</span></div>
            <div><strong>{plan.revenue == null ? '—' : peso(plan.revenue, { compact: true })}</strong><span>revenue / month</span></div>
          </div>
          <div className="pcx-share">
            <div><span>Share of subscribers</span><b>{plan.subscribers == null ? '—' : `${plan.share}%`}</b></div>
            <div className="pcx-share-bar" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={plan.share || 0} aria-label={`${plan.name} share of subscribers`}>
              <div style={{ width: `${plan.share || 0}%` }} />
            </div>
          </div>
        </>
      )}

      <ul className="pcx-features">
        {shown.map(({ f, on }) => (
          <li key={f.key} className={on ? '' : 'off'}>
            {on ? <Check size={16} aria-label="Included" /> : <X size={16} aria-label="Not included" />} {f.label}
          </li>
        ))}
        {preview && shown.length === 0 && <li className="off">No features ticked yet</li>}
        {hidden > 0 && <li className="more">+{hidden} more in Compare plans</li>}
      </ul>

      {preview ? (
        <button type="button" className="br-btn primary pcx-choose" tabIndex={-1} aria-disabled="true">Choose plan</button>
      ) : (
        <div className="pcx-actions">
          <button type="button" className="br-btn btn-line" onClick={() => onSubscribers(plan)}><Users size={16} /> Subscribers</button>
          <button type="button" className="br-btn primary" onClick={() => onEdit(plan)}><Pencil size={16} /> Edit plan</button>
        </div>
      )}
    </article>
  )
}
