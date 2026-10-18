/*
 * GAME REGISTRY — the one list of every game in Gamified Activities.
 *
 * Games must end with finish() (useGameSession). Never award rewards inside a game: the server decides XP, badge,
 * stats and outfit, and the shared RewardsFlow shows them.
 *
 * To add a new game: add one entry here. The loading modal is automatic.
 *   slug       the game id used by the game cards (see GAMES in GamifiedFullPage.jsx)
 *   name, icon (a lucide icon), category, level
 *   load       () => import('...')  the game's component; it is also loaded while the modal is on screen
 *   assetDir   (optional) folder name in public/games/ — its files are preloaded from the build-time asset index
 *   manifest   (optional) () => ({ images, sounds, pao }) when you want to list assets yourself
 *   tips       (optional) short tips for the loading modal
 *   ownIntro   true when the game draws its own start screen (so the shared intro is skipped)
 *   steps      (optional) up to three short steps shown as pills on the shared intro, e.g. ['1. Listen', '2. Tap']
 * Every game opens the same way: Pao loading modal first, then the game's intro (the shared one below, unless the
 * game has `ownIntro`), then the game. A new game gets that for free; there is nothing else to wire up.
 * A game with no manifest still works: its chunk, the files in public/games/<assetDir or slug>/ and any image or
 * sound URL found in its data are collected automatically (see loading/collectAssets.js).
 */
import { lazy } from 'react'
import {
  AudioLines, BookOpen, Blocks, Coins, Eye, Gamepad2, Image as ImageIcon, Music, Palette, Puzzle, Rocket, Search, ShoppingBasket, Siren, Sunrise, Utensils,
} from 'lucide-react'
import { paoPoses as dailyPoses } from '../daily-routines/paoPoses'
import { paoPoses as emergencyPoses } from '../emergency-ready/paoPoses'
import { paoPoses as rhymePoses } from '../rhyme-time/paoPoses'
import { paoPoses as sentencePoses } from '../sentence-builder/paoPoses'
import { paoPoses as soundPoses } from '../sound-hunt/paoPoses'

const poses = (map) => () => ({ images: [], sounds: [], pao: Object.values(map) })

export const GAME_REGISTRY = [
  { slug: 'puzzle-pieces', ownIntro: true, name: 'Puzzle Pals', icon: Puzzle, category: 'cognitive', level: 'easy', load: () => import('../../pages/games/PuzzlePiecesGame') },
  { slug: 'echo', ownIntro: true, name: 'Slow-Motion Echo', icon: AudioLines, category: 'speech', level: 'easy', load: () => import('../../pages/games/SlowMotionEchoGame') },
  { slug: 'sound-hunt', steps: ['1. Listen','2. Find the pictures','3. Tap them'], name: 'Sound Hunt', icon: Search, category: 'speech', level: 'easy', assetDir: 'sound-hunt', load: () => import('../sound-hunt/SoundHunt'), manifest: poses(soundPoses), tips: ['Say each word slowly to hear its first sound.', 'Tap the speaker to hear a word again.'] },
  { slug: 'sentence', steps: ['1. Look','2. Build','3. Check'], name: 'Sentence Builder', icon: Blocks, category: 'cognitive', level: 'medium', assetDir: 'sentence-builder', load: () => import('../sentence-builder/SentenceBuilder'), manifest: poses(sentencePoses), tips: ['Look at the picture first, then build the sentence.', 'Colors tell you what kind of word it is.'] },
  { slug: 'rhyme', steps: ['1. Listen','2. Find the rhyme','3. Tap it'], name: 'Rhyme Time', icon: Music, category: 'speech', level: 'easy', assetDir: 'rhyme-time', load: () => import('../rhyme-time/RhymeTime'), manifest: poses(rhymePoses), tips: ['Tap the speaker on any card to hear the word again.', 'Rhyming words sound the same at the end.'] },
  { slug: 'spot-difference', ownIntro: true, name: 'Spot the Difference', icon: Eye, category: 'cognitive', level: 'hard', assetDir: 'spot-the-difference', load: () => import('../../pages/games/SpotDifferencePage') },
  { slug: 'copy-colors', ownIntro: true, name: 'Copy the Colors', icon: Palette, category: 'cognitive', level: 'medium', assetDir: 'copy-the-colors', load: () => import('../../pages/games/CopyColorsPage') },
  { slug: 'story', steps: ['1. Pick a story','2. Make choices','3. Read it'], name: 'Story Builder', icon: BookOpen, category: 'cognitive', level: 'hard', assetDir: 'story-builder', load: () => import('../../components/story-builder/StoryBuilder') },
  { slug: 'alphabet', steps: ['1. Listen','2. Find the letter','3. Blast off'], name: 'Alphabet Blast', icon: Rocket, category: 'speech', level: 'medium', load: () => import('../alphabet-blast/AlphabetBlast') },
  { slug: 'emergency-ready', ownIntro: true, name: 'Emergency Ready', icon: Siren, category: 'cognitive', level: 'hard', assetDir: 'emergency-ready', load: () => import('../../pages/games/EmergencyReadyPage'), manifest: poses(emergencyPoses), tips: ['Take your time. There is no timer.', 'In a real emergency, tell a grown-up and call 911.'] },
  { slug: 'feed-pao', ownIntro: true, name: 'Feed Pao', icon: Utensils, category: 'speech', level: 'easy', assetDir: 'feed-pao', load: () => import('../../pages/games/FeedPaoPage') },
  { slug: 'daily-routines', ownIntro: true, name: 'Daily Routines', icon: Sunrise, category: 'cognitive', level: 'easy', assetDir: 'daily-routines', load: () => import('../../pages/games/DailyRoutinesPage'), manifest: poses(dailyPoses), tips: ['Think about what comes first, then what comes next.', 'Tap the speaker to hear a step.'] },
  { slug: 'money-match', ownIntro: true, name: 'Money Match', icon: Coins, category: 'cognitive', level: 'easy', assetDir: 'money-match', load: () => import('../../pages/games/MoneyMatchPage') },
  { slug: 'sort-basket', steps: ['1. Look','2. Drag the item','3. Fill the baskets'], name: 'Sort the Basket', icon: ShoppingBasket, category: 'cognitive', level: 'easy', load: () => import('../../pages/games/SortTheBasketGame') },
  { slug: 'picture-word', ownIntro: true, name: 'Picture Word Matching', icon: ImageIcon, category: 'speech', level: 'easy', load: () => import('../../components/picture-word-game/PictureWordGame') },
]

// Games the Super Admin builds in the Game Builder live in the database and share one player.
export const BUILDER_ENTRY = { slug: 'builder', name: 'Game', icon: Gamepad2, category: 'cognitive', level: 'easy', load: () => import('../../pages/BuilderGamePage') }

// Lazy components, one per slug, so a game's JS is only downloaded when it is launched.
export const GAME_COMPONENTS = Object.fromEntries([...GAME_REGISTRY, BUILDER_ENTRY].map((g) => [g.slug, lazy(g.load)]))

export const findGame = (slug) => GAME_REGISTRY.find((g) => g.slug === slug) || null

// The registry entry for a card. Builder games (and any card not listed yet) are described on the fly.
export function entryForCard(card) {
  if (!card) return null
  if (card.builder) {
    return { ...BUILDER_ENTRY, slug: `builder:${card.title}`, name: card.title, definitionUrl: `/api/games/by-name?name=${encodeURIComponent(card.title)}` }
  }
  return findGame(card.id) || { slug: card.id, name: card.title || 'Game', icon: Gamepad2, category: card.category || 'cognitive', level: card.difficulty || 'easy', load: () => Promise.resolve() }
}

// Does this card show the shared game intro after loading? (Builder games and any new game: yes.)
export const needsIntro = (card) => !entryForCard(card)?.ownIntro
