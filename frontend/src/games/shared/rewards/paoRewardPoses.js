// Pao's 9 reward poses live in public/games/rewards/ and are loaded by URL (never imported).
const base = import.meta.env.BASE_URL || '/'
const pose = (name) => `${base}games/rewards/pao-${name}.svg`

export const rewardPoses = {
  badge: pose('badge'),
  xp: pose('xp'),
  levelUp: pose('level-up'),
  stats: pose('stats'),
  gift: pose('gift'),
  wearing: pose('wearing'),
  allDone: pose('all-done'),
  replay: pose('replay'),
  keepGoing: pose('keep-going'),
}

export const FALLBACK_PAO = `${base}pao.png`

let preloaded = null
// Called once when the Gamified Activities page opens (with the loading poses), so the flow never waits for images.
export function preloadRewardPoses() {
  if (!preloaded) {
    preloaded = Promise.all(Object.entries(rewardPoses).map(([name, src]) => new Promise((resolve) => {
      const img = new Image()
      img.onload = () => resolve(true)
      img.onerror = () => { console.warn(`Rewards: Pao pose "${name}" did not load (${src})`); resolve(false) }
      img.src = src
    })))
  }
  return preloaded
}
