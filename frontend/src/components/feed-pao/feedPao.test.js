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

  it("three steps in order, with a wrong food in the middle", () => {
    const threeStep = buildRounds({ levels: [{ level_order: 3, level_name: "Three steps", prompt_level: "partial", items: [{
      question: "Give Pao the bread, the water, then the banana.",
      choices: [
        { label: "banana", choice_key: "banana", is_correct: true, step: 3 },
        { label: "bread", choice_key: "bread", is_correct: true, step: 1 },
        { label: "water", choice_key: "water", is_correct: true, step: 2 },
        { label: "candy", choice_key: "candy", is_correct: false },
      ],
    }] }] });
    const [round] = threeStep;
    expect(round.wanted).toEqual(["bread", "water", "banana"]);

    let s = pick(initRound(), round, "water");
    expect(s.roundDone).toBe(false);
    expect(s.wrongKeys).toEqual([]);
    expect(s.message.text).toBe("Good one, but first the bread!");

    s = pick(s, round, "bread");
    s = pick(s, round, "candy");
    expect(s.wrongKeys).toEqual(["candy"]);
    s = pick(s, round, "water");
    expect(s.given).toEqual(["bread", "water"]);
    s = pick(s, round, "banana");
    expect(s.roundDone).toBe(true);
    expect(s.given).toEqual(["bread", "water", "banana"]);
  });
});

describe("healthy choices", () => {
  const healthyGame = { levels: [{ level_order: 4, level_name: "Healthy choices", prompt_level: "partial", items: [{
    question: "Give me two healthy foods.", mode: "healthy", pick_count: 2,
    choices: [
      { label: "candy", choice_key: "candy", is_correct: false, is_sometimes_food: true, feedback: "No thank you! Candy is a sometimes treat." },
      { label: "red apple", choice_key: "apple_red", is_correct: true },
      { label: "carrot", choice_key: "carrot", is_correct: true },
    ],
  }] }] };
  const [round] = buildRounds(healthyGame);

  it("refuses a sometimes food without marking it wrong", () => {
    const s = pick(initRound(), round, "candy");
    expect(s.mood).toBe("no");
    expect(s.refused).toEqual(["candy"]);
    expect(s.wrongKeys).toEqual([]);
    expect(s.message.text).toBe("No thank you! Candy is a sometimes treat.");
  });

  it("takes healthy foods in any order until pick_count", () => {
    let s = pick(initRound(), round, "carrot");
    expect(s.roundDone).toBe(false);
    s = pick(s, round, "apple_red");
    expect(s.roundDone).toBe(true);
  });
});
