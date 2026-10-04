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
        const healthy = item.mode === "healthy";
        return {
          mode: healthy ? "healthy" : "follow",
          need: healthy ? item.pick_count || 1 : wanted.length,
          levelName: level.level_name,
          levelOrder: level.level_order,
          promptLevel: level.prompt_level || "partial",
          direction: item.question || item.text,
          audioUrl: item.audio_url || null,
          options,
          wanted, // follow mode: keys in the order Pao wants them; healthy mode: any healthy key
        };
      })
    );
}

const GLOW_AFTER = { full_model: 1, partial: 2, none: 3 };

export function initRound() {
  return { given: [], wrongKeys: [], refused: [], tries: 0, glowKey: null, mood: "hungry", message: null, roundDone: false, attempts: 0, hints: 0 };
}

const nameOf = (round, key) => round.options.find((o) => o.key === key)?.label ?? key;

/**
 * pick(state, round, key) -> new state.
 * message: { text, tone: 'good' | 'try' }
 */
export function pick(state, round, key) {
  if (state.roundDone || state.given.includes(key)) return state;
  if (round.mode === "healthy") return pickHealthy(state, round, key);
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

/**
 * Healthy choices: Pao takes any healthy food (is_correct), and politely refuses
 * "sometimes foods" (is_sometimes_food) with the choice's feedback. Refusing is not a
 * mistake: no stars lost, the food just moves to the Sometimes box.
 */
function pickHealthy(state, round, key) {
  if (state.refused.includes(key)) return state;
  const choice = round.options.find((o) => o.key === key);
  const attempts = state.attempts + 1;

  if (choice.is_sometimes_food || !choice.is_correct) {
    return {
      ...state,
      attempts,
      refused: choice.is_sometimes_food ? [...state.refused, key] : state.refused,
      wrongKeys: choice.is_sometimes_food ? state.wrongKeys : [...state.wrongKeys, key],
      mood: "no",
      message: {
        text: choice.feedback || `No thank you! The ${choice.label} is a sometimes food.`,
        tone: "try",
      },
    };
  }

  const given = [...state.given, key];
  const roundDone = given.length >= round.need;
  return {
    ...state,
    given,
    attempts,
    mood: "eating",
    roundDone,
    message: {
      text: roundDone
        ? `Yum! The ${choice.label} is healthy. It helps me grow strong!`
        : `Yum, the ${choice.label}! That is healthy. One more, please!`,
      tone: "good",
    },
  };
}
