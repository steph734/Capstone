import { describe, it, expect } from "vitest";
import { buildTasks, shuffleSteps, initLevel, sequenceReducer, routineSentence } from "./sequence";

const game = {
  name: "Daily Routines",
  type_settings: { step_by_step: { tasks: [{ task_key: "hands", name: "Wash Your Hands", finish_text: "Clean hands!" }] } },
  levels: [
    { level_order: 2, level_name: "All", task_key: "hands", prompt_level: "partial", items: [
      { label: "Dry", text: "dry our hands", step_order: 3 },
      { label: "Wet", text: "wet our hands", step_order: 1 },
      { label: "Scrub", text: "scrub", step_order: 2 },
    ] },
    { level_order: 1, level_name: "Warm-up", task_key: "hands", prompt_level: "full_model", items: [
      { label: "Wet", text: "wet our hands", step_order: 1 },
      { label: "Scrub", text: "scrub", step_order: 2 },
      { label: "Dry", text: "dry our hands", step_order: 3 },
    ] },
  ],
};

describe("buildTasks", () => {
  it("groups levels by task, sorted by level_order and step_order", () => {
    const [task] = buildTasks(game);
    expect(task.levels.map((l) => l.level_name)).toEqual(["Warm-up", "All"]);
    expect(task.levels[1].steps.map((s) => s.label)).toEqual(["Wet", "Scrub", "Dry"]);
  });

  it("treats all levels as one task when there is no tasks array", () => {
    const plain = { name: "Plain Steps", type_settings: { step_by_step: {} }, levels: game.levels };
    const tasks = buildTasks(plain);
    expect(tasks).toHaveLength(1);
    expect(tasks[0].name).toBe("Plain Steps");
    expect(tasks[0].levels).toHaveLength(2);
    expect(tasks[0].finish_text).toBe("Well done!");
  });
});

describe("shuffleSteps", () => {
  it("never returns the original order", () => {
    for (let i = 0; i < 50; i++) {
      expect(shuffleSteps(["a", "b", "c"]).join()).not.toBe("a,b,c");
    }
  });
});

describe("sequenceReducer", () => {
  const [task] = buildTasks(game);

  it("pre-places the first step on full_model levels", () => {
    const s = initLevel(task.levels[0]);
    expect(Object.keys(s.placed)).toEqual(["0"]);
    expect(s.tray).toHaveLength(2);
  });

  it("places a correct step and finishes the level", () => {
    const level = task.levels[1];
    const reduce = (s, a) => sequenceReducer(s, a, level, task.finish_text);
    let s = initLevel(level);
    for (const [i, step] of level.steps.entries()) {
      s = reduce(s, { type: "select", key: step.key });
      s = reduce(s, { type: "place", slot: i });
    }
    expect(s.done).toBe(true);
    expect(s.message.text).toContain("Clean hands!");
  });

  it("gives a gentle later/earlier hint and glows after 2 tries on partial", () => {
    const level = task.levels[1];
    const reduce = (s, a) => sequenceReducer(s, a, level);
    let s = reduce(initLevel(level), { type: "select", key: level.steps[2].key }); // Dry
    s = reduce(s, { type: "place", slot: 0 });
    expect(s.message.text).toMatch(/later/);
    expect(s.glowSlot).toBe(null);
    s = reduce(s, { type: "place", slot: 1 });
    expect(s.glowSlot).toBe(2);
    expect(s.placed[0]).toBeUndefined();
  });

  it("asks to pick a picture first", () => {
    const s = sequenceReducer(initLevel(task.levels[1]), { type: "place", slot: 0 }, task.levels[1]);
    expect(s.message.text).toBe("First, tap a picture.");
  });
});

it("builds the read-aloud sentence", () => {
  expect(routineSentence([{ text: "wake up" }, { text: "get dressed" }, { text: "pack our bag" }]))
    .toBe("First, wake up. Then get dressed. Last, pack our bag.");
});
