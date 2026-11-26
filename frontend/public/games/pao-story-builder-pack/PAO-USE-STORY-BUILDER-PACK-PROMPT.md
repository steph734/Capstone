# Prompt: Use the Pao Story Builder pack in /public/games

Paste this into your coding assistant (VS Code). The pack is `pao-story-builder-pack` and should already be in `public/games/` (as a folder). If only `pao-story-builder-pack.zip` is in the frontend root, unzip it into `public/games/pao-story-builder-pack/` first (PowerShell: `New-Item -ItemType Directory -Force public/games/pao-story-builder-pack; Expand-Archive .\pao-story-builder-pack.zip -DestinationPath public/games/pao-story-builder-pack -Force`).

## Task
Find the pack folder, copy its eight source files into `src/` (they must be bundled, so they cannot be imported from `public/`), check the design files are served, then rebuild Story Builder following `PAO-STORY-BUILDER-REDESIGN-PROMPT.md` (inside the pack). Do not change unrelated files and do not touch the earlier Pao packs.

## 1. Locate the pack
Look under `public/games/` for `pao-story-builder-pack/` (or `pao-story-builder/`). Call it `PACK`. If the zip was extracted one level too deep (`PACK/pao-story-builder-pack/...`), use the inner folder. It must contain:
```
PACK/
  PAO-STORY-BUILDER-REDESIGN-PROMPT.md
  reference/278-story-builder-pick-a-story.png
  reference/279-story-builder-step-play.png
  reference/280-story-builder-step-correct.png
  reference/281-story-builder-step-try-again.png
  reference/282-story-builder-results.png
  reference/283-story-builder-storyboard.png
  reference/284-story-builder-pao-reactions.png
  three-little-pigs/285-story-builder-three-little-pigs-cover.png
  goldilocks-and-the-three-bears/286-story-builder-goldilocks-cover.png
  tortoise-and-the-hare/287-story-builder-tortoise-and-hare-cover.png
  red-riding-hood/288-story-builder-storyboard-little-red-riding-hood.png
  three-little-pigs/289-story-builder-storyboard-three-little-pigs.png
  goldilocks-and-the-three-bears/290-story-builder-storyboard-goldilocks.png
  tortoise-and-the-hare/291-story-builder-storyboard-tortoise-and-hare.png
  red-riding-hood/292-story-builder-red-riding-hood-cover.png
  red-riding-hood/red-riding-hood-scenes.js
  three-little-pigs/three-little-pigs-scenes.js
  three-little-pigs/pigsSteps.js
  goldilocks-and-the-three-bears/goldilocks-and-the-three-bears-scenes.js
  goldilocks-and-the-three-bears/goldilocksSteps.js
  tortoise-and-the-hare/tortoise-and-the-hare-scenes.js
  tortoise-and-the-hare/tortoiseSteps.js
  reference/story-builder-storyboard-live.html
  reference/story-mockup-source.py
  reference/story-art-source.py
  reference/story-art2.py
  reference/story-all.py
  src/games/storyBuilder/storyScenes.js
  src/games/storyBuilder/storyCovers.js
  src/games/storyBuilder/pigsSteps.js
  src/games/storyBuilder/goldilocksSteps.js
  src/games/storyBuilder/tortoiseSteps.js
  src/games/storyBuilder/StoryScene.jsx
  src/games/storyBuilder/paoReactions.js
  src/games/storyBuilder/storyCostume.jsx
```
If anything is missing, list what is missing and stop. Do not recreate files from memory.

## 2. Copy the source files into `src/`
Copy (do not move) the eight files from `PACK/src/games/storyBuilder/` to `src/games/storyBuilder/`, keeping the `PACK` copies as design reference only. If the project already has a folder for this game's components, use it and fix the import paths. Never import anything from `/public` in JS or JSX. The story folders (`red-riding-hood/`, `three-little-pigs/`, `goldilocks-and-the-three-bears/`, `tortoise-and-the-hare/`), the images, the live HTML, the prompt and the `.py` files are references only: do not bundle them and do not link them from the app UI.

`storyCostume.jsx` expects the Picture Word pack's headphones and magnifier props. If that pack's source is in `src/`, import them; otherwise copy them from `PACK/../pao-picture-word/src/games/...` if present. If the game-costumes pack is in `src/games/shared/gameCostumes.js`, make sure its `story-builder` entry matches `STORY_COSTUME`.

## 3. Verify the static files
- `npm run dev`, then open `/games/<PACK folder name>/reference/278-story-builder-pick-a-story.png` and the four story folders: `<PACK>/three-little-pigs/` , `<PACK>/goldilocks-and-the-three-bears/`, `<PACK>/tortoise-and-the-hare/` and `<PACK>/red-riding-hood/` (each has its cover and full storyboard PNG), `/games/<PACK folder name>/reference/story-builder-storyboard-live.html` (the scenes must animate and the Play, Pause, Back and Next buttons must work) and `/games/<PACK folder name>/PAO-STORY-BUILDER-REDESIGN-PROMPT.md`. Each must return 200 with the right content.
- `vercel.json`: no SPA rewrite may catch `/games/*` and return `index.html`. Exclude `/games/` and `/api/`.
- Add `X-Robots-Tag: noindex` for `/games/<PACK folder name>/(.*)`. Optionally skip `reference/` when `VERCEL_ENV === 'production'`.
- Check that every key exists in the Pao data: poses `hello relax cheer shy think hug jump tada`; expressions `happy excited silly wink love laugh proud`; costume items hat `crown`, clothes `tee`, pants `jeans`, shoes `sandals`. Report any missing key; do not invent a replacement.
- Check that `StoryScene` renders every scene in a test page without console errors: 9 for `story="red"` and 7 each for `pigs`, `goldi` and `tort` (30 in total), and that the live HTML tabs switch between the four stories.

## 4. Build
Read `PACK/PAO-STORY-BUILDER-REDESIGN-PROMPT.md` and follow it exactly, using the images in `PACK/reference/` and the live HTML as the visual and motion target. Pass its acceptance checklist and finish with `npm run build`.
