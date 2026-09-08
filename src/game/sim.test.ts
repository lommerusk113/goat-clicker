/// <reference types="vite/client" />
/**
 * Balance check, not a test: a greedy player plays several tunings of the game
 * and a comparison table is printed. Run with
 * `VITE_SIM=1 npx vitest run src/game/sim.test.ts`.
 */
import { test } from 'vitest'
import { ACHIEVEMENTS } from './achievements'
import { BALANCE } from './balance'
import type { Balance } from './balance'
import { BUILDINGS, BUILDING_IDS } from './buildings'
import { baseGoatsPerSecond, bulkCost, computeStats, goatsPerClick, multipliers, nextMilestone } from './economy'
import {
  ascend,
  buyBuilding,
  buyUpgrade,
  claimAchievements,
  createInitialState,
  moveGild,
  pendingOccult,
  rerollGild,
} from './state'
import { OCCULT_UPGRADES, UPGRADES, availableUpgrades } from './upgrades'
import type { BuildingId, GameState } from './types'

interface Scenario {
  name: string
  balance?: Partial<Balance>
  /** Base cost ratio between consecutive buildings from the Meadow on. Omit to keep the table. */
  costRatio?: number
  /** How much worse each building's goats-per-second per goat is than the one before. */
  falloff?: number
  /** Constant petting rate. Omit for the realistic profile: a burst after each ascension, then occasional. */
  petsPerSecond?: number
  hours?: number
}

/** Pets per second `sinceAscension` seconds into a run: three a second for ten minutes, then now and then. */
function realisticPets(sinceAscension: number): number {
  return sinceAscension < 600 ? 3 : 0.2
}

/** Only options the player could afford within this long are compared on efficiency. */
const PATIENCE_SECONDS = 15 * 60

const MARKS = [1, 4, 8, 16, 24, 48, 96, 200, 400]

function lcg(seed: number): () => number {
  let x = seed
  return () => {
    x = (x * 1_664_525 + 1_013_904_223) % 4_294_967_296
    return x / 4_294_967_296
  }
}

interface Option {
  cost: number
  eff: number
  act: (x: GameState) => void
}

function run(sc: Scenario) {
  const hoursTotal = sc.hours ?? 400
  let pets = sc.petsPerSecond ?? 3
  const income = (s: GameState) => baseGoatsPerSecond(s) + goatsPerClick(s) * pets
  const pointCost = (s: GameState, points: number) => {
    const m = multipliers(s)
    const now = 1 + (s.occult * m.occultPercent) / 100
    const after = 1 + (Math.max(0, s.occult - points) * m.occultPercent) / 100
    return income(s) * (1 - after / now)
  }

  const bestPurchase = (s: GameState): Option | undefined => {
    const gps = income(s)
    const reach = s.goats + gps * PATIENCE_SECONDS
    let best: Option | undefined
    let fallback: Option | undefined
    const consider = (cost: number, gain: number, act: (x: GameState) => void) => {
      if (cost <= 0 || gain <= 0) return
      const option = { cost, eff: gain / cost, act }
      if (cost <= reach) {
        if (best === undefined || option.eff > best.eff) best = option
      } else if (fallback === undefined || option.eff > fallback.eff) fallback = option
    }
    for (const b of BUILDINGS) {
      const n = s.buildings[b.id]
      for (const count of new Set([1, Math.max(1, nextMilestone(n) - n)])) {
        const trial = structuredClone(s)
        trial.buildings[b.id] += count
        consider(bulkCost(b, n, count), income(trial) - gps, (x) => buyBuilding(x, b.id, count))
      }
    }
    for (const u of availableUpgrades(s)) {
      const trial = structuredClone(s)
      trial.upgrades.push(u.id)
      consider(u.cost, income(trial) - gps, (x) => buyUpgrade(x, u.id))
    }
    return best ?? fallback
  }

  const spendOnOccult = (s: GameState) => {
    for (;;) {
      let pick: { id: string; gain: number } | undefined
      for (const u of OCCULT_UPGRADES) {
        if (s.upgrades.includes(u.id) || !u.unlocked(s) || s.occult < u.cost) continue
        const trial = structuredClone(s)
        trial.upgrades.push(u.id)
        trial.occult -= u.cost
        const gain = income(trial) - income(s)
        if (gain > 0 && (!pick || gain > pick.gain)) pick = { id: u.id, gain }
      }
      if (!pick) return
      buyUpgrade(s, pick.id)
    }
  }

  let gildActions = 0
  const manageGilds = (s: GameState, rng: () => number) => {
    for (let guard = 0; guard < 50; guard++) {
      const stats = computeStats(s)
      const perGild = (id: BuildingId) => (stats.byBuilding[id] / (1 + BALANCE.gildBonus * s.gilds[id])) * BALANCE.gildBonus
      const target = BUILDING_IDS.reduce((a, b) => (stats.byBuilding[b] > stats.byBuilding[a] ? b : a))
      if (stats.byBuilding[target] <= 0) return
      const sources = BUILDING_IDS.filter((id) => id !== target && s.gilds[id] > 0)
      if (sources.length === 0) return
      const src = sources.reduce((a, b) => (perGild(b) < perGild(a) ? b : a))
      const others = BUILDING_IDS.filter((id) => id !== src)
      const meanOther = others.reduce((sum, id) => sum + perGild(id), 0) / others.length
      const moveGain = perGild(target) - perGild(src) - pointCost(s, BALANCE.gildMoveCost)
      const rerollGain = meanOther - perGild(src) - pointCost(s, BALANCE.gildRerollCost)
      if (rerollGain > 0 && rerollGain / BALANCE.gildRerollCost >= moveGain / BALANCE.gildMoveCost && s.occult >= BALANCE.gildRerollCost) {
        rerollGild(s, src, rng)
        gildActions++
      } else if (moveGain > 0 && s.occult >= BALANCE.gildMoveCost) {
        moveGild(s, src, target)
        gildActions++
      } else return
    }
  }

  // --- apply the scenario -----------------------------------------------------
  const savedBalance = { ...BALANCE }
  const savedBuildings = BUILDINGS.map((b) => ({ baseCost: b.baseCost, baseCps: b.baseCps }))
  Object.assign(BALANCE, sc.balance ?? {})
  BUILDINGS.forEach((b, k) => {
    if (sc.costRatio && k >= 1) b.baseCost = Math.round(100 * sc.costRatio ** (k - 1))
    if (sc.falloff && k >= 1) b.baseCps = (b.baseCost * 0.01) / sc.falloff ** (k - 1)
  })

  const rng = lcg(7)
  const s = createInitialState(0)
  let t = 0
  let runStart = 0
  let longestWait = 0
  const firstBought: Partial<Record<BuildingId, number>> = {}
  const earnedAt = new Map<string, number>()
  const ascensions: { t: number; gain: number }[] = []
  const snapshots: string[] = []
  let runaway = false

  try {
    while (t < hoursTotal * 3600) {
      if (sc.petsPerSecond === undefined) pets = realisticPets(t - runStart)
      const pending = pendingOccult(s)
      if (pending >= Math.max(5, 0.2 * s.occultEarned) && t - runStart >= 3600) {
        const result = ascend(s, rng)
        ascensions.push({ t, gain: result.occult })
        runStart = t
        spendOnOccult(s)
        continue
      }
      manageGilds(s, rng)
      spendOnOccult(s)

      const gps = income(s)
      const best = bestPurchase(s)
      if (!best) break
      const wait = Math.max(0, (best.cost - s.goats) / gps)
      if (!Number.isFinite(wait)) break
      longestWait = Math.max(longestWait, wait)
      const before = t
      t += wait
      s.goats += gps * wait
      s.totalGoats += gps * wait
      s.clicks += pets * wait
      s.goatsFromClicks += goatsPerClick(s) * pets * wait
      best.act(s)
      for (const id of BUILDING_IDS) if (s.buildings[id] > 0 && firstBought[id] === undefined) firstBought[id] = t
      for (const a of claimAchievements(s)) earnedAt.set(a.id, t)
      if (baseGoatsPerSecond(s) > 1e40) runaway = true

      for (const m of MARKS) {
        if (before < m * 3600 && t >= m * 3600) {
          const own = BUILDINGS.map((b) => s.buildings[b.id])
          snapshots.push(
            `  ${String(m).padStart(3)}h gps=${baseGoatsPerSecond(s).toExponential(1)} asc=${s.ascensions} pts=${s.occult}/${s.occultEarned} ach=${s.achievements.length} upg=${s.upgrades.length} ` +
              `top=${BUILDINGS[own.lastIndexOf(Math.max(...own.filter((n) => n > 0)))]?.id ?? '-'} ` +
              `frontier=${[...own.entries()].filter(([, n]) => n > 0).pop()?.[0] ?? 0} ` +
              `>=200:${own.filter((n) => n >= 200).length} gilds=${Object.values(s.gilds).reduce((a, b) => a + b, 0)}/max${Math.max(...Object.values(s.gilds))}`,
          )
        }
      }
    }
  } finally {
    Object.assign(BALANCE, savedBalance)
    BUILDINGS.forEach((b, k) => Object.assign(b, savedBuildings[k]))
  }

  const achievementsBy = (h: number) => [...earnedAt.values()].filter((v) => v <= h * 3600).length
  const frontier = BUILDINGS.map((b) => `${b.id}@${firstBought[b.id] === undefined ? '-' : (firstBought[b.id]! / 3600).toFixed(1)}h`).join(' ')
  const asc = ascensions.map((a) => `${(a.t / 3600).toFixed(0)}h:+${a.gain}`).join(' ')
  const never = ACHIEVEMENTS.filter((a) => !earnedAt.has(a.id)).map((a) => a.id)

  return [
    `=== ${sc.name}${runaway ? '  *** RUNAWAY ***' : ''}`,
    ...snapshots,
    `  first bought: ${frontier}`,
    `  ascensions (${ascensions.length}): ${asc}`,
    `  achievements earned by 1h/8h/24h/96h/400h: ${[1, 8, 24, 96, 400].map(achievementsBy).join('/')} of ${ACHIEVEMENTS.length}; never: ${never.length} (${never.slice(0, 12).join(',')}${never.length > 12 ? ',…' : ''})`,
    `  upgrades bought at end: ${s.upgrades.length} of ${UPGRADES.length}; gild actions: ${gildActions}; longest wait: ${(longestWait / 3600).toFixed(1)}h`,
  ].join('\n')
}

const SCENARIOS: Scenario[] = [
  { name: 'default tuning, realistic player' },
]

test.skipIf(!import.meta.env.VITE_SIM)('balance sweep', () => {
  const only = import.meta.env.VITE_SIM_ONLY as string | undefined
  const picked = only ? SCENARIOS.filter((s) => s.name.startsWith(only)) : SCENARIOS
  console.log(picked.map(run).join('\n\n'))
}, 600_000)
