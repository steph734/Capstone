// Short, friendly tips shown while a game loads. A game can bring its own `tips` in the registry.
export const GENERAL_TIPS = [
  'Tap the speaker to hear it again.',
  'Take your time, there is no rush!',
  'Pao will help if you get stuck.',
  'Every try makes you stronger.',
]

export const pickTip = (gameTips = []) => {
  const pool = gameTips.length ? gameTips : GENERAL_TIPS
  return pool[Math.floor(Math.random() * pool.length)]
}
