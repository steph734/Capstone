# TherapyPro: Redesign Story Builder with animated scenes and give Pao story reactions

Attached: `pao-story-builder-pack.zip` with the shared screens in `reference/` (278 to 284) and one folder per story (`red-riding-hood/`, `three-little-pigs/`, `goldilocks-and-the-three-bears/`, `tortoise-and-the-hare/`), each holding that story's cover, full storyboard, scenes and steps, a live animated storyboard for all four stories `reference/story-builder-storyboard-live.html` (open it in a browser and use the story tabs), the mock-up sources, and eight ready-to-use files in `src/games/storyBuilder/`:
- `storyScenes.js`: `STORY_CSS` (all keyframes), `LRRH_SCENES` (9 animated scenes), `PIGS_SCENES`, `GOLDILOCKS_SCENES` and `TORTOISE_SCENES` (7 animated scenes each), `STORY_SCENES` (all four by key: `red`, `pigs`, `goldi`, `tort`) and `LRRH_STEPS` (sample questions, narration, answers, animation notes).
- `storyCovers.js`: `STORY_COVERS` (cover illustrations for the picker; `red` is the Little Red Riding Hood forest cover, `pigs` is the Three Little Pigs meadow cover, `goldi` is the Goldilocks cover, `tort` is the Tortoise and the Hare cover).
- `pigsSteps.js`, `goldilocksSteps.js` and `tortoiseSteps.js`: the seven Three Little Pigs, Goldilocks and Tortoise and the Hare steps, written from the story texts (sample questions and options).
- `StoryScene.jsx`: renders one scene (`story` + `index` props), injects the CSS once, restarts the animation when the step changes, supports `paused`.
- `paoReactions.js`: game moment to Pao pose, expression, prop and lines.
- `storyCostume.jsx`: Pao's **Storyteller** costume (look keys) and the scroll and quill overlay.

The game lives at `/owner/gamified-activities/preview/story` (preview) and the patient play route. Change presentation, scene art and Pao's reactions only. Do NOT change the story data model, the order or number of steps, which answers are correct, scoring, the star rule, audio narration or API contracts. Pao's outfit in this game is the Storyteller costume (crown, green tee, jeans, sandals, scroll). It is a temporary in-game override: never saved, never changes Customize Pao, ignores item ownership. The hub, Customize Pao and the Badge Case keep the equipped outfit.

Before coding: read the current Story Builder component (story picker modal, step screen, stepper, option cards, Pao caption bar), how stories and steps are stored, how narration audio is played, and how Pao is rendered in other games. Keep repo rules: consolidated `frontend/api` handler with `?action=`, cached MongoClient, omit empty strings, UTC storage and Asia/Manila display.

## What is wrong today (fix all)
1. The picker is a small modal on a dark, dimmed sky. The preview toast covers the title "Pick a story". The Cancel button looks broken.
2. On the step screen the preview toast floats over the stepper, the narration text is cut off at the bottom of the scene card, and a scroll bar appears on the right.
3. The stepper chips are tiny, labels collide ("Grandma", "Remember"), and the current step is hard to see.
4. The scene is one big flat object (a basket) with no sense of story. Nothing moves.
5. Pao is a small cropped head in the corner and the caption bar repeats the question.
6. The option grid leaves an empty cell and has no clear selected, correct or wrong state, and no "pick N" counter.
7. No results screen and no way to replay the finished story.

## Global look (images 278 to 282)
- Sky theme shared with the hub, Picture Word and Spot the Difference: blue sky gradient, smiling sun top-left, clouds that never sit behind text, green hills. White cards, radius 30 to 34px, soft shadow with a darker bottom edge. Buttons have a 4 to 6px darker bottom edge.
- Colors: indigo `#5B3FD0` / `#1B2B6B` for text, green `#22C55E` / `#15803D` for correct, amber `#F59E0B` / `#FFF3C9` for the current step and hints, soft orange `#FB923C` for a wrong pick (never red, no buzzer).
- Fonts: Poppins (headings, buttons, numbers), Inter (body). No emojis; icons are inline SVG. Tap targets at least 44px. Respect `prefers-reduced-motion`.

## Story picker (image 278)
Full page instead of a modal. Title pill "Story Builder · Pick a story", preview pill under it, back and star pills. **Cover art:** the Little Red Riding Hood cover is a forest scene: tall brown trunks, dark green leaves, Red walking on a light path with her basket, a pair of glowing yellow eyes in a dark bush (they pulse), and flowers in the corner bushes. Use `STORY_COVERS.red` as is. **Three Little Pigs cover (image 285):** a sunny meadow with the straw, stick and brick houses in a row, three pigs in front (straw hat and red scarf, green cap and orange overalls, yellow hard hat and blue overalls holding a brick), the wolf peeking in from the left behind a white picket fence, sunflowers and mushrooms. Use `STORY_COVERS.pigs` as is. **Goldilocks cover (image 286):** a green meadow with rolling hills and a cottage on the right; Goldilocks in the front right with long golden curls, a red headband bow, a red top and blue dungarees, holding a red flower and a basket of flowers; Father, Mother and Baby Bear walking along a path behind her (blue cap, pink bonnet, red bow tie); leaves and flowers in the bottom corners. Use `STORY_COVERS.goldi` as is. **Tortoise and the Hare cover (image 287):** a sunny meadow with a green tree on the left, the hare standing proud on the left (tan fur, pink inner ears, arms folded, eyes closed in a smug smile), the tortoise plodding in the middle toward a white finish line with a red tape on the right (golden-brown shell, short neck, calm green face), a brown squirrel by the finish line, a hedgehog near the tree, a bluebird above, daisies in the corners. Use `STORY_COVERS.tort` as is. Covers are 4:3 (viewBox 300x225), shown at about 316x230 with `preserveAspectRatio="xMidYMid slice"`. Four story cards in a row (316px wide, radius 32px, each with its own pastel color): a cover illustration, the title, one progress segment per step (green when done), "{n} steps · {status}" (Not started, "3 of 9 done", Completed) and a **Play** button (**Play again** when completed). Pao sits bottom-left with the bubble "Which story shall we build today?". Use the stories and counts that exist today; the four cover illustrations in the mock-up are samples drawn for the existing four stories. If there are more than four stories, wrap to a second row or scroll the row horizontally.

## The Three Little Pigs: 7 steps
The story text gives seven steps. Use these names in the stepper and map the existing step records to them in this order (do not reorder or add steps; if the game's data differs, keep the game's data and tell me):

| # | Stepper label | What happens in the story |
|---|---|---|
| 1 | Mother | The pigs leave home; Mother says to work hard and do their best |
| 2 | Build | Straw, sticks and bricks (pick 3 materials) |
| 3 | Straw | The wolf blows the straw house down; the pig runs to the stick house |
| 4 | Sticks | The stick house falls too; both pigs run to the brick house |
| 5 | Bricks | The wolf huffs and puffs but the brick house does not budge |
| 6 | Chimney | The wolf climbs down the chimney into a pot of hot water and runs away |
| 7 | Safe | The pigs live safely in the brick house |

`pigsSteps.js` holds sample questions, options and short narration for each. Its seven animated scenes are in `storyScenes.js` (see the scenes section).

## Goldilocks and the Three Bears: 7 steps
Same rule as above: use these names in the stepper, map the existing step records in this order, and keep the game's own data if it differs.

| # | Stepper label | What happens in the story |
|---|---|---|
| 1 | Bears | The bears' porridge is too hot, so they go for a walk |
| 2 | House | Goldilocks finds the house, knocks and goes in |
| 3 | Porridge | Too hot, too cold, just right (Baby Bear's) |
| 4 | Chairs | Too big and hard, too big and soft, Baby Bear's chair breaks |
| 5 | Beds | Too hard, too soft, Baby Bear's is just right and she falls asleep |
| 6 | Return | The bears notice the porridge, the chairs and the bed (pick 3) |
| 7 | Run | Goldilocks runs away and never enters a stranger's home uninvited again |

`goldilocksSteps.js` holds sample questions, options and short narration. Its seven animated scenes are `GOLDILOCKS_SCENES` in `storyScenes.js`.

## The Tortoise and the Hare: 7 steps

| # | Step | What happens |
|---|------|--------------|
| 1 | Proud | The hare boasts about his strong back legs and speed |
| 2 | Tease | He teases the tortoise; the tortoise says he gets there soon enough |
| 3 | Race | The tortoise challenges him; the rooster counts down |
| 4 | Steady | The hare vanishes; the tortoise plods on, eyes on the road |
| 5 | Nap | The hare naps under a tree at the halfway point |
| 6 | Pass | The tortoise passes the sleeping hare without a word |
| 7 | Win | The hare wakes at sunset; the tortoise breaks the tape and states the lesson |

`tortoiseSteps.js` holds sample questions, options and short narration. Its seven animated scenes are `TORTOISE_SCENES` in `storyScenes.js`.

## Step screen (images 279 to 281), 1440x900, nothing scrolls
1. Top bar: "Stories" back pill, centre pill with the story title and "Step {n} of {total}", star pill. The preview pill sits directly under the centre pill.
2. Stepper (y 116): one white pill with all steps. Done = green check, current = amber circle with a glow ring, upcoming = grey number. The label under each is the step's short name. Keep each cell at least 100px wide so labels never collide.
3. Left card (x 40, 620px wide): the animated scene (`StoryScene`) in a 16:10 frame with a "Step {n} of {total} · {name}" pill, then the narration in 19px bold with a **Hear it** button on the right (plays the existing narration audio). The full narration must always be visible: grow the card, never clip or scroll.
4. Right column (x 690): the question (31px Poppins), a "{k} of {N} picked" chip for pick-N steps, and a 3-column grid of option cards, each 190px tall with the picture, the label and a state:
   - idle: white card; selected: indigo outline with a check; correct: green with "Nice!"; wrong: soft orange with a one-line reason; unpicked after the step is solved: faded.
   - The 6th grid cell holds the action: grey "Pick {n} more" until enough are picked, then **Check my picks** (indigo), then **Next step** (green). After a wrong answer show **Try again**.
5. Pao bottom-left (250px tall) with the bubble to her right. No caption bar that repeats the question.
6. Single-choice steps use the same grid (2 or 3 cards) and need no Check button: tapping an option checks it.

## Animated scenes (the storyboard, image 283 and the live HTML)
`LRRH_SCENES` has nine looping scenes (about 6 seconds each), made only of SVG and CSS keyframes (no JS timers, no images, no libraries):
1. **Pack:** bear, flowers and cookies hop into the basket one by one; Red bounces.
2. **Mom:** Mom waves; a path bubble pops up; hearts float up.
3. **Path:** Red walks the path to the signpost; a sparkle marks Grandma's house.
4. **Wolf:** the wolf peeks from behind the tree and wags his tail; a question bubble pops.
5. **Flowers:** flowers sway; a butterfly flutters; Red waves.
6. **Bed:** the wolf in Grandma's cap blinks; gold rings pulse on ears, eyes and teeth.
7. **Help:** Red shouts; birds fly off; the woodcutter runs in.
8. **Grandma:** Grandma peeks from the wardrobe; hearts rise; Red waves.
9. **Remember:** three rule cards flip in one by one; sparkles twinkle.

Rules:
- Open `reference/story-builder-storyboard-live.html` to see the target motion. Match it, do not redraw the scenes.
- Map scenes to the game's real steps by index. If a story has a different number of steps or other stories, keep the same `StoryScene` pattern: use `STORY_SCENES[storyKey]`; all four stories now have scenes. If the game has another story, draw its scenes in the same flat style and show its cover as a static picture until they exist.
- On a correct answer, restart the scene (change `key`) so the child sees the reward animation; on a wrong answer do not restart it.
- Provide a Pause and Play control in the results "Watch my story" mode and pause the animation while a modal is open (`.paused .sb * { animation-play-state: paused !important; }`).
- `prefers-reduced-motion`: animations are off and every scene shows its finished state.
- The scene art is decorative: `role="img"` with an `aria-label` that names what is happening ("Red puts a bear, flowers and cookies in the basket").

## Animated scenes for the other three stories (images 289, 290, 291)
Same system as above: 480x300 SVG, CSS keyframes only, about 6 seconds per loop. Use `<StoryScene story="pigs" index={n} />` (keys `pigs`, `goldi`, `tort`; `red` is the default). One storyboard image per story shows every scene with its full story text, question, answer and animation note (288 Red, 289 Pigs, 290 Goldilocks, 291 Tortoise).

**The Three Little Pigs (`PIGS_SCENES`)**
1. **Mother:** Mother pig waves, a hammer and heart bubble pops, hearts float, the three pigs bob.
2. **Build:** straw, stick and brick houses grow up one after another while the pigs bounce.
3. **Straw:** the wolf huffs, wind streaks blow, the straw house tips over and fades; "Huff! Puff!" bubble.
4. **Sticks:** the stick house collapses; two pigs run toward the brick house; "Run!" bubble.
5. **Bricks:** the wolf puffs again and again; the brick house only shakes a little; sparkles glint.
6. **Chimney:** the wolf wobbles on the roof; a cutaway shows the fire, the pot with steam and the pig; "Gulp!" bubble.
7. **Safe:** hearts rise, the three pigs bob in front of the brick house, the wolf trots far away.

**Goldilocks and the Three Bears (`GOLDILOCKS_SCENES`)**
1. **Bears:** steam rises from the three bowls; the bears walk out; a "hot!" bubble.
2. **House:** Goldilocks walks up the path; a "Knock! Knock!" bubble; the door is open.
3. **Porridge:** steam, a snowflake and sparkles show hot, cold and just right; "Just right!" bubble.
4. **Chairs:** the little chair drops its pieces; Goldilocks shakes; "Oops!" bubble.
5. **Beds:** three beds in a row; Goldilocks sleeps in the small one and breathes; Zs float up.
6. **Return:** the bears bob in; Baby Bear points; "Here she is!" bubble and an exclamation mark.
7. **Run:** Goldilocks runs across the meadow; the bears wave from the door; "Never again!" bubble.

**The Tortoise and the Hare (`TORTOISE_SCENES`)**
1. **Proud:** the hare bobs proudly; sparkles twinkle; a bluebird flaps; "So fast!" bubble.
2. **Tease:** the hare shakes with laughter; the tortoise slides in slowly; "Hurry up!" and "Soon enough!" bubbles.
3. **Race:** a rooster counts 3, 2, 1, GO! one number at a time.
4. **Steady:** the hare dashes out of sight with dust puffs; the tortoise plods on; an eye bubble means eyes on the road.
5. **Nap:** the hare sleeps under the tree and breathes; Zs float; the tortoise creeps along far away.
6. **Pass:** the tortoise tiptoes past the sleeping hare; a "Shh..." bubble.
7. **Win:** the sun sets; the tape breaks; sparkles and a "Winner!" bubble pop while the hare runs in late.

The step questions and answers for these three stories are samples (`pigsSteps.js`, `goldilocksSteps.js`, `tortoiseSteps.js`). Keep what the game stores and use the scenes by step order.

## Results screen (image 282)
Modal over the dimmed game: "Your story is built!", Pao `finished` in a rounded tile, 1 to 3 stars, three stats (Steps, First try, Time), a "Your story book" grid of the scene thumbnails (nine for Red, seven for the others) (frozen or animated, your choice) and three buttons: **Watch my story** (plays all scenes in order, about 6.5 seconds each, with Back, Pause and Next), **Pick another story** and **All games**.

## Pao reactions (image 284)
Use `src/games/storyBuilder/paoReactions.js` as the only mapping from game moment to Pao. It uses ONLY existing poses and expressions, so no database change is needed:

| Moment | Pose | Expression | Prop |
|---|---|---|---|
| Story picker opens | hello | happy | none |
| Narration audio plays | relax | happy | headphones |
| Correct answer | cheer | excited | none |
| Wrong answer | shy | silly | none |
| Hint | think | wink | magnifier |
| 2 wrong picks in a row | hug | love | none |
| 3 steps right on the first try | jump | laugh | none |
| Story finished | tada | proud | none |

Rules:
- Temporary in-game overrides. Restore the child's chosen pose and expression style after each reaction (`REACTION_MS` = 2200 ms). The newest reaction wins; do not queue.
- Pose and expression are mutually exclusive in Customize Pao (server 409 `STYLE_CONFLICT`). These reactions are client-side only and must never call the style endpoint.
- Render order inside one `position: relative` wrapper: Pao (costume look), `StoryScroll`, then the prop. All use the same width, height and viewBox (default `-30 -66 250 322`).
- The crown is hidden while the headphones are shown.
- Lines come from `lines`; replace `{answer}`, `{character}`, `{n}`, `{name}`.

## Accessibility
- Option cards are real buttons with `aria-pressed`; the stepper is a `nav` with `aria-current="step"` on the current step; announce results in an `aria-live="polite"` region ("Nice! Flowers is right", "Not this one. Pick again", "Step 2 of 9").
- Do not rely on color alone: correct = check plus "Nice!", wrong = redo icon plus text.
- Esc opens pause or exit. Keep focus inside modals. Narration has a visible **Hear it** button and the full text on screen.
- Responsive: under 900px wide, stack the scene card above the question, make the option grid 2 columns, make the stepper horizontally scrollable with the current step centred, shrink Pao to 150px and put the bubble above her.

## Data and logic
- No new endpoints. Count first-try steps and time in the component; add them to the existing result post only as optional fields and omit empty ones.
- Star rule: keep the existing one. If none exists, use 3 stars for 7 or more first-try steps, 2 for 4 to 6, otherwise 1.
- Preview mode (owner and therapist) never saves scores.
- The questions, answers, picks and numbers in the images (3 of 9 done, 8:12, 7 first try) are samples. `LRRH_STEPS` holds sample text: use the real step text and answers from the game's data.

## Acceptance checklist
- [ ] Picker, step, correct, wrong and results screens match images 278 to 282 at 1440x900; the preview pill never overlaps the title and nothing scrolls.
- [ ] The narration is never clipped and the stepper labels never collide.
- [ ] All nine scenes animate like the live HTML, pause and restart as described, and show a finished state with reduced motion.
- [ ] Wrong answers are soft orange and never red or punishing; the action cell always shows the right button.
- [ ] Pao reacts using only existing poses and expressions, wears the Storyteller costume and restores the child's chosen style after each reaction.
- [ ] Story data, step order, correct answers, scoring and API contracts are unchanged.
- [ ] No emojis, no console errors, `npm run build` passes.
