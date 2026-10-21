import { PAO_BASE } from '../../../components/pao/PaoSprite'
import { preloadRewardPoses } from '../rewards/paoRewardPoses'

// The 6 loading poses live in public/games/Pao_v3/svg/ and are loaded by URL (never imported).
const base = import.meta.env.BASE_URL || '/'
const pose = (name) => `${base.replace(/\/$/, '')}${PAO_BASE}/pao-${name}.svg`

export const loadingPoses = {
  hello: pose('hello'),
  stretch: pose('stretch'),
  juggle: pose('juggle'),
  carry: pose('carry'),
  ready: pose('ready'),
  slow: pose('slow'),
}

export const FALLBACK_PAO = `${base}pao.png`

let preloaded = null
// Called once when the Gamified Activities page opens, so the modal never waits for its own art.
export function preloadLoadingPao() {
  preloadRewardPoses() // the 9 reward poses are preloaded together with these
  if (!preloaded) {
    preloaded = Promise.all(Object.entries(loadingPoses).map(([name, src]) => new Promise((resolve) => {
      const img = new Image()
      img.onload = () => resolve(true)
      img.onerror = () => { console.warn(`Game loading: Pao pose "${name}" did not load (${src})`); resolve(false) }
      img.src = src
    })))
  }
  return preloaded
}
