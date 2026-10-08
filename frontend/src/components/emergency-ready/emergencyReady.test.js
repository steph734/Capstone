import { describe, it, expect } from "vitest";
import {
  buildEmergencies, initOrder, orderReducer, initSafeOrNot, safeOrNotReducer,
  initChoose, chooseReducer, initSort, sortReducer, partComplete,
} from "./emergencyReady";

const game = {
  type_settings: {
    step_by_step: {
      emergencies: [
        { emergency_key: "earthquake", name: "Earthquake", rule: "Drop, cover, hold on" },
        { emergency_key: "fire", name: "Fire", rule: "Get out and stay out" },
        { emergency_key: "typhoon", name: "Typhoon", rule: "Stay indoors" },
        { emergency_key: "flood", name: "Flood", rule: "Move to higher ground" },
        { emergency_key: "tsunami", name: "Tsunami", rule: "Go inland and uphill" },
        { emergency_key: "volcano", name: "Volcano", rule: "Cover your nose and mouth" },
      ],
    },
    sort_place: { zones: [{ zone_key: "bag", label: "Go-bag" }, { zone_key: "home", label: "Leave at home" }] },
  },
  levels: [
    { level_order: 1, emergency_key: "earthquake", part_no: 1, mode: "order", rule_hint: "First we drop, then we cover, then we hold on.", items: [
      { step_order: 1, label: "Drop", text: "Drop down onto your hands and knees." },
      { step_order: 2, label: "Cover", text: "Cover your head and neck." },
      { step_order: 3, label: "Hold on", text: "Hold on until the shaking stops." },
    ] },
    { level_order: 2, emergency_key: "earthquake", part_no: 2, mode: "safe_or_not", lead: "During an earthquake…", items: [
      { label: "Use the elevator.", is_safe: false, why: "Not safe. The elevator can stop working." },
      { label: "Drop, cover, hold on.", is_safe: true, why: "Yes! That keeps you safe." },
    ] },
    { level_order: 3, emergency_key: "earthquake", part_no: 3, mode: "choose", items: [
      { question: "What do we do first?", choices: [
        { choice_key: "drop", label: "Drop", is_correct: true, why: "Yes! Drop first." },
        { choice_key: "run", label: "Run outside", is_correct: false, why: "Not yet. Drop first." },
      ] },
    ] },
    { level_order: 4, emergency_key: "earthquake", part_no: 4, mode: "sort", items: [
      { label: "Water", zone_key: "bag", why: "Water keeps you hydrated." },
      { label: "TV remote", zone_key: "home", why: "You don't need this in the go-bag." },
    ] },
    { level_order: 5, emergency_key: "fire", part_no: 1, mode: "order", items: [{ step_order: 1, label: "Shout", text: "Shout fire!" }] },
    { level_order: 6, emergency_key: "fire", part_no: 2, mode: "safe_or_not", items: [{ label: "Hide in a closet.", is_safe: false, why: "Not safe." }] },
    { level_order: 7, emergency_key: "fire", part_no: 3, mode: "choose", items: [{ question: "Call?", choices: [{ choice_key: "911", label: "911", is_correct: true, why: "Yes!" }] }] },
    { level_order: 8, emergency_key: "fire", part_no: 4, mode: "sort", items: [{ label: "Flashlight", zone_key: "bag", why: "Good for the dark." }] },
    ...["typhoon", "flood", "tsunami", "volcano"].flatMap((key, i) => ([
      { level_order: 9 + i * 4, emergency_key: key, part_no: 1, mode: "order", items: [{ step_order: 1, label: "Step", text: "Do the thing." }] },
      { level_order: 10 + i * 4, emergency_key: key, part_no: 2, mode: "safe_or_not", items: [{ label: "Stay calm.", is_safe: true, why: "Yes." }] },
      { level_order: 11 + i * 4, emergency_key: key, part_no: 3, mode: "choose", items: [{ question: "What now?", choices: [{ choice_key: "a", label: "A", is_correct: true, why: "Yes." }] }] },
      { level_order: 12 + i * 4, emergency_key: key, part_no: 4, mode: "sort", items: [{ label: "Item", zone_key: "home", why: "Leave it." }] },
    ])),
  ],
};

describe("buildEmergencies", () => {
  it("builds 6 emergencies, each with 4 parts in order", () => {
    const emergencies = buildEmergencies(game);
    expect(emergencies).toHaveLength(6);
    expect(emergencies.map((e) => e.key)).toEqual(["earthquake", "fire", "typhoon", "flood", "tsunami", "volcano"]);
    for (const e of emergencies) {
      expect(e.levels.map((l) => l.part_no)).toEqual([1, 2, 3, 4]);
      expect(e.levels.map((l) => l.mode)).toEqual(["order", "safe_or_not", "choose", "sort"]);
    }
  });
});

const [earthquake] = buildEmergencies(game);
const [orderLevel, safeLevel, chooseLevel, sortLevel] = earthquake.levels;

describe("order part", () => {
  it("places a step right, in order, and finishes", () => {
    let s = initOrder(orderLevel);
    s = orderReducer(s, { type: "select", key: "Drop" }, orderLevel);
    s = orderReducer(s, { type: "place", slot: 0 }, orderLevel);
    expect(s.message.text).toBe("Drop down onto your hands and knees.");
    expect(s.stars).toBe(1);
    expect(partComplete("order", s)).toBe(false);

    s = orderReducer(s, { type: "select", key: "Cover" }, orderLevel);
    s = orderReducer(s, { type: "place", slot: 1 }, orderLevel);
    s = orderReducer(s, { type: "select", key: "Hold on" }, orderLevel);
    s = orderReducer(s, { type: "place", slot: 2 }, orderLevel);
    expect(partComplete("order", s)).toBe(true);
  });

  it("gives the rule hint on a wrong slot and glows after 2 tries", () => {
    let s = initOrder(orderLevel);
    s = orderReducer(s, { type: "select", key: "Hold on" }, orderLevel);
    s = orderReducer(s, { type: "place", slot: 0 }, orderLevel);
    expect(s.message.text).toContain("comes later");
    expect(s.message.text).toContain("First we drop");
    expect(s.glowSlot).toBe(null);
    s = orderReducer(s, { type: "select", key: "Hold on" }, orderLevel);
    s = orderReducer(s, { type: "place", slot: 1 }, orderLevel);
    expect(s.glowSlot).toBe(2);
  });
});

describe("safe_or_not part", () => {
  it("marks a right answer and a wrong answer", () => {
    let s = initSafeOrNot();
    s = safeOrNotReducer(s, { type: "answer", isSafe: false }, safeLevel); // card 1 is not safe
    expect(s.correct).toBe(true);
    expect(s.message.tone).toBe("good");

    s = safeOrNotReducer(s, { type: "next" }, safeLevel);
    s = safeOrNotReducer(s, { type: "answer", isSafe: false }, safeLevel); // card 2 is safe -> wrong
    expect(s.correct).toBe(false);
    expect(s.message.text).toContain("Hmm, look again.");

    s = safeOrNotReducer(s, { type: "next" }, safeLevel);
    expect(partComplete("safe_or_not", s)).toBe(true);
  });
});

describe("choose part", () => {
  it("marks a right and a wrong choice", () => {
    let s = initChoose();
    const right = chooseReducer(s, { type: "answer", key: "drop" }, chooseLevel);
    expect(right.correct).toBe(true);
    const wrong = chooseReducer(s, { type: "answer", key: "run" }, chooseLevel);
    expect(wrong.correct).toBe(false);
    expect(wrong.message.text).toContain("Not yet");
  });
});

describe("sort part", () => {
  it("sorts into the right zone and the wrong zone without losing the item", () => {
    let s = initSort(sortLevel);
    s = sortReducer(s, { type: "select", key: "Water" }, sortLevel);
    s = sortReducer(s, { type: "drop", zoneKey: "home" }, sortLevel); // wrong zone
    expect(s.placed.home).toEqual([]);
    expect(s.message.text).toContain("Put it in the go-bag.");

    s = sortReducer(s, { type: "drop", zoneKey: "bag" }, sortLevel); // right zone
    expect(s.placed.bag).toEqual(["Water"]);
    expect(partComplete("sort", s)).toBe(false);

    s = sortReducer(s, { type: "select", key: "TV remote" }, sortLevel);
    s = sortReducer(s, { type: "drop", zoneKey: "home" }, sortLevel);
    expect(partComplete("sort", s)).toBe(true);
  });
});
