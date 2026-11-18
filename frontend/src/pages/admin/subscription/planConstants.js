import { Crown, Gem, Heart, Medal, Rocket, Shield, Sprout } from 'lucide-react'

export const ICON_MAP = { sprout: Sprout, medal: Medal, crown: Crown, gem: Gem, rocket: Rocket, shield: Shield, heart: Heart }
export const ICON_LABEL = { sprout: 'Sprout', medal: 'Medal', crown: 'Crown', gem: 'Gem', rocket: 'Rocket', shield: 'Shield', heart: 'Heart' }
export const COLORS = [
  { value: '#1fa37a', label: 'Green' },
  { value: '#3b82c4', label: 'Blue' },
  { value: '#e0a526', label: 'Gold' },
  { value: '#7c5ce0', label: 'Purple' },
  { value: '#e0508f', label: 'Pink' },
  { value: '#5b6b66', label: 'Slate' },
]

export const peso = (n, { compact = false } = {}) => new Intl.NumberFormat('en-PH', {
  style: 'currency', currency: 'PHP',
  notation: compact && n >= 10000 ? 'compact' : 'standard',
  maximumFractionDigits: compact && n >= 10000 ? 1 : (Number.isInteger(n) ? 0 : 2),
}).format(n || 0)

// "N months free" for paying yearly: round((12 * monthly - yearly) / monthly, 1). Only when yearly is set and cheaper than 12 months.
export function monthsFree(monthly, yearly) {
  if (yearly == null || !(monthly > 0) || !(yearly > 0) || yearly >= 12 * monthly) return null
  const n = Math.round(((12 * monthly - yearly) / monthly) * 10) / 10
  return n > 0 ? n : null
}
export const monthsFreeText = (n) => `${n} month${n === 1 ? '' : 's'} free`

export function tierTag(feature, plans) {
  if (feature.minTier === 'all') return 'All plans'
  if (!feature.minTier) return 'New'
  const p = plans.find((x) => x.slug === feature.minTier)
  return p ? `${p.name}+` : 'New'
}

export const STATUS_LABEL = { live: 'Live', beta: 'Beta', hidden: 'Hidden' }
