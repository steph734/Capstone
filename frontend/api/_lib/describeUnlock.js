// Server-side mirror of src/pages/admin/PaoClothingDesigner.jsx's
// describeUnlock() — same wording, used for the wardrobe's "how to unlock"
// text so the patient sees the same language the admin saw while building
// the item. `games_in_a_row` reads "N games in a row" (finish streak), not
// "N days in a row" — see game-sessions-complete.js for why.
export function describeUnlock(type, { gameId, value, badgeCode } = {}, gameNameById = new Map(), badgeNameByCode = new Map()) {
  if (!type) return null
  switch (type) {
    case 'free':
      return 'Available to everyone'
    case 'complete_specific_game': {
      const name = gameId ? gameNameById.get(String(gameId)) : null
      return `Finish ${name || 'a specific game'}`
    }
    case 'complete_any_game':
      return value && value > 1 ? `Finish ${value} games` : 'Finish any game for the first time'
    case 'perfect_score':
      return 'Get every answer right on the first try'
    case 'reach_level':
      return `Reach level ${value ?? 5}`
    case 'total_xp':
      return `Earn ${value ?? 500} XP`
    case 'games_in_a_row':
      return `Finish ${value ?? 5} games in a row`
    case 'all_categories':
      return 'Try every therapy game category'
    case 'earn_badge': {
      const name = badgeCode ? badgeNameByCode.get(badgeCode) : null
      return `Earn the "${name || badgeCode || '…'}" badge`
    }
    default:
      return null
  }
}
