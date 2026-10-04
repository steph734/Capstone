// Pure logic for Feed Pao (no React), so it is easy to test.

/** Turn the games document into a flat list of rounds (one per direction). */
export function buildRounds(game) {
  return [...(game?.levels || [])]
    .sort((a, b) => a.level_order - b.level_order)
    .flatMap((level) =>
      level.items.map((item) => {
        const options = item.choices.map((c) => ({ ...c, key: c.choice_key || c.label }));
        const wanted = options
          .filter((c) => c.is_correct)
          .sort((a, b) => (a.step ?? 1) - (b.step ?? 1))
          .map((c) => c.key);
        return {
          levelName: level.level_name,
          levelOrder: level.level_order,
          promptLevel: level.prompt_level || "partial",
          direction: item.question || item.text,
          audioUrl: item.audio_url || null,
          options,
          wanted, // keys in the order Pao wants them
        };
      })
    );
}

const GLOW_AFTER = { full_model: 1, partial: 2, none: 3 };

export function initRound() {
  return { given: [], wrongKeys: [], tries: 0, glowKey: null, mood: "hungry", message: null, roundDone: false, attempts: 0, hints: 0 };
}

const nameOf = (round, key) => round.options.find((o) => o.key === key)?.label ?? key;

/**
 * pick(state, round, key) -> new state.
 * message: { text, tone: 'good' | 'try' }
 */
export function pick(state, round, key) {
  if (state.roundDone || state.given.includes(key)) return state;
  const need = round.wanted[state.given.length];
  const attempts = state.attempts + 1;

  if (key === need) {
    const given = [...state.given, key];
    const roundDone = given.length === round.wanted.length;
    return {
      ...state,
      given,
      attempts,
      tries: 0,
      wrongKeys: [],
      glowKey: null,
      mood: "eating",
      roundDone,
      message: {
        text: roundDone ? "Yum yum! Thank you!" : `Yum, the ${nameOf(round, key)}! Now the next one.`,
        tone: "good",
      },
    };
  }

  const tries = state.tries + 1;
  const glow = tries >= (GLOW_AFTER[round.promptLevel] ?? 2);
  const isLaterStep = round.wanted.indexOf(key) > state.given.length;
  return {
    ...state,
    attempts,
    tries,
    hints: state.hints + (glow && !state.glowKey ? 1 : 0),
    wrongKeys: isLaterStep ? state.wrongKeys : [...state.wrongKeys, key],
    glowKey: glow ? need : null,
    message: {
      text: isLaterStep
        ? `Good one, but first the ${nameOf(round, need)}!`
        : `Hmm, Pao wants the ${nameOf(round, need)}. Listen again!`,
      tone: "try",
    },
  };
}
