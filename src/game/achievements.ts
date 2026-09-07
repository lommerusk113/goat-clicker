import { BUILDINGS } from './buildings'
import { baseGoatsPerSecond, totalBuildings } from './economy'
import type { AchievementDef, BuildingId, GameState } from './types'

function totalGoats(n: number, id: string, name: string, icon: string): AchievementDef {
  return {
    id,
    name,
    icon,
    desc: `Herd ${n.toLocaleString('en-US')} goats, all-time.`,
    earned: (s) => s.totalGoats >= n,
  }
}

function ownBuilding(building: BuildingId, n: number, name: string): AchievementDef {
  const def = BUILDINGS.find((b) => b.id === building)!
  return {
    id: `own-${building}-${n}`,
    name,
    icon: def.icon,
    desc: `Own ${n} ${def.name}${n === 1 ? '' : 's'}.`,
    earned: (s) => s.buildings[building] >= n,
  }
}

export const ACHIEVEMENTS: AchievementDef[] = [
  // First steps
  {
    id: 'first-goat',
    name: 'Hello, Goat',
    icon: '🐐',
    desc: 'Pet the goat once.',
    earned: (s) => s.clicks >= 1,
  },
  totalGoats(100, 'goats-100', 'Small Herd', '🌱'),
  totalGoats(10_000, 'goats-10k', 'Proper Farm', '🌿'),
  totalGoats(1_000_000, 'goats-1m', 'Goat Baron', '🎩'),
  totalGoats(100_000_000, 'goats-100m', 'Bleat Tycoon', '💼'),
  totalGoats(1_000_000_000_000, 'goats-1t', 'Peak Goat', '⛰️'),

  // Buildings, broad
  {
    id: 'build-1',
    name: 'Ground Broken',
    icon: '🔨',
    desc: 'Own your first building.',
    earned: (s) => totalBuildings(s) >= 1,
  },
  {
    id: 'build-50',
    name: 'Zoning Dispute',
    icon: '📐',
    desc: 'Own 50 buildings.',
    earned: (s) => totalBuildings(s) >= 50,
  },
  {
    id: 'build-200',
    name: 'The Goat Estate',
    icon: '🏘️',
    desc: 'Own 200 buildings.',
    earned: (s) => totalBuildings(s) >= 200,
  },
  {
    id: 'build-400',
    name: 'Landlord of Ungulates',
    icon: '🗺️',
    desc: 'Own 400 buildings.',
    earned: (s) => totalBuildings(s) >= 400,
  },
  {
    id: 'build-all',
    name: 'Full Portfolio',
    icon: '🧩',
    desc: 'Own at least one of every building.',
    earned: (s) => BUILDINGS.every((b) => s.buildings[b.id] >= 1),
  },

  // Buildings, specific
  ownBuilding('pen', 50, 'Fence Enthusiast'),
  ownBuilding('meadow', 50, 'Grass Fed'),
  ownBuilding('dairy', 25, 'Big Cheese'),
  ownBuilding('yoga', 25, 'Namaste in Bed'),
  ownBuilding('lab', 10, 'Copy That'),
  ownBuilding('portal', 1, 'It Bleats Back'),
  ownBuilding('cosmos', 1, 'Star Goat'),

  // Petting
  {
    id: 'clicks-100',
    name: 'Good Boy',
    icon: '👋',
    desc: 'Pet the goat 100 times.',
    earned: (s) => s.clicks >= 100,
  },
  {
    id: 'clicks-1000',
    name: 'Repetitive Strain',
    icon: '🖐️',
    desc: 'Pet the goat 1,000 times.',
    earned: (s) => s.clicks >= 1_000,
  },
  {
    id: 'clicks-10000',
    name: 'Hands of the Shepherd',
    icon: '🙌',
    desc: 'Pet the goat 10,000 times.',
    earned: (s) => s.clicks >= 10_000,
  },
  {
    id: 'clicks-goats-1m',
    name: 'Done By Hand',
    icon: '💪',
    desc: 'Gather 1,000,000 goats by petting alone.',
    earned: (s) => s.goatsFromClicks >= 1_000_000,
  },

  // Rate
  {
    id: 'gps-100',
    name: 'Steady Stream',
    icon: '💧',
    desc: 'Reach 100 goats per second.',
    earned: (s) => baseGoatsPerSecond(s) >= 100,
  },
  {
    id: 'gps-10k',
    name: 'Stampede',
    icon: '🌊',
    desc: 'Reach 10,000 goats per second.',
    earned: (s) => baseGoatsPerSecond(s) >= 10_000,
  },
  {
    id: 'gps-1m',
    name: 'Herd Immunity',
    icon: '🌪️',
    desc: 'Reach 1,000,000 goats per second.',
    earned: (s) => baseGoatsPerSecond(s) >= 1_000_000,
  },

  // Golden goats
  {
    id: 'golden-1',
    name: 'Caught One',
    icon: '⭐',
    desc: 'Click a golden goat.',
    earned: (s) => s.goldenClicks >= 1,
  },
  {
    id: 'golden-7',
    name: 'Lucky Seven',
    icon: '🍀',
    desc: 'Click 7 golden goats.',
    earned: (s) => s.goldenClicks >= 7,
  },
  {
    id: 'golden-27',
    name: 'Gold Rush',
    icon: '🏆',
    desc: 'Click 27 golden goats.',
    earned: (s) => s.goldenClicks >= 27,
  },

  // Upgrades and time
  {
    id: 'upgrades-10',
    name: 'Shopping List',
    icon: '🧾',
    desc: 'Buy 10 upgrades.',
    earned: (s) => s.upgrades.length >= 10,
  },
  {
    id: 'upgrades-30',
    name: 'Fully Kitted',
    icon: '🎒',
    desc: 'Buy 30 upgrades.',
    earned: (s) => s.upgrades.length >= 30,
  },
  {
    id: 'playtime-1h',
    name: 'Long Afternoon',
    icon: '🕰️',
    desc: 'Play for one hour.',
    earned: (s) => s.playTime >= 3_600,
  },
]

/** Achievements newly earned since the last check. */
export function newlyEarned(state: GameState): AchievementDef[] {
  return ACHIEVEMENTS.filter((a) => !state.achievements.includes(a.id) && a.earned(state))
}
