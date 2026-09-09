import { BALANCE } from './balance'
import { BUILDINGS, BUILDING_IDS } from './buildings'
import { applyRelics } from './relics'
import { UPGRADE_BY_ID } from './upgrades'
import type { BuildingDef, BuildingId, GameState, Multipliers, Stats } from './types'

export type { Multipliers } from './types'

/**
 * Output multiplier a building earns just from how many are owned: ×4 at 200
 * and every 25 after, ×10 instead at every thousandth.
 */
export function milestoneMult(owned: number): number {
  const { milestoneStart, milestoneStep, milestoneMult, milestoneBig, milestoneBigMult } = BALANCE
  if (owned < milestoneStart) return 1
  const steps = Math.floor((owned - milestoneStart) / milestoneStep) + 1
  const big = Math.floor(owned / milestoneBig) - Math.floor((milestoneStart - 1) / milestoneBig)
  return milestoneMult ** (steps - big) * milestoneBigMult ** big
}

/** The next count at which a building's milestone multiplier grows. */
export function nextMilestone(owned: number): number {
  const { milestoneStart, milestoneStep } = BALANCE
  if (owned < milestoneStart) return milestoneStart
  return owned - ((owned - milestoneStart) % milestoneStep) + milestoneStep
}

export function costOf(def: BuildingDef, owned: number): number {
  return Math.ceil(def.baseCost * BALANCE.costGrowth ** owned)
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

/** Everything the player's upgrades, relics and gilds add up to. */
export function multipliers(state: GameState): Multipliers {
  const building = Object.fromEntries(BUILDING_IDS.map((id) => [id, 1])) as Record<
    BuildingId,
    number
  >
  const m: Multipliers = {
    building,
    buildingClick: { ...building },
    global: 1,
    clickFlat: 0,
    clickMult: 1,
    clickCpsPercent: 0,
    goldenFreq: 1,
    goldenLife: 1,
    goldenPower: 1,
    occultPercent: BALANCE.occultBasePercent,
    idle: 1,
    gildBonus: BALANCE.gildBonus,
    startGoats: 0,
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

  // Relics come after the goat-bought upgrades and before anything that reads
  // the totals: the Grimoire changes what a point is worth and the Crown
  // changes what a gild is worth, so both have to land first.
  applyRelics(state, m)

  for (const id of BUILDING_IDS) {
    const gilded = 1 + m.gildBonus * state.gilds[id]
    m.buildingClick[id] = m.building[id] * gilded
    m.building[id] *= milestoneMult(state.buildings[id]) * gilded
  }
  // Unspent points only: spend too many and the herd slows down.
  m.global *= 1 + (state.occult * m.occultPercent) / 100
  return m
}

function buffMult(state: GameState, kind: 'gpsMult' | 'clickMult'): number {
  let f = 1
  for (const b of state.buffs) if (b.kind === kind) f *= b.factor
  return f
}

/** True once the goat has been left alone long enough for the idle relics to pay. */
export function isIdle(state: GameState): boolean {
  return state.sincePet >= BALANCE.idleSeconds
}

/** Seconds until the herd counts as idle. Zero once it does. */
export function idleIn(state: GameState): number {
  return Math.max(0, BALANCE.idleSeconds - state.sincePet)
}

/**
 * What the idle relics are paying right now. Petting resets the clock before
 * the pet is priced, so a click never collects this — the two builds do not
 * overlap, which is the whole point of the Hourglass.
 */
export function idleMult(state: GameState, m = multipliers(state)): number {
  return isIdle(state) ? m.idle : 1
}

/** Production per second before golden-goat buffs. Click bonuses key off this. */
export function baseGoatsPerSecond(state: GameState, m = multipliers(state)): number {
  let gps = 0
  for (const b of BUILDINGS) gps += state.buildings[b.id] * b.baseCps * m.building[b.id]
  return gps * m.global * idleMult(state, m)
}

export function goatsPerSecond(state: GameState, m = multipliers(state)): number {
  return baseGoatsPerSecond(state, m) * buffMult(state, 'gpsMult')
}

/** Flat click bonus from buildings such as the Scratching Post. */
export function clickFromBuildings(state: GameState, m = multipliers(state)): number {
  let flat = 0
  for (const b of BUILDINGS) {
    if (b.baseClick) flat += state.buildings[b.id] * b.baseClick * m.buildingClick[b.id]
  }
  return flat
}

/** Goats per pet. A Frenzy lifts pets as well as production, so the two golden buffs stack. */
export function goatsPerClick(state: GameState, m = multipliers(state)): number {
  const flat = (1 + m.clickFlat + clickFromBuildings(state, m)) * m.clickMult * m.global
  const share = (baseGoatsPerSecond(state, m) * m.clickCpsPercent) / 100
  return (flat + share) * buffMult(state, 'clickMult') * buffMult(state, 'gpsMult')
}

/** One pass over the state for everything the interface needs to draw. */
export function computeStats(state: GameState): Stats {
  const m = multipliers(state)
  const gpsBuff = buffMult(state, 'gpsMult')

  const byBuilding = Object.fromEntries(BUILDING_IDS.map((id) => [id, 0])) as Record<
    BuildingId,
    number
  >
  const idle = idleMult(state, m)
  let gps = 0
  for (const b of BUILDINGS) {
    const line = state.buildings[b.id] * b.baseCps * m.building[b.id] * m.global * idle * gpsBuff
    byBuilding[b.id] = line
    gps += line
  }

  return {
    gps,
    gpsBase: gps / gpsBuff,
    perClick: goatsPerClick(state, m),
    byBuilding,
    globalMult: m.global,
    gildBonus: m.gildBonus,
    buildingsOwned: totalBuildings(state),
    idleMult: idle,
    idleIn: idleIn(state),
  }
}
