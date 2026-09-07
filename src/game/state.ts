import { newlyEarned } from './achievements'
import { BUILDING_BY_ID, BUILDING_IDS } from './buildings'
import { bulkCost, goatsPerClick, goatsPerSecond } from './economy'
import { UPGRADE_BY_ID } from './upgrades'
import type { AchievementDef, Buff, BuildingId, GameState } from './types'

export const SAVE_VERSION = 1

/** Seconds before the first golden goat can wander in. */
export const FIRST_GOLDEN_DELAY = 90

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
    buildings: emptyBuildings(),
    upgrades: [],
    achievements: [],
    buffs: [],
    goldenTimer: FIRST_GOLDEN_DELAY,
    playTime: 0,
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
  const gain = goatsPerClick(state)
  earn(state, gain)
  state.goatsFromClicks += gain
  state.clicks += 1
  return gain
}

/** Idle production for `dt` seconds. Returns what it gathered. */
export function produce(state: GameState, dt: number): number {
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
