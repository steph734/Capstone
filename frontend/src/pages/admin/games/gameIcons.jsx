import {
  Activity, Apple, Brain, Cat, Clock, Coins, Drum, Ear, Flower2, Footprints, Gamepad2, Hand, Heart, Image, BookOpen, Mic, Moon, Music,
  Palette, Puzzle, Rocket, Search, ShieldAlert, ShoppingBasket, Smile, Star, Sun, Turtle, Type, Utensils, Car,
} from 'lucide-react'

// The game icon set. A game stores just the NAME (e.g. "mic") in its `icon`
// field — no emojis — and every screen draws it through <GameIcon>.
export const GAME_ICONS = {
  'gamepad-2': Gamepad2, mic: Mic, puzzle: Puzzle, image: Image, 'book-open': BookOpen, ear: Ear, smile: Smile, clock: Clock, music: Music,
  coins: Coins, utensils: Utensils, search: Search, 'shield-alert': ShieldAlert, palette: Palette, turtle: Turtle, type: Type,
  'shopping-basket': ShoppingBasket, star: Star, heart: Heart, brain: Brain, hand: Hand, footprints: Footprints, apple: Apple, cat: Cat,
  rocket: Rocket, sun: Sun, moon: Moon, 'flower-2': Flower2, car: Car, drum: Drum, activity: Activity,
}
export const GAME_ICON_NAMES = Object.keys(GAME_ICONS)

export function GameIcon({ name, size = 22, color, strokeWidth = 2 }) {
  const Cmp = GAME_ICONS[name] || Gamepad2
  return <Cmp size={size} color={color} strokeWidth={strokeWidth} aria-hidden="true" />
}

// Skill areas and their colours (cover = tint, icon = colour).
export const SKILLS = {
  speech: { id: 'speech', label: 'Speech', long: 'Speech & language', color: '#1FA58A', tint: '#D6F0E8', icon: Mic },
  cognitive: { id: 'cognitive', label: 'Cognitive', long: 'Cognitive', color: '#7C5CE0', tint: '#E4DDFA', icon: Brain },
  sel: { id: 'sel', label: 'Attention / SEL', long: 'Attention / SEL', color: '#E0457F', tint: '#FADCE8', icon: Smile },
  occupational: { id: 'occupational', label: 'Occupational', long: 'Occupational', color: '#D98A06', tint: '#FCEBC6', icon: Hand },
  physical: { id: 'physical', label: 'Physical', long: 'Physical / motor', color: '#3B82C4', tint: '#D8E8F7', icon: Activity },
}
export const skillOf = (id) => SKILLS[id] || SKILLS.cognitive
// Owner-request skills -> the same colours.
export const REQUEST_SKILL = { speech: 'speech', cognitive: 'cognitive', sel: 'sel', gross_motor: 'physical', fine_motor: 'occupational' }
