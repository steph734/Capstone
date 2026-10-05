import { describe, it, expect } from "vitest";
import { buildConfig, makePattern, initGame, startGame, showFinished, replay, tapPad, hintPad, fullName, DEFAULT_PADS } from "./copyColors";

// Deterministic "random" for tests
const seqRandom = (values) => { let i = 0; return () => values[i++ % values.length]; };
const level = { order: 1, name: "Warm-up", start: 2, goal: 3, promptLevel: "partial" };

const playThrough = (s) => {
  let state = s;
  for (const p of state.seq) state = tapPad(state, level, p, 4, () => 0.3);
  return state;
};

describe("buildConfig", () => {
  it("reads pads and levels from the game document", () => {
    const cfg = buildConfig({
      type_settings: { step_by_step: { speed_default: "normal" } },
      levels: [{ level_order: 1, level_name: "Short", start_length: 2, goal_length: 4, prompt_level: "full_model",
        items: [{ label: "Red", shape: "circle", color: "#E5484D", step_order: 1 }, { label: "Blue", shape: "square", step_order: 2 }] }],
    });
    expect(cfg.speed).toBe("normal");
    expect(cfg.pads.map(fullName)).toEqual(["Red circle", "Blue square"]);
    expect(cfg.levels[0]).toMatchObject({ start: 2, goal: 4, promptLevel: "full_model" });
  });

  it("caps pattern lengths at 5 even if the database asks for more", () => {
    const cfg = buildConfig({ levels: [{ level_order: 1, level_name: "Long", start_length: 4, goal_length: 9, items: [] }] });
    expect(cfg.levels[0]).toMatchObject({ start: 4, goal: 5 });
  });

  it("falls back to the 4 default pads", () => {
    expect(buildConfig({}).pads).toHaveLength(4);
    expect(fullName(DEFAULT_PADS[3])).toBe("Yellow star");
  });
});

describe("makePattern", () => {
  it("makes a pattern of the right length with valid pads", () => {
    const p = makePattern(6, 4);
    expect(p).toHaveLength(6);
    expect(p.every((x) => x >= 0 && x < 4)).toBe(true);
  });
});

describe("tapPad", () => {
  const start = () => showFinished(startGame(initGame(), level, 4, seqRandom([0.1, 0.6])));

  it("ignores taps while Pao is showing the pattern", () => {
    const s = startGame(initGame(), level, 4, seqRandom([0.1, 0.6]));
    expect(tapPad(s, level, 0, 4)).toBe(s);
  });

  it("grows the pattern by one after a correct copy", () => {
    const s = playThrough(start());
    expect(s.event).toBe("grow");
    expect(s.seq).toHaveLength(3);
    expect(s.stars).toBe(1);
  });

  it("finishes when the goal length is copied", () => {
    let s = playThrough(start());
    s = playThrough(showFinished(replay(s)));
    expect(s.event).toBe("done");
    expect(s.phase).toBe("done");
    expect(s.longest).toBe(3);
  });

  it("a wrong pad replays the same pattern, no game over", () => {
    const s0 = start();
    const wrong = (s0.seq[0] + 1) % 4;
    const s = tapPad(s0, level, wrong, 4);
    expect(s.event).toBe("miss");
    expect(s.seq).toEqual(s0.seq);
    expect(s.stars).toBe(0);
  });

  it("shows a hint on the next pad after 2 misses (partial)", () => {
    let s = start();
    const wrong = (s.seq[0] + 1) % 4;
    s = showFinished(replay(tapPad(s, level, wrong, 4)));
    expect(hintPad(s, level)).toBe(-1);
    s = showFinished(replay(tapPad(s, level, wrong, 4)));
    expect(hintPad(s, level)).toBe(s.seq[0]);
  });
});
