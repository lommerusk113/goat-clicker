import { BUILDINGS, BUILDING_BY_ID } from './buildings'
import { OCCULT_UPGRADES } from './upgrades'
import { baseGoatsPerSecond, totalBuildings } from './economy'
import type { AchievementDef, BuildingId, GameState } from './types'

function totalGoats(n: number, id: string, name: string, icon: string): AchievementDef {
  return {
    id,
    name,
    icon,
    desc: `Herd ${n.toLocaleString('en-US')} goats this ascension.`,
    earned: (s) => s.totalGoats >= n,
  }
}

function ownBuilding(building: BuildingId, n: number, name: string): AchievementDef {
  const def = BUILDING_BY_ID[building]
  return {
    id: `own-${building}-${n}`,
    name,
    icon: def.icon,
    desc: `Own ${n} ${def.name}${n === 1 ? '' : 's'}.`,
    earned: (s) => s.buildings[building] >= n,
  }
}

/** Units owned of each building that earn a badge. */
const BUILDING_MILESTONES = [50, 100, 200, 300, 400, 500]

/** One badge name per milestone, per building. */
const BUILDING_BADGES: Record<BuildingId, string[]> = {
  post: ['Scratch That', 'Itch Economy', 'Bark Stripped Bare', 'Scratch Fever', 'Bark Lord', 'Post-Everything'],
  meadow: ['Grass Fed', 'Rolling Hills', 'Sea of Green', 'Grass Kingdom', 'Horizon of Hay', 'Continent of Clover'],
  barn: ['Raise the Roof', 'Barn Storm', 'Hay Fever', 'Barn Metropolis', 'Roof of the World', 'All Barn, No Bite'],
  dairy: ['Big Cheese', 'Curd Nerd', 'Wheel of Fortune', 'Cheese Planet', 'Fondue Ocean', 'Gouda Gravity'],
  yoga: ['Namaste in Bed', 'Hoof to Spine', 'Enlightened, Trampled', 'Global Om', 'Namaste, Universe', 'Downward Everything'],
  ranch: ['Head for Heights', 'Cliffhanger', 'Above the Clouds', 'Range of Ranges', 'Summit Collector', 'Sky Pasture'],
  lab: ['Copy That', 'Ctrl+G', 'Send in the Clones', 'Clone Continent', 'Gene Pool Party', 'Xerox Nation'],
  portal: ['Doorstep of Elsewhere', 'Revolving Door', 'Pasture Dimension Resident', 'Portal Storm', 'Doors All the Way Down', 'Nowhere Left Unopened'],
  temple: ['Devout', 'Hymn Sheet', 'One Long Note', 'Cathedral Choir', 'Sacred Sprawl', 'Bleat Eternal'],
  cosmos: ['Constellation Prize', 'Milky Way', 'Universal Herd', 'Galaxy Goat', 'Cluster Herder', 'Local Group Landlord'],
  circle: ['Candlelit', 'Chalk Outline', 'Ring of Bleat', 'Ritual Season', 'Candle Economy', 'Wax Museum'],
  void: ['Into the Nothing', 'Grazing the Abyss', 'The Void Bleats Back', 'Void Baron', 'Nothing Everywhere', 'Owner of the Absence'],
  elder: ['Audience Granted', 'Council of Elders', 'Older Than Fences', 'Elder Council', 'Older Than Time', 'The First and Last'],
}

function totalGilds(s: GameState): number {
  return BUILDINGS.reduce((n, b) => n + s.gilds[b.id], 0)
}

function mostGilds(s: GameState): number {
  return Math.max(...BUILDINGS.map((b) => s.gilds[b.id]))
}

function buildingBadges(): AchievementDef[] {
  return BUILDINGS.flatMap((b) =>
    BUILDING_MILESTONES.map((n, i) => ownBuilding(b.id, n, BUILDING_BADGES[b.id][i])),
  )
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
  totalGoats(10_000_000_000, 'goats-10b', 'Goat Magnate', '🏦'),
  totalGoats(1_000_000_000_000, 'goats-1t', 'Peak Goat', '⛰️'),
  totalGoats(100_000_000_000_000, 'goats-100t', 'Beyond Counting', '♾️'),
  totalGoats(1e15, 'goats-1qa', 'Quadrillionaire', '💎'),
  totalGoats(1e18, 'goats-1qi', 'Astronomical', '🔭'),
  totalGoats(1e21, 'goats-1sx', 'Sextillion Shepherd', '🪐'),
  totalGoats(1e24, 'goats-1sp', 'Septillion Sovereign', '🌠'),
  totalGoats(1e27, 'goats-1oc', 'Numbers Have Lost Meaning', '🧮'),

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
    id: 'build-800',
    name: 'Sprawl',
    icon: '🏙️',
    desc: 'Own 800 buildings.',
    earned: (s) => totalBuildings(s) >= 800,
  },
  {
    id: 'build-1500',
    name: 'Goatropolis',
    icon: '🌆',
    desc: 'Own 1,500 buildings.',
    earned: (s) => totalBuildings(s) >= 1_500,
  },
  {
    id: 'build-2500',
    name: 'Megagoatropolis',
    icon: '🏗️',
    desc: 'Own 2,500 buildings.',
    earned: (s) => totalBuildings(s) >= 2_500,
  },
  {
    id: 'build-4000',
    name: 'Planet of Pens',
    icon: '🌍',
    desc: 'Own 4,000 buildings.',
    earned: (s) => totalBuildings(s) >= 4_000,
  },
  {
    id: 'build-all',
    name: 'Full Portfolio',
    icon: '🧩',
    desc: 'Own at least one of every building.',
    earned: (s) => BUILDINGS.every((b) => s.buildings[b.id] >= 1),
  },

  // Buildings, specific
  ownBuilding('portal', 1, 'It Bleats Back'),
  ownBuilding('cosmos', 1, 'Star Goat'),
  ownBuilding('circle', 1, 'First Candle'),
  ownBuilding('void', 1, 'Nothing to See'),
  ownBuilding('elder', 1, 'It Sees You'),
  ...buildingBadges(),

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
    id: 'clicks-100000',
    name: 'Carpal Tunnel',
    icon: '🦴',
    desc: 'Pet the goat 100,000 times.',
    earned: (s) => s.clicks >= 100_000,
  },
  {
    id: 'clicks-goats-1m',
    name: 'Done By Hand',
    icon: '💪',
    desc: 'Gather 1,000,000 goats by petting alone.',
    earned: (s) => s.goatsFromClicks >= 1_000_000,
  },
  {
    id: 'clicks-goats-1b',
    name: 'Handcrafted Herd',
    icon: '🧤',
    desc: 'Gather 1,000,000,000 goats by petting alone.',
    earned: (s) => s.goatsFromClicks >= 1_000_000_000,
  },
  {
    id: 'clicks-goats-1t',
    name: 'Artisanal',
    icon: '🫳',
    desc: 'Gather 1,000,000,000,000 goats by petting alone.',
    earned: (s) => s.goatsFromClicks >= 1_000_000_000_000,
  },
  {
    id: 'clicks-1m',
    name: 'One Million Pets',
    icon: '🖱️',
    desc: 'Pet the goat 1,000,000 times.',
    earned: (s) => s.clicks >= 1_000_000,
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
  {
    id: 'gps-100m',
    name: 'Landslide',
    icon: '🪨',
    desc: 'Reach 100,000,000 goats per second.',
    earned: (s) => baseGoatsPerSecond(s) >= 100_000_000,
  },
  {
    id: 'gps-10b',
    name: 'Eruption',
    icon: '🌋',
    desc: 'Reach 10,000,000,000 goats per second.',
    earned: (s) => baseGoatsPerSecond(s) >= 10_000_000_000,
  },
  {
    id: 'gps-1t',
    name: 'Bleat Horizon',
    icon: '🌩️',
    desc: 'Reach 1,000,000,000,000 goats per second.',
    earned: (s) => baseGoatsPerSecond(s) >= 1_000_000_000_000,
  },
  {
    id: 'gps-100t',
    name: 'Cosmic Stampede',
    icon: '☄️',
    desc: 'Reach 100 trillion goats per second.',
    earned: (s) => baseGoatsPerSecond(s) >= 1e14,
  },
  {
    id: 'gps-100qa',
    name: 'Beyond Physics',
    icon: '⚛️',
    desc: 'Reach 100 quadrillion goats per second.',
    earned: (s) => baseGoatsPerSecond(s) >= 1e17,
  },
  {
    id: 'gps-100qi',
    name: 'The Bleat That Ends Worlds',
    icon: '💥',
    desc: 'Reach 100 quintillion goats per second.',
    earned: (s) => baseGoatsPerSecond(s) >= 1e20,
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
  {
    id: 'golden-77',
    name: 'Jackpot',
    icon: '🎰',
    desc: 'Click 77 golden goats.',
    earned: (s) => s.goldenClicks >= 77,
  },
  {
    id: 'golden-177',
    name: 'Golden Age',
    icon: '🌟',
    desc: 'Click 177 golden goats.',
    earned: (s) => s.goldenClicks >= 177,
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
    id: 'upgrades-60',
    name: 'Everything Must Go',
    icon: '🛒',
    desc: 'Buy 60 upgrades.',
    earned: (s) => s.upgrades.length >= 60,
  },
  {
    id: 'upgrades-100',
    name: 'Collector',
    icon: '🗃️',
    desc: 'Buy 100 upgrades.',
    earned: (s) => s.upgrades.length >= 100,
  },
  {
    id: 'upgrades-130',
    name: 'Nothing Left to Buy',
    icon: '🏷️',
    desc: 'Buy 130 upgrades.',
    earned: (s) => s.upgrades.length >= 130,
  },
  {
    id: 'playtime-1h',
    name: 'Long Afternoon',
    icon: '🕰️',
    desc: 'Play for one hour.',
    earned: (s) => s.playTime >= 3_600,
  },
  {
    id: 'playtime-1d',
    name: 'Committed',
    icon: '📅',
    desc: 'Play for a full day, all told.',
    earned: (s) => s.playTime >= 86_400,
  },

  // Ascension
  {
    id: 'ascend-1',
    name: 'Born Again',
    icon: '🕯️',
    desc: 'Ascend once.',
    earned: (s) => s.ascensions >= 1,
  },
  {
    id: 'ascend-3',
    name: 'Old Soul',
    icon: '🔁',
    desc: 'Ascend 3 times.',
    earned: (s) => s.ascensions >= 3,
  },
  {
    id: 'ascend-10',
    name: 'Eternal Return',
    icon: '♻️',
    desc: 'Ascend 10 times.',
    earned: (s) => s.ascensions >= 10,
  },
  {
    id: 'ascend-20',
    name: 'Wheel of Bleat',
    icon: '🎡',
    desc: 'Ascend 20 times.',
    earned: (s) => s.ascensions >= 20,
  },
  {
    id: 'ascend-50',
    name: 'Samsara',
    icon: '☸️',
    desc: 'Ascend 50 times.',
    earned: (s) => s.ascensions >= 50,
  },
  {
    id: 'occult-10',
    name: 'Dabbler',
    icon: '🔮',
    desc: 'Earn 10 occult points, all told.',
    earned: (s) => s.occultEarned >= 10,
  },
  {
    id: 'occult-100',
    name: 'Occultist',
    icon: '🧿',
    desc: 'Earn 100 occult points, all told.',
    earned: (s) => s.occultEarned >= 100,
  },
  {
    id: 'occult-300',
    name: 'High Priest of Bleat',
    icon: '🐏',
    desc: 'Earn 300 occult points, all told.',
    earned: (s) => s.occultEarned >= 300,
  },
  {
    id: 'occult-600',
    name: 'Archbishop of Bleat',
    icon: '🔱',
    desc: 'Earn 600 occult points, all told.',
    earned: (s) => s.occultEarned >= 600,
  },
  {
    id: 'occult-1000',
    name: 'The Goat Beyond',
    icon: '🌌',
    desc: 'Earn 1,000 occult points, all told.',
    earned: (s) => s.occultEarned >= 1_000,
  },

  // Gilds
  {
    id: 'gilds-10',
    name: 'Gilded Herd',
    icon: '💛',
    desc: 'Hold 10 gilds.',
    earned: (s) => totalGilds(s) >= 10,
  },
  {
    id: 'gilds-25',
    name: 'Fort Knox Farm',
    icon: '🏅',
    desc: 'Hold 25 gilds.',
    earned: (s) => totalGilds(s) >= 25,
  },
  {
    id: 'gilds-one-5',
    name: 'All Eggs, One Basket',
    icon: '🧺',
    desc: 'Have 5 gilds on a single building.',
    earned: (s) => mostGilds(s) >= 5,
  },
  {
    id: 'gilds-one-10',
    name: 'Golden Idol',
    icon: '🗿',
    desc: 'Have 10 gilds on a single building.',
    earned: (s) => mostGilds(s) >= 10,
  },
  {
    id: 'occult-all',
    name: 'Well Read',
    icon: '📖',
    desc: 'Own every occult upgrade.',
    earned: (s) => OCCULT_UPGRADES.every((u) => s.upgrades.includes(u.id)),
  },
]

/** Achievements newly earned since the last check. */
export function newlyEarned(state: GameState): AchievementDef[] {
  return ACHIEVEMENTS.filter((a) => !state.achievements.includes(a.id) && a.earned(state))
}
