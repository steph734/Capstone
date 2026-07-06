import OwnerPageShell from './OwnerPageShell'
import { getOwnerMenuItems } from './ownerSidebarConfig'
import GamifiedActivitiesOverview from '../GamifiedActivitiesOverview'

const PATIENTS = [
  { id: 0,  name: 'Alvrin',          age: 14, branch: 'Main',  therapist: 'Marco Reyes', avatar: 'https://i.pravatar.cc/150?img=33', level: 9,  xp: 340, xpNeeded: 500, gamesCompleted: 41, badges: 7, favoriteGame: 'Picture-Word Matching', lastPlayed: 'Jul 5, 2026', stats: { intelligence: 72, focus: 58, resistance: 64, creativity: 70, speed: 45, memory: 66 } },
  { id: 1,  name: 'Aira Lopez',     age: 8,  branch: 'Main',  therapist: 'Marco Reyes', avatar: 'https://i.pravatar.cc/150?img=47', level: 4,  xp: 120, xpNeeded: 300, gamesCompleted: 18, badges: 3, favoriteGame: 'Picture-Word Matching', lastPlayed: 'Jul 4, 2026', stats: { intelligence: 45, focus: 38, resistance: 40, creativity: 52, speed: 60, memory: 41 } },
  { id: 2,  name: 'Noah Cruz',       age: 10, branch: 'Main',  therapist: 'Marco Reyes', avatar: 'https://i.pravatar.cc/150?img=11', level: 2,  xp: 60,  xpNeeded: 200, gamesCompleted: 9,  badges: 1, favoriteGame: 'Picture-Word Matching', lastPlayed: 'Jun 28, 2026', stats: { intelligence: 30, focus: 26, resistance: 32, creativity: 35, speed: 40, memory: 28 } },
  { id: 3,  name: 'Mika Santos',     age: 6,  branch: 'Main',  therapist: 'Marco Reyes', avatar: 'https://i.pravatar.cc/150?img=45', level: 6,  xp: 210, xpNeeded: 400, gamesCompleted: 27, badges: 5, favoriteGame: 'Rhyme Time', lastPlayed: 'Jul 3, 2026', stats: { intelligence: 55, focus: 48, resistance: 50, creativity: 62, speed: 44, memory: 58 } },
  { id: 4,  name: 'Lily Santos',     age: 9,  branch: 'North', therapist: 'Jade Tan',    avatar: 'https://i.pravatar.cc/150?img=32', level: 5,  xp: 160, xpNeeded: 350, gamesCompleted: 21, badges: 4, favoriteGame: 'Sound Hunt', lastPlayed: 'Jul 5, 2026', stats: { intelligence: 48, focus: 44, resistance: 46, creativity: 50, speed: 55, memory: 47 } },
  { id: 5,  name: 'Jasper Reyes',    age: 11, branch: 'North', therapist: 'Jade Tan',    avatar: 'https://i.pravatar.cc/150?img=14', level: 8,  xp: 300, xpNeeded: 500, gamesCompleted: 38, badges: 7, favoriteGame: 'Alphabet Blast', lastPlayed: 'Jul 4, 2026', stats: { intelligence: 66, focus: 58, resistance: 70, creativity: 60, speed: 50, memory: 64 } },
  { id: 6,  name: 'Sofia Reyes',     age: 12, branch: 'North', therapist: 'Jade Tan',    avatar: 'https://i.pravatar.cc/150?img=49', level: 11, xp: 410, xpNeeded: 600, gamesCompleted: 55, badges: 10, favoriteGame: 'Story Builder', lastPlayed: 'Jul 5, 2026', stats: { intelligence: 80, focus: 70, resistance: 75, creativity: 88, speed: 55, memory: 74 } },
  { id: 7,  name: 'Emma Villanueva', age: 9,  branch: 'Cebu',  therapist: 'Andre Lim',   avatar: 'https://i.pravatar.cc/150?img=44', level: 1,  xp: 20,  xpNeeded: 150, gamesCompleted: 4,  badges: 0, favoriteGame: 'Picture-Word Matching', lastPlayed: 'Jun 24, 2026', stats: { intelligence: 20, focus: 18, resistance: 22, creativity: 25, speed: 30, memory: 19 } },
  { id: 8,  name: 'Carlos Mendez',   age: 11, branch: 'Cebu',  therapist: 'Andre Lim',   avatar: 'https://i.pravatar.cc/150?img=13', level: 7,  xp: 260, xpNeeded: 450, gamesCompleted: 33, badges: 6, favoriteGame: 'Sound Hunt', lastPlayed: 'Jul 4, 2026', stats: { intelligence: 60, focus: 52, resistance: 68, creativity: 55, speed: 40, memory: 57 } },
  { id: 9,  name: 'Isabella Park',   age: 5,  branch: 'Cebu',  therapist: 'Andre Lim',   avatar: 'https://i.pravatar.cc/150?img=48', level: 3,  xp: 90,  xpNeeded: 250, gamesCompleted: 14, badges: 2, favoriteGame: 'Picture-Word Matching', lastPlayed: 'Jun 30, 2026', stats: { intelligence: 36, focus: 30, resistance: 34, creativity: 40, speed: 48, memory: 33 } },
  { id: 10, name: 'Maya Torres',     age: 7,  branch: 'Main',  therapist: 'Marco Reyes', avatar: 'https://i.pravatar.cc/150?img=46', level: 1,  xp: 10,  xpNeeded: 150, gamesCompleted: 2,  badges: 0, favoriteGame: 'Picture-Word Matching', lastPlayed: 'Jun 20, 2026', stats: { intelligence: 15, focus: 14, resistance: 18, creativity: 20, speed: 25, memory: 16 } },
  { id: 11, name: 'Liam Tan',        age: 7,  branch: 'North', therapist: 'Jade Tan',    avatar: 'https://i.pravatar.cc/150?img=15', level: 5,  xp: 150, xpNeeded: 350, gamesCompleted: 22, badges: 4, favoriteGame: 'Alphabet Blast', lastPlayed: 'Jul 2, 2026', stats: { intelligence: 48, focus: 42, resistance: 45, creativity: 50, speed: 58, memory: 46 } },
  { id: 12, name: 'Jake Rivera',     age: 8,  branch: 'Cebu',  therapist: 'Andre Lim',   avatar: 'https://i.pravatar.cc/150?img=12', level: 4,  xp: 110, xpNeeded: 300, gamesCompleted: 17, badges: 3, favoriteGame: 'Sound Hunt', lastPlayed: 'Jul 1, 2026', stats: { intelligence: 42, focus: 44, resistance: 38, creativity: 46, speed: 62, memory: 40 } },
]

export default function OwnerGamifiedActivitiesPage({ user, onLogout, betaTier }) {
  return (
    <GamifiedActivitiesOverview
      Shell={OwnerPageShell}
      shellProps={{
        user,
        onLogout,
        title: 'Gamified Activities',
        subtitle: 'Track patient engagement with gamified exercises across all branches',
        menuItems: getOwnerMenuItems(betaTier),
        beta: true,
      }}
      patients={PATIENTS}
      showBranchColumn
    />
  )
}
