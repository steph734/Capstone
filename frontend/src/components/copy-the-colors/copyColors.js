// Pure logic for Copy the Colors (no React, no timers), so it is easy to test.

export const DEFAULT_PADS = [
  { key: "red", label: "Red", shape: "circle", color: "#E5484D", lit: "#FF6B70", ring: "#B8323A" },
  { key: "blue", label: "Blue", shape: "square", color: "#2F6FD6", lit: "#5B94F2", ring: "#1F4FA8" },
  { key: "green", label: "Green", shape: "triangle", color: "#2F9E4A", lit: "#4CC46A", ring: "#1F7A36" },
  { key: "yellow", label: "Yellow", shape: "star", color: "#E6A700", lit: "#FFC933", ring: "#B07F00" },
];

export const SPEEDS = {
  slow: { on: 1000, off: 400 },
  normal: { on: 650, off: 250 },
};

/** Read pads and levels from the games document (falls back to defaults). */
export function buildConfig(game) {
  const settings = game?.type_settings?.step_by_step || {};
  const levels = [...(game?.levels || [])].sort((a, b) => a.level_order - b.level_order);
  const padItems = levels[0]?.items?.length ? [...levels[0].items].sort((a, b) => (a.step_order ?? 0) - (b.step_order ?? 0)) : [];
  const pads = padItems.length
    ? padItems.map((it, i) => ({
        key: it.pad_key || DEFAULT_PADS[i]?.key || String(i),
        label: it.label,
        shape: it.shape || DEFAULT_PADS[i]?.shape,
        color: it.color || DEFAULT_PADS[i]?.color,
        lit: it.lit_color || DEFAULT_PADS[i]?.lit,
        ring: it.ring_color || DEFAULT_PADS[i]?.ring,
        image_url: it.image_url,
        audio_url: it.audio_url,
      }))
    : DEFAULT_PADS;
  return {
    pads,
    speed: settings.speed_default === "normal" ? "normal" : "slow",
    levels: levels.length
      ? levels.map((l) => ({
          order: l.level_order,
          name: l.level_name,
          start: l.start_length ?? 2,
          goal: l.goal_length ?? 5,
          promptLevel: l.prompt_level || "partial",
        }))
      : [{ order: 1, name: "Warm-up", start: 2, goal: 5, promptLevel: "partial" }],
  };
}

/** "Red circle" */
export const fullName = (pad) => `${pad.label} ${pad.shape}`;

/** Next random pad; avoids repeating the previous pad most of the time (easier to see). */
export function nextPad(padCount, prev = -1, random = Math.random) {
  let p = Math.floor(random() * padCount);
  if (p === prev && random() < 0.6) p = (p + 1 + Math.floor(random() * (padCount - 1))) % padCount;
  return p;
}

export function makePattern(length, padCount, random = Math.random) {
  const seq = [];
  for (let i = 0; i < length; i++) seq.push(nextPad(padCount, seq[i - 1] ?? -1, random));
  return seq;
}

/** Phases: ready -> show -> input -> (feedback -> show ...) -> done */
export function initGame() {
  return { phase: "ready", seq: [], pos: 0, misses: 0, stars: 0, attempts: 0, hints: 0, longest: 0, event: null };
}

export function startGame(state, level, padCount, random) {
  return { ...initGame(), phase: "show", seq: makePattern(level.start, padCount, random) };
}

/** Call when the playback of the pattern has finished. */
export const showFinished = (state) => ({ ...state, phase: "input", pos: 0, event: null });

/** Call to replay the same pattern ("Show me again" or after a miss). */
export const replay = (state) => ({ ...state, phase: "show", pos: 0, event: null });

const HINT_AFTER = { full_model: 1, partial: 2, none: Infinity };

/** Which pad shows a "Next one" hint right now (-1 = none). */
export function hintPad(state, level) {
  return state.phase === "input" && state.misses >= (HINT_AFTER[level.promptLevel] ?? 2) ? state.seq[state.pos] : -1;
}

/**
 * The patient taps a pad. Returns the new state with `event`:
 * 'step' (right, keep going), 'grow' (copied it, pattern grows), 'done' (goal reached),
 * 'miss' (wrong pad: replay the same pattern). Ignored outside the input phase.
 */
export function tapPad(state, level, padIndex, padCount, random) {
  if (state.phase !== "input") return state;
  const attempts = state.attempts + 1;
  const usedHint = hintPad(state, level) >= 0;

  if (padIndex !== state.seq[state.pos]) {
    return { ...state, attempts, misses: state.misses + 1, pos: 0, phase: "feedback", event: "miss" };
  }

  const pos = state.pos + 1;
  const hints = state.hints + (usedHint ? 1 : 0);
  if (pos < state.seq.length) return { ...state, attempts, hints, pos, event: "step" };

  const stars = state.stars + 1;
  const longest = Math.max(state.longest, state.seq.length);
  if (state.seq.length >= level.goal) {
    return { ...state, attempts, hints, pos, stars, longest, phase: "done", event: "done" };
  }
  const seq = [...state.seq, nextPad(padCount, state.seq[state.seq.length - 1], random)];
  return { ...state, attempts, hints, pos, stars, longest, misses: 0, seq, phase: "feedback", event: "grow" };
}
