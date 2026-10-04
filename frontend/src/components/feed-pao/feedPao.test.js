import { describe, it, expect } from "vitest";
import { buildRounds, initRound, pick } from "./feedPao";

const game = {
  levels: [
    { level_order: 2, level_name: "Two steps", prompt_level: "partial", items: [{
      question: "Give Pao the banana, then the milk.",
      choices: [
        { label: "milk", choice_key: "milk", is_correct: true, step: 2 },
        { label: "bread", choice_key: "bread", is_correct: false },
        { label: "banana", choice_key: "banana", is_correct: true, step: 1 },
      ],
    }] },
    { level_order: 1, level_name: "One step", prompt_level: "full_model", items: [{
      question: "Give Pao the banana.",
      choices: [
        { label: "banana", choice_key: "banana", is_correct: true },
        { label: "milk", choice_key: "milk", is_correct: false },
      ],
    }] },
  ],
};

const rounds = buildRounds(game);

describe("buildRounds", () => {
  it("orders levels and wanted foods by step", () => {
    expect(rounds.map((r) => r.levelName)).toEqual(["One step", "Two steps"]);
    expect(rounds[1].wanted).toEqual(["banana", "milk"]);
  });

  it("keeps a three-step direction in step order", () => {
    const three = buildRounds({
      levels: [{ level_order: 1, level_name: "Three steps", prompt_level: "partial", items: [{
        question: "Give Pao the bread, then the banana, then the water.",
        choices: [
          { label: "water", choice_key: "water", is_correct: true, step: 3 },
          { label: "bread", choice_key: "bread", is_correct: true, step: 1 },
          { label: "banana", choice_key: "banana", is_correct: true, step: 2 },
          { label: "milk", choice_key: "milk", is_correct: false },
        ],
      }] }],
    });
    expect(three[0].wanted).toEqual(["bread", "banana", "water"]);
    let s = initRound();
    for (const key of three[0].wanted) s = pick(s, three[0], key);
    expect(s.roundDone).toBe(true);
    expect(s.given).toEqual(["bread", "banana", "water"]);
  });
});

describe("pick", () => {
  it("finishes a one-step round", () => {
    const s = pick(initRound(), rounds[0], "banana");
    expect(s.roundDone).toBe(true);
    expect(s.mood).toBe("eating");
  });

  it("glows after 1 wrong try on full_model", () => {
    const s = pick(initRound(), rounds[0], "milk");
    expect(s.message.text).toBe("Hmm, Pao wants the banana. Listen again!");
    expect(s.glowKey).toBe("banana");
    expect(s.wrongKeys).toEqual(["milk"]);
  });

  it("two steps: right food, wrong order is not marked wrong", () => {
    const s = pick(initRound(), rounds[1], "milk");
    expect(s.message.text).toBe("Good one, but first the banana!");
    expect(s.wrongKeys).toEqual([]);
  });

  it("two steps in order", () => {
    let s = pick(initRound(), rounds[1], "banana");
    expect(s.roundDone).toBe(false);
    s = pick(s, rounds[1], "milk");
    expect(s.roundDone).toBe(true);
    expect(s.given).toEqual(["banana", "milk"]);
  });

  it("glows after 2 wrong tries on partial", () => {
    let s = pick(initRound(), rounds[1], "bread");
    expect(s.glowKey).toBe(null);
    s = pick(s, rounds[1], "bread");
    expect(s.glowKey).toBe("banana");
  });
});
