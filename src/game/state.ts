import { newlyEarned } from './achievements'
import { BALANCE } from './balance'
import { BUILDING_BY_ID, BUILDING_IDS } from './buildings'
import { bulkCost, goatsPerClick, goatsPerSecond, multipliers } from './economy'
import { RELIC_BY_ID, emptyRelics, relicAffordable, relicBulkCost } from './relics'
import { UPGRADE_BY_ID } from './upgrades'
import type { AchievementDef, Buff, BuildingId, GameState, RelicId } from './types'

export const SAVE_VERSION = 3


export function emptyBuildings(): Record<BuildingId, number> {
  return Object.fromEntries(BUILDING_IDS.map((id) => [id, 0])) as Record<BuildingId, number>
}

export function createInitialState(now: number): GameState {
  return {
    version: SAVE_VERSION,
    goats: 0,
    totalGoats: 0,
    goatsFromClicks: 0,
    clicks: 0,
    goldenClicks: 0,
    ascensions: 0,
    occult: 0,
    occultEarned: 0,
    lifetimeGoats: 0,
    occultLevels: emptyRelics(),
    occultCredit: 0,
    buildings: emptyBuildings(),
    gilds: emptyBuildings(),
    upgrades: [],
    achievements: [],
    buffs: [],
    goldenTimer: BALANCE.goldenFirstDelay,
    playTime: 0,
    sincePet: 0,
    startedAt: now,
    lastSaved: now,
  }
}

/** Credits goats to the bank and to the all-time tally. */
export function earn(state: GameState, amount: number): void {
  state.goats += amount
  state.totalGoats += amount
}

/** One pet of the goat. Returns what it gathered. */
export function petGoat(state: GameState): number {
  // The clock resets before the pet is priced, so the pet itself never collects
  // the idle bonus it just cancelled.
  state.sincePet = 0
  const gain = goatsPerClick(state)
  earn(state, gain)
  state.goatsFromClicks += gain
  state.clicks += 1
  return gain
}

/** Hands-off production for `dt` seconds. Returns what it gathered. */
export function produce(state: GameState, dt: number): number {
  state.sincePet += dt
  const gain = goatsPerSecond(state) * dt
  earn(state, gain)
  return gain
}

export function buyBuilding(state: GameState, id: BuildingId, count = 1): boolean {
  if (count < 1) return false
  const price = bulkCost(BUILDING_BY_ID[id], state.buildings[id], count)
  if (state.goats < price) return false
  state.goats -= price
  state.buildings[id] += count
  return true
}

export function buyUpgrade(state: GameState, id: string): boolean {
  const def = UPGRADE_BY_ID.get(id)
  if (!def) return false
  if (state.upgrades.includes(id)) return false
  if (!def.unlocked(state)) return false
  if (state.goats < def.cost) return false
  state.goats -= def.cost
  state.upgrades.push(id)
  return true
}

/**
 * Levels a relic with occult points. `count` of `'max'` takes as many levels as
 * the points stretch to. Returns how many levels were actually bought.
 */
export function buyRelic(state: GameState, id: RelicId, count: number | 'max' = 1): number {
  const def = RELIC_BY_ID.get(id)
  if (!def) return 0
  const level = state.occultLevels[id] ?? 0
  const wanted = count === 'max' ? relicAffordable(def, level, state.occult) : Math.floor(count)
  if (wanted < 1) return 0
  const price = relicBulkCost(def, level, wanted)
  if (state.occult < price) return 0
  state.occult -= price
  state.occultLevels[id] = level + wanted
  return wanted
}

/**
 * Occult points a lifetime of `goats` is worth: so many per order of magnitude
 * past the occult unit, so a trillion is forty. Logarithmic on purpose.
 * Milestones make production nearly linear in wealth, so a run's goats grow
 * like a high power of the occult bonus; a root of that (the classic cube
 * root) runs away, a log does not.
 */
export function occultLevel(goats: number): number {
  return Math.floor(BALANCE.occultPerDecade * Math.log10(1 + goats / BALANCE.occultUnit))
}

/** Lifetime goats needed to be worth `level` occult points. */
export function goatsForOccultLevel(level: number): number {
  return BALANCE.occultUnit * (10 ** (level / BALANCE.occultPerDecade) - 1)
}

/**
 * Occult points ascending right now would grant. The credit covers points a
 * grandfathered save was handed under an older, more generous curve, so the
 * next point is one step up the current curve rather than a hundred thousand.
 */
export function pendingOccult(state: GameState): number {
  const worth = occultLevel(state.lifetimeGoats + state.totalGoats) + state.occultCredit
  return Math.max(0, worth - state.occultEarned)
}

/** Lifetime goats this save needs before one more point is on offer. */
export function goatsForNextOccult(state: GameState): number {
  const next = state.occultEarned + pendingOccult(state) + 1 - state.occultCredit
  return goatsForOccultLevel(next) - (state.lifetimeGoats + state.totalGoats)
}


export interface Ascension {
  /** Occult points gained. Zero means nothing happened. */
  occult: number
  /** Buildings that received a gild this ascension, one per BALANCE.gildPerOccult points crossed. */
  gilded: BuildingId[]
}

/**
 * Gives up the farm for occult points, and a gild on a random building owned
 * this run for every few points ever earned. Buildings, goats and ordinary
 * upgrades go; achievements, relics, gilds and lifetime stats stay.
 */
export function ascend(state: GameState, rng: () => number = Math.random): Ascension {
  const gain = pendingOccult(state)
  if (gain <= 0) return { occult: 0, gilded: [] }

  const owned = BUILDING_IDS.filter((id) => state.buildings[id] > 0)
  const pool = owned.length > 0 ? owned : [BUILDING_IDS[0]]
  const before = Math.floor(state.occultEarned / BALANCE.gildPerOccult)
  const after = Math.floor((state.occultEarned + gain) / BALANCE.gildPerOccult)
  const gilded: BuildingId[] = []
  for (let i = before; i < after; i++) {
    const pick = pool[Math.floor(rng() * pool.length)]
    state.gilds[pick] += 1
    gilded.push(pick)
  }

  state.lifetimeGoats += state.totalGoats
  state.occultEarned += gain
  state.occult += gain
  state.ascensions += 1

  state.goats = 0
  state.totalGoats = 0
  state.buildings = emptyBuildings()
  state.upgrades = []
  state.buffs = []
  state.goldenTimer = BALANCE.goldenFirstDelay

  earn(state, multipliers(state).startGoats)
  return { occult: gain, gilded }
}

function shiftGild(state: GameState, from: BuildingId, to: BuildingId, cost: number): boolean {
  if (from === to) return false
  if (state.gilds[from] < 1) return false
  if (state.occult < cost) return false
  state.occult -= cost
  state.gilds[from] -= 1
  state.gilds[to] += 1
  return true
}

/** Moves one gild to a chosen building, at the dear price. */
export function moveGild(state: GameState, from: BuildingId, to: BuildingId): boolean {
  return shiftGild(state, from, to, BALANCE.gildMoveCost)
}

/**
 * Throws one gild onto a random other building, at the cheap price. Landing on
 * a chosen building takes twelve tries on average, so the gamble is cheaper
 * than a move but far from certain. Returns where it landed.
 */
export function rerollGild(
  state: GameState,
  from: BuildingId,
  rng: () => number = Math.random,
): BuildingId | null {
  const others = BUILDING_IDS.filter((id) => id !== from)
  const to = others[Math.floor(rng() * others.length)]
  return shiftGild(state, from, to, BALANCE.gildRerollCost) ? to : null
}

/** Starts a buff, or refreshes it if one of the same kind is already running. */
export function addBuff(state: GameState, buff: Buff): void {
  state.buffs = [...state.buffs.filter((b) => b.id !== buff.id), buff]
}

/** Counts buffs down. Returns the ones that just ran out. */
export function tickBuffs(state: GameState, dt: number): Buff[] {
  const expired: Buff[] = []
  const alive: Buff[] = []
  for (const b of state.buffs) {
    b.remaining -= dt
    if (b.remaining <= 0) expired.push(b)
    else alive.push(b)
  }
  state.buffs = alive
  return expired
}

/** Awards any achievement whose condition is now met. */
export function claimAchievements(state: GameState): AchievementDef[] {
  const earnedNow = newlyEarned(state)
  for (const a of earnedNow) state.achievements.push(a.id)
  return earnedNow
}
