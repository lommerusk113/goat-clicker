import type { BuildingDef, BuildingId } from './types'

/**
 * The herd's production lines, cheapest first. Costs grow by BALANCE.costGrowth
 * per unit owned, so the ordering here is also the unlock order in the store.
 * Each line costs about 2.4 times more per goat-per-second than the one before.
 * The balance simulator (src/game/sim.test.ts) is the source of truth for how
 * this table paces out; retune there before touching numbers here.
 * The last three are priced far above what one run's production can reach, so
 * in practice they are bought with the occult bonus from a few ascensions.
 */
export const BUILDINGS: BuildingDef[] = [
  {
    id: 'post',
    name: 'Scratching Post',
    icon: '🪵',
    baseCost: 15,
    baseCps: 0.3,
    baseClick: 0.2,
    blurb: 'Goats queue up to be scratched. It counts as petting.',
  },
  {
    id: 'meadow',
    name: 'Meadow',
    icon: '🌾',
    baseCost: 100,
    baseCps: 1,
    blurb: 'Grass, sunshine, and the faint sound of chewing.',
  },
  {
    id: 'barn',
    name: 'Barn',
    icon: '🛖',
    baseCost: 1_100,
    baseCps: 5,
    blurb: 'Somewhere warm to sleep. The goats sleep on the roof anyway.',
  },
  {
    id: 'dairy',
    name: 'Cheese Dairy',
    icon: '🧀',
    baseCost: 12_000,
    baseCps: 23,
    blurb: 'Turns milk into cheese, and cheese into more goats. Do not ask.',
  },
  {
    id: 'yoga',
    name: 'Goat Yoga Studio',
    icon: '🧘',
    baseCost: 130_000,
    baseCps: 100,
    blurb: 'Humans pay to be stood on. The goats have never been happier.',
  },
  {
    id: 'ranch',
    name: 'Mountain Ranch',
    icon: '🏔️',
    baseCost: 1_400_000,
    baseCps: 450,
    blurb: 'High pasture, thin air, absurdly confident climbing.',
  },
  {
    id: 'lab',
    name: 'Cloning Lab',
    icon: '🧬',
    baseCost: 20_000_000,
    baseCps: 2_700,
    blurb: 'Copy of a copy of a goat. Still headbutts exactly as hard.',
  },
  {
    id: 'portal',
    name: 'Goat Portal',
    icon: '🌀',
    baseCost: 330_000_000,
    baseCps: 18_000,
    blurb: 'A doorway to the pasture dimension. It bleats back.',
  },
  {
    id: 'temple',
    name: 'Bleat Temple',
    icon: '🛕',
    baseCost: 5_100_000_000,
    baseCps: 120_000,
    blurb: 'The old hymns are just one long sustained note.',
  },
  {
    id: 'cosmos',
    name: 'Cosmic Herd',
    icon: '🌌',
    baseCost: 75_000_000_000,
    baseCps: 750_000,
    blurb: 'Constellations rearranged into the shape of a very large goat.',
  },
  {
    id: 'circle',
    name: 'Ritual Circle',
    icon: '🕯️',
    baseCost: 5_000_000_000_000,
    baseCps: 20_000_000,
    blurb: 'Thirteen candles, one goat, and a hum you feel in your teeth.',
  },
  {
    id: 'void',
    name: 'Void Pasture',
    icon: '🕳️',
    baseCost: 250_000_000_000_000,
    baseCps: 400_000_000,
    blurb: 'Grass grows there. Nothing else does. The goats do not mind.',
  },
  {
    id: 'elder',
    name: 'The Elder Goat',
    icon: '👁️',
    baseCost: 2_500_000_000_000_000,
    baseCps: 10_000_000_000,
    blurb: 'It was here before the first fence. It will outlast the last.',
  },
]

export const BUILDING_IDS: BuildingId[] = BUILDINGS.map((b) => b.id)

export const BUILDING_BY_ID: Record<BuildingId, BuildingDef> = Object.fromEntries(
  BUILDINGS.map((b) => [b.id, b]),
) as Record<BuildingId, BuildingDef>
