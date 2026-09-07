import { BUILDINGS, BUILDING_IDS } from './buildings'
import { UPGRADE_BY_ID } from './upgrades'
import type { BuildingDef, BuildingId, GameState, Stats } from './types'

/** Each unit of a building costs 15% more than the last. */
export const COST_GROWTH = 1.15

export function costOf(def: BuildingDef, owned: number): number {
  return Math.ceil(def.baseCost * COST_GROWTH ** owned)
}

/** Price of the next `count` units, at their escalating prices. */
export function bulkCost(def: BuildingDef, owned: number, count: number): number {
  let total = 0
  for (let i = 0; i < count; i++) total += costOf(def, owned + i)
  return total
}

export function totalBuildings(state: GameState): number {
  let n = 0
  for (const id of BUILDING_IDS) n += state.buildings[id]
  return n
}

export interface Multipliers {
  building: Record<BuildingId, number>
  global: number
  clickFlat: number
  clickMult: number
  clickCpsPercent: number
  goldenFreq: number
  goldenLife: number
  goldenPower: number
}

/** Everything the player's purchased upgrades add up to. */
export function multipliers(state: GameState): Multipliers {
  const building = Object.fromEntries(BUILDING_IDS.map((id) => [id, 1])) as Record<
    BuildingId,
    number
  >
  const m: Multipliers = {
    building,
    global: 1,
    clickFlat: 0,
    clickMult: 1,
    clickCpsPercent: 0,
    goldenFreq: 1,
    goldenLife: 1,
    goldenPower: 1,
  }

  for (const id of state.upgrades) {
    const def = UPGRADE_BY_ID.get(id)
    if (!def) continue
    const e = def.effect
    switch (e.type) {
      case 'buildingMult':
        m.building[e.building] *= e.factor
        break
      case 'clickFlat':
        m.clickFlat += e.amount
        break
      case 'clickMult':
        m.clickMult *= e.factor
        break
      case 'clickFromCps':
        m.clickCpsPercent += e.percent
        break
      case 'globalMult':
        m.global *= e.factor
        break
      case 'globalPerAchievement':
        m.global *= 1 + (state.achievements.length * e.percent) / 100
        break
      case 'goldenFreq':
        m.goldenFreq *= e.factor
        break
      case 'goldenLife':
        m.goldenLife *= e.factor
        break
      case 'goldenPower':
        m.goldenPower *= e.factor
        break
    }
  }
  return m
}

function buffMult(state: GameState, kind: 'gpsMult' | 'clickMult'): number {
  let f = 1
  for (const b of state.buffs) if (b.kind === kind) f *= b.factor
  return f
}

/** Production per second before golden-goat buffs. Click bonuses key off this. */
export function baseGoatsPerSecond(state: GameState, m = multipliers(state)): number {
  let gps = 0
  for (const b of BUILDINGS) gps += state.buildings[b.id] * b.baseCps * m.building[b.id]
  return gps * m.global
}

export function goatsPerSecond(state: GameState, m = multipliers(state)): number {
  return baseGoatsPerSecond(state, m) * buffMult(state, 'gpsMult')
}

export function goatsPerClick(state: GameState, m = multipliers(state)): number {
  const flat = (1 + m.clickFlat) * m.clickMult * m.global
  const share = (baseGoatsPerSecond(state, m) * m.clickCpsPercent) / 100
  return (flat + share) * buffMult(state, 'clickMult')
}

/** One pass over the state for everything the interface needs to draw. */
export function computeStats(state: GameState): Stats {
  const m = multipliers(state)
  const gpsBuff = buffMult(state, 'gpsMult')

  const byBuilding = Object.fromEntries(BUILDING_IDS.map((id) => [id, 0])) as Record<
    BuildingId,
    number
  >
  let gps = 0
  for (const b of BUILDINGS) {
    const line = state.buildings[b.id] * b.baseCps * m.building[b.id] * m.global * gpsBuff
    byBuilding[b.id] = line
    gps += line
  }

  return {
    gps,
    gpsBase: gps / gpsBuff,
    perClick: goatsPerClick(state, m),
    byBuilding,
    globalMult: m.global,
    buildingsOwned: totalBuildings(state),
  }
}
