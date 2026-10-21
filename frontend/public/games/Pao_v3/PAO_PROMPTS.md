# Pao the Panda: SVGs and prompts (Rhyme Time design)

Every SVG here uses the same drawing as your Rhyme Time Pao: the same 240×300 canvas, head, ears, eye patches, eyes, rounded-rectangle arms, golden paws and gradients (`pw`, `wb`, `dk`). That means they can replace or sit next to `public/games/rhyme-time/*.svg` and line up perfectly.

Copy `svg/*` into `public/games/pao/`.

---

## 1. Base description (paste at the start of every image prompt)

> Pao, a cute chibi baby panda mascot for a children's therapy app. Big round white head with soft blue-grey shading, round dark chocolate-brown ears with pink insides, dark-brown oval eye patches tilted outward, large round eyes with a white ring, warm brown iris, dark pupil and two white shine dots, small dark-brown nose with a tiny highlight, soft pink cheeks. White egg-shaped body with blue-grey shading, thick rounded dark-brown arms ending in big glossy golden-tan ball paws, dark-brown oval feet with golden-tan pads. Clean vector illustration, smooth radial-gradient shading, dark-brown outline, full body, centered, soft oval shadow under the feet, plain white background, no text.

**Negative prompt:** `text, letters, watermark, realistic fur, fingers, claws, scary, angry, crying, tears, sharp teeth, extra limbs, dark background, clutter`

**Colors (same as the Rhyme Time SVGs)**

| Part | Hex |
|---|---|
| Outline | `#2b1f1a` |
| Ears, patches, arms, feet | `#5a3f35` → `#2f201b` |
| Head and body | `#ffffff` → `#e3eaf4` |
| Paws, foot pads | `#f6d3a3` → `#d9a062` (outline `#b88446`) |
| Iris | `#9a5f33` (ring `#6b3d1e`) |
| Ear inside | `#f08aa6` |
| Cheeks | `#f7a8bb` |
| Mouth, tongue | `#7a2e2e`, `#f2849c` |
| Accents | purple `#7b5cff`, yellow `#ffd166`, pink `#ff8fab`, sky `#7bdff2`, lilac `#c3b5ff` |

**Rules:** one clear emotion per pose, a big readable face, and Pao is never sad, angry or crying. Mistakes get a gentle, kind pose.

---

## 2. Loading modal (6 poses)

| # | File | When | Pose prompt (add after the base description) | Pao says |
|---|---|---|---|---|
| 1 | `pao-hello.svg` | Modal opens | one arm raised waving beside his head, other arm down, big open smile with pink tongue, purple sound-wave lines beside the raised paw | "Hi! Let me get your game ready." |
| 2 | `pao-stretch.svg` | 0–30% loading pictures | both arms stretched up with paws beside his head, eyes closed in happy arcs, small "o" yawning mouth, short yellow stretch lines near the ears | "Stretching… getting ready to play!" |
| 3 | `pao-juggle.svg` | 30–70% loading sounds | both arms raised out to the sides, looking up, big open smile, yellow, pink and sky-blue stars in a dotted arc over his head | "Catching all the stars…" |
| 4 | `pao-carry.svg` | 70–99% setting up | holding a cardboard box labeled "GAME" in front of his belly, a star, a blue gem and a pink star peeking out, big smile | "Bringing the game pieces!" |
| 5 | `pao-ready.svg` | 100% ready | jumping slightly with both arms up, happy arc eyes, big open smile, yellow stars around | "All ready! Let's play!" |
| 6 | `pao-slow.svg` | After 8 seconds or offline | holding a purple stopwatch up beside his head, raised eyebrows, small calm smile | "This is taking a bit longer…" |

---

## 3. Game poses (18)

| File | When | Pose prompt (add after the base description) | Pao says |
|---|---|---|---|
| `pao-wave-happy.svg` | Game start | waving one paw, happy arc eyes, big smile, yellow motion lines | "Hi! I'm Pao. Let's play!" |
| `pao-asking.svg` | Question on screen | both arms open out to the sides, round "o" mouth, purple speech bubble with "?" | "Which one is it?" |
| `pao-listen.svg` | Reading the question aloud | paw raised near his cheek, head tilted, small "o" mouth, purple sound waves | "Listen carefully…" |
| `pao-point.svg` | Where to tap | one arm stretched straight out to the side pointing, eyes looking that way, small smile | "Look over here!" |
| `pao-point-talk.svg` | Hint while pointing | same as pointing, mouth open talking | "Try this basket!" |
| `pao-thinking.svg` | Waiting for the answer | paw on chin, head tilted, eyes looking up, wavy mouth, lilac thought bubbles | "Hmm… which one could it be?" |
| `pao-idea.svg` | Hint button | one arm pointing out, wide eyes, big smile, glowing yellow light bulb above | "I have an idea! Let me help." |
| `pao-reading.svg` | Reading words | holding an open purple book, happy arc eyes, "w" smile | "Let's read it together." |
| `pao-correct.svg` | Right answer | jumping with both arms up, happy arc eyes, big open smile, stars | "Yay! You got it!" |
| `pao-proud.svg` | 3 right in a row | one arm up in a fist pump, winking, tongue out, sparkles | "Three in a row! Great job!" |
| `pao-try-again.svg` | Wrong answer (1st) | head tilted, raised eyebrows, soft smile, small pink heart floating | "Oops! That's okay. Let's try again." |
| `pao-encourage.svg` | Wrong answer (2nd) | hugging a big pink heart, raised eyebrows, kind smile | "It's okay. Let's do it together." |
| `pao-surprised.svg` | New badge or level | both arms up, wide eyes, "o" mouth, yellow "!" bubble | "Whoa! You unlocked a badge!" |
| `pao-celebrate.svg` | Game complete | jumping with arms up, star-shaped eyes, big smile, confetti | "You did it! You finished the game!" |
| `pao-sleepy.svg` | Paused or idle | arms down, head tilted, eyes closed, small mouth, purple "z z z" | "I'll wait here. Tap when you're ready!" |
| `pao-idle.svg` | Default | arms relaxed at his sides, "w" smile | (no line) |
| `pao-idle-happy.svg` | Default (cheerful) | arms at his sides, big open smile | (no line) |
| `pao-wizard.svg` | Sentence Builder | small purple wizard hat with a yellow band and star, holding an open book | "Abra-ca-dabra! Let's build a sentence!" |

---

## 4. Full-sheet prompts

**Loading sheet:**
> UI design sheet titled "Pao while the game loads": six rounded white cards in a 3×2 grid on a soft peach-to-lavender background. Each card has a pastel left panel (lavender, butter yellow, pink, sky blue, mint, peach) with Pao [base description] in one pose: waving hello, stretching, juggling stars, carrying a "GAME" box, jumping ready, holding a stopwatch. The right side has a purple number badge, a bold title, a purple subtitle and a quote in a light-purple box. Identical character proportions in every card.

**Expression sheet:**
> Character expression sheet of Pao [base description]: 18 poses in a 6×3 grid of white rounded cards on a light lavender background (waving, asking with "?" bubble, listening, pointing, pointing and talking, thinking with thought bubbles, idea with light bulb, reading a book, cheering, fist pump with wink, gentle try-again with heart, hugging a heart, surprised with "!", celebrating with star eyes and confetti, sleeping with zzz, idle, idle smiling, wizard hat with book). Same proportions and colors in every pose, no labels.

---

## 5. Making new poses with code (`pao-generator.js`)

```js
const { paoR, PAO_POSES } = require('./pao-generator.js');
paoR(PAO_POSES['pao-correct']);                       // a built-in pose
paoR({ l: [14, 62], r: [-96, 66], eyes: 'wide', mouth: 'big', extra: ['bulb'] });  // a custom pose
```

| Option | Values |
|---|---|
| `l`, `r` | `[angle, length, front?]`. The angle is in degrees from straight down: left arm uses positive angles (90 = out to the side, 140 = up and out), right arm uses negative ones. Length is 50–74. `front: true` draws the arm in front of the head. |
| `eyes` | open, soft, wide, happy, closed, wink, star |
| `look` | `[x, y]` iris shift, e.g. `[4, 0]` looks right, `[0, -4]` looks up |
| `mouth` | big, talk, o, small_o, smile, w, wavy, flat, tongue |
| `brows` | raised, worry, one |
| `tilt` | head tilt in degrees, e.g. `6` or `-10` |
| `lift` | jump height in px, e.g. `12` |
| `prop` | box, book, heart |
| `hat` | true (wizard hat) |
| `extra` | waves, motion, stretch, stararc, stars, sparkle, stopwatch, question, bang, thought, bulb, heart, zzz, confetti, drop |
