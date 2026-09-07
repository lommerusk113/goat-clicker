import type { BuildingDef, BuildingId } from './types'

/**
 * The herd's production lines, cheapest first. Costs grow by COST_GROWTH per
 * unit owned, so the ordering here is also the unlock order in the store.
 */
export const BUILDINGS: BuildingDef[] = [
  {
    id: 'pen',
    name: 'Goat Pen',
    icon: '🚧',
    baseCost: 15,
    baseCps: 0.1,
    blurb: 'A few planks and a gate. The goats eat the planks.',
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
    baseCps: 8,
    blurb: 'Somewhere warm to sleep. The goats sleep on the roof anyway.',
  },
  {
    id: 'dairy',
    name: 'Cheese Dairy',
    icon: '🧀',
    baseCost: 12_000,
    baseCps: 47,
    blurb: 'Turns milk into cheese, and cheese into more goats. Do not ask.',
  },
  {
    id: 'yoga',
    name: 'Goat Yoga Studio',
    icon: '🧘',
    baseCost: 130_000,
    baseCps: 260,
    blurb: 'Humans pay to be stood on. The goats have never been happier.',
  },
  {
    id: 'ranch',
    name: 'Mountain Ranch',
    icon: '🏔️',
    baseCost: 1_400_000,
    baseCps: 1_400,
    blurb: 'High pasture, thin air, absurdly confident climbing.',
  },
  {
    id: 'lab',
    name: 'Cloning Lab',
    icon: '🧬',
    baseCost: 20_000_000,
    baseCps: 7_800,
    blurb: 'Copy of a copy of a goat. Still headbutts exactly as hard.',
  },
  {
    id: 'portal',
    name: 'Goat Portal',
    icon: '🌀',
    baseCost: 330_000_000,
    baseCps: 44_000,
    blurb: 'A doorway to the pasture dimension. It bleats back.',
  },
  {
    id: 'temple',
    name: 'Bleat Temple',
    icon: '🛕',
    baseCost: 5_100_000_000,
    baseCps: 260_000,
    blurb: 'The old hymns are just one long sustained note.',
  },
  {
    id: 'cosmos',
    name: 'Cosmic Herd',
    icon: '🌌',
    baseCost: 75_000_000_000,
    baseCps: 1_600_000,
    blurb: 'Constellations rearranged into the shape of a very large goat.',
  },
]

export const BUILDING_IDS: BuildingId[] = BUILDINGS.map((b) => b.id)

export const BUILDING_BY_ID: Record<BuildingId, BuildingDef> = Object.fromEntries(
  BUILDINGS.map((b) => [b.id, b]),
) as Record<BuildingId, BuildingDef>
