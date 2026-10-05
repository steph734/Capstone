// Pure logic for Spot the Difference (no React), so it is easy to test.
// Differences are stored as percentages of the picture: x, y = centre (0-100),
// r = tap radius as a percentage of the picture width.

// Pictures are 5:3 (width : height), so a height percentage is 5/3 of a width percentage.
const HEIGHT_PER_WIDTH = 3 / 5;

/** Playable levels from the games document (only ones with two pictures and differences). */
export function buildLevels(game) {
  const defaultAuto = game?.type_settings?.choose_picture?.auto_clue_after_misses ?? 5;
  return [...(game?.levels || [])]
    .sort((a, b) => a.level_order - b.level_order)
    .flatMap((level) =>
      (level.items || [])
        .filter((item) => item.image_b_url && item.differences?.length)
        .map((item) => ({
          order: level.level_order,
          name: level.level_name,
          label: item.label,
          question: item.question,
          imageA: item.image_url,
          imageB: item.image_b_url,
          differences: item.differences,
          autoClueAfter: defaultAuto,
        }))
    );
}

/** Index of the difference under the tap, or -1. Nearest one wins if two overlap. */
export function hitTest(level, xPct, yPct) {
  let best = -1;
  let bestDist = Infinity;
  level.differences.forEach((d, i) => {
    const dx = xPct - d.x;
    const dy = (yPct - d.y) * HEIGHT_PER_WIDTH;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist <= d.r && dist < bestDist) {
      best = i;
      bestDist = dist;
    }
  });
  return best;
}

export function initLevel() {
  return {
    found: [],       // indices of found differences
    misses: 0,       // misses in a row (resets on a find or an auto clue)
    totalMisses: 0,
    attempts: 0,
    stars: 0,
    helpStage: 0,    // 0 = Help me (say clue), 1 = Show me (draw the circle)
    glow: -1,        // index shown with the dashed amber circle
    shows: 0,
    hints: 0,
    phase: "play",   // play | done
    event: null,     // found | already | miss | auto-clue | done
    message: null,   // { text, tone: 'good' | 'try' }
  };
}

/** Next difference the patient has not found yet (-1 if all are found). */
export function nextUnfound(state, level) {
  for (let i = 0; i < level.differences.length; i++) {
    if (!state.found.includes(i)) return i;
  }
  return -1;
}

/** A tap on the picture at (xPct, yPct). Returns the new state. */
export function tapPicture(state, level, xPct, yPct) {
  if (state.phase !== "play") return state;
  const idx = hitTest(level, xPct, yPct);
  const attempts = state.attempts + 1;

  if (idx >= 0 && state.found.includes(idx)) {
    return { ...state, attempts, event: "already", message: { text: "You already found that one! Look for another.", tone: "try" } };
  }

  if (idx >= 0) {
    const found = [...state.found, idx];
    const done = found.length === level.differences.length;
    return {
      ...state,
      attempts,
      found,
      stars: state.stars + 1,
      misses: 0,
      helpStage: 0,
      glow: -1,
      phase: done ? "done" : "play",
      event: done ? "done" : "found",
      message: { text: level.differences[idx].say, tone: "good" },
    };
  }

  const misses = state.misses + 1;
  const totalMisses = state.totalMisses + 1;
  if (misses >= level.autoClueAfter) {
    const next = nextUnfound(state, level);
    return {
      ...state,
      attempts,
      misses: 0,
      totalMisses,
      event: "auto-clue",
      message: { text: level.differences[next].clue, tone: "try" },
    };
  }
  return { ...state, attempts, misses, totalMisses, event: "miss", message: { text: "Hmm, look again!", tone: "try" } };
}

/** "Help me" first says the clue; pressed again ("Show me") it draws the circle. */
export function helpPress(state, level) {
  if (state.phase !== "play") return state;
  const next = nextUnfound(state, level);
  if (next < 0) return state;

  if (state.helpStage === 0) {
    return {
      ...state,
      helpStage: 1,
      hints: state.hints + 1,
      event: "clue",
      message: { text: level.differences[next].clue, tone: "good" },
    };
  }
  return {
    ...state,
    glow: next,
    shows: state.shows + 1,
    hints: state.hints + 1,
    event: "show",
    message: { text: "Look here!", tone: "good" },
  };
}
