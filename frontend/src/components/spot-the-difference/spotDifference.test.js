import { describe, it, expect } from "vitest";
import { buildLevels, hitTest, initLevel, tapPicture, helpPress, nextUnfound } from "./spotDifference";

const level = {
  order: 1, name: "Hard 1", label: "Pao's bedroom", question: "Find all 2 differences",
  imageA: "/a.svg", imageB: "/b.svg", autoClueAfter: 3,
  differences: [
    { x: 20, y: 30, r: 6, say: "The lamp is orange here.", clue: "Look at the lamp." },
    { x: 70, y: 60, r: 6, say: "There are 3 books here.", clue: "Count the books." },
  ],
};

describe("hitTest", () => {
  it("finds a tap inside a difference", () => {
    expect(hitTest(level, 20, 30)).toBe(0);
    expect(hitTest(level, 22, 32)).toBe(0);
  });

  it("returns -1 for a tap outside every difference", () => {
    expect(hitTest(level, 50, 50)).toBe(-1);
  });

  it("uses the 5:3 picture shape: the same distance counts more vertically", () => {
    // 0% width away is 5% height away (r is 6% of width), so 5% down still hits
    expect(hitTest(level, 20, 35)).toBe(0);
    // 11% down is 6.6% of width in picture units, just past the radius of 6
    expect(hitTest(level, 20, 41)).toBe(-1);
  });
});

describe("tapPicture", () => {
  it("finds a difference, gives a star and says its line", () => {
    const s = tapPicture(initLevel(), level, 20, 30);
    expect(s.found).toEqual([0]);
    expect(s.stars).toBe(1);
    expect(s.message.text).toBe("The lamp is orange here.");
    expect(s.phase).toBe("play");
  });

  it("tapping a found spot again says so, and gives no star", () => {
    const first = tapPicture(initLevel(), level, 20, 30);
    const again = tapPicture(first, level, 20, 30);
    expect(again.event).toBe("already");
    expect(again.stars).toBe(1);
    expect(again.message.text).toBe("You already found that one! Look for another.");
  });

  it("a miss says look again and does not remove stars", () => {
    const s = tapPicture(tapPicture(initLevel(), level, 20, 30), level, 50, 50);
    expect(s.event).toBe("miss");
    expect(s.stars).toBe(1);
    expect(s.message.text).toBe("Hmm, look again!");
  });

  it("gives the next clue after the auto-clue number of misses in a row", () => {
    let s = initLevel();
    for (let i = 0; i < 3; i++) s = tapPicture(s, level, 50, 50);
    expect(s.event).toBe("auto-clue");
    expect(s.message.text).toBe("Look at the lamp.");
    expect(s.misses).toBe(0);
    expect(s.totalMisses).toBe(3);
  });

  it("completes the level when every difference is found", () => {
    let s = tapPicture(initLevel(), level, 20, 30);
    s = tapPicture(s, level, 70, 60);
    expect(s.phase).toBe("done");
    expect(s.event).toBe("done");
    expect(s.stars).toBe(2);
  });
});

describe("helpPress", () => {
  it("first press says the clue, second press shows the difference", () => {
    let s = helpPress(initLevel(), level);
    expect(s.message.text).toBe("Look at the lamp.");
    expect(s.glow).toBe(-1);
    expect(s.helpStage).toBe(1);

    s = helpPress(s, level);
    expect(s.glow).toBe(0);
    expect(s.shows).toBe(1);
    expect(s.hints).toBe(2);
  });

  it("finding a difference resets the hint", () => {
    let s = helpPress(helpPress(initLevel(), level), level);
    s = tapPicture(s, level, 20, 30);
    expect(s.glow).toBe(-1);
    expect(s.helpStage).toBe(0);
    expect(nextUnfound(s, level)).toBe(1);
  });
});

describe("buildLevels", () => {
  it("keeps only levels with two pictures and differences", () => {
    const levels = buildLevels({
      levels: [
        { level_order: 2, level_name: "Park", items: [{ label: "Park", image_url: "/p-a.svg", image_b_url: "/p-b.svg", differences: [{ x: 1, y: 1, r: 5 }] }] },
        { level_order: 1, level_name: "Other", items: [{ label: "Plain", image_url: "/x.svg" }] },
      ],
      type_settings: { choose_picture: { auto_clue_after_misses: 4 } },
    });
    expect(levels).toHaveLength(1);
    expect(levels[0]).toMatchObject({ name: "Park", autoClueAfter: 4 });
  });
});
