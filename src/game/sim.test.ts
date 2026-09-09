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
import { goldenLifetime, nextGoldenDelay, rollGolden } from './golden'
import { RELICS, relicCost } from './relics'
import {
  ascend,
  buyBuilding,
  buyRelic,
  buyUpgrade,
  claimAchievements,
  createInitialState,
  earn,
  moveGild,
  pendingOccult,
  rerollGild,
} from './state'
import { UPGRADES, availableUpgrades } from './upgrades'
import type { BuildingId, GameState, RelicId } from './types'

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
  /** Model golden goats. The player catches every one while active, a quarter of them while idling. */
  goldens?: boolean
  /** What purchases are judged on: goats per pet only, goats per second only, or both (default). */
  strategy?: 'click' | 'gps' | 'hybrid'
  /** Override the Scratching Post's goats-per-pet bonus per unit. */
  postClick?: number
  /** How eagerly to ascend: whenever a point is on offer, the usual rule, or only when points would double. */
  ascend?: 'often' | 'normal' | 'rare'
  /** Occult spending: greedy on immediate income, 'smart' (production only, no gild moves), or never. */
  spend?: 'greedy' | 'smart' | 'never'
  /**
   * Play idle: pet only to get a fresh run moving, then leave the herd alone so
   * the Hourglass pays. An empty pasture produces nothing, so even an idler has
   * to start each run by hand.
   */
  idle?: boolean
  /** Only let the spender level these relics. Omit to allow all of them. */
  relics?: RelicId[]
}

/** Pets per second while a Petting Frenzy is running and the player is at the screen. */
const FRENZY_PETS_PER_SECOND = 6

/** Pets per second `sinceAscension` seconds into a run: three a second for ten minutes, then now and then. */
function realisticPets(sinceAscension: number): number {
  return sinceAscension < 600 ? 3 : 0.2
}

/** Only options the player could afford within this long are compared on efficiency. */
const PATIENCE_SECONDS = 15 * 60

const MARKS = [0.25, 0.5, 1, 2, 4, 8, 16, 24, 48, 96, 200, 400]

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
  let pets = sc.idle ? 0 : (sc.petsPerSecond ?? 3)
  const income = (s: GameState) => baseGoatsPerSecond(s) + goatsPerClick(s) * pets
  /** Production lost by spending `points` occult, in goats per second. */
  const pointCost = (s: GameState, points: number) => {
    const m = multipliers(s)
    const now = 1 + (s.occult * m.occultPercent) / 100
    const after = 1 + (Math.max(0, s.occult - points) * m.occultPercent) / 100
    return income(s) * (1 - after / now)
  }

  const valued = (s: GameState): number => {
    if (sc.strategy === 'click') return goatsPerClick(s) * pets
    if (sc.strategy === 'gps') return baseGoatsPerSecond(s)
    return income(s)
  }

  const bestPurchase = (s: GameState): Option | undefined => {
    const gps = valued(s)
    const reach = s.goats + income(s) * PATIENCE_SECONDS
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
        consider(bulkCost(b, n, count), valued(trial) - gps, (x) => buyBuilding(x, b.id, count))
      }
    }
    for (const u of availableUpgrades(s)) {
      const trial = structuredClone(s)
      trial.upgrades.push(u.id)
      consider(u.cost, valued(trial) - gps, (x) => buyUpgrade(x, u.id))
    }
    return best ?? fallback
  }

  const spendOnOccult = (s: GameState) => {
    // The smart spender judges on steady production, so a burst of petting cannot sell it a click upgrade.
    const worth = sc.spend === 'smart' ? baseGoatsPerSecond : income
    for (;;) {
      let pick: { def: (typeof RELICS)[number]; eff: number } | undefined
      for (const def of RELICS) {
        if (sc.relics && !sc.relics.includes(def.id)) continue
        const level = s.occultLevels[def.id] ?? 0
        const price = relicCost(def, level)
        if (s.occult < price) continue
        const trial = structuredClone(s)
        trial.occultLevels[def.id] = level + 1
        trial.occult -= price
        // A point held is a point earning, so a level has to beat what holding it pays.
        const gain = worth(trial) - worth(s)
        const eff = gain / price
        if (gain > 0 && (!pick || eff > pick.eff)) pick = { def, eff }
      }
      if (!pick) return
      buyRelic(s, pick.def.id, 1)
    }
  }

  let gildActions = 0
  const manageGilds = (s: GameState, rng: () => number) => {
    for (let guard = 0; guard < 50; guard++) {
      const stats = computeStats(s)
      const perGild = (id: BuildingId) => (stats.byBuilding[id] / (1 + stats.gildBonus * s.gilds[id])) * stats.gildBonus
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
  const savedBuildings = BUILDINGS.map((b) => ({ baseCost: b.baseCost, baseCps: b.baseCps, baseClick: b.baseClick }))
  Object.assign(BALANCE, sc.balance ?? {})
  if (sc.postClick !== undefined) BUILDINGS[0].baseClick = sc.postClick
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
  let nextGolden = BALANCE.goldenFirstDelay
  const goldenLog = { caught: 0, clickFrenzies: 0, goatsByHour: [0, 0, 0, 0] as number[] } // <1h, <4h, <24h, rest

  /** A golden goat wandered in at time `at`. Lumps buffs into equivalent goats so the greedy loop stays simple. */
  const goldenGoat = (at: number) => {
    const m = multipliers(s)
    nextGolden = at + nextGoldenDelay(m, rng) + goldenLifetime(m)
    const active = at - runStart < 600
    if (!active && rng() > 0.25) return
    const reward = rollGolden(s, rng)
    goldenLog.caught++
    let goats = reward.goats
    if (reward.buff?.kind === 'gpsMult') goats = (reward.buff.factor - 1) * baseGoatsPerSecond(s) * reward.buff.duration
    if (reward.buff?.kind === 'clickMult') {
      goldenLog.clickFrenzies++
      goats = reward.buff.factor * goatsPerClick(s) * FRENZY_PETS_PER_SECOND * reward.buff.duration
    }
    earn(s, goats)
    s.goldenClicks++
    goldenLog.goatsByHour[at < 3600 ? 0 : at < 4 * 3600 ? 1 : at < 24 * 3600 ? 2 : 3] += goats
  }

  try {
    while (t < hoursTotal * 3600) {
      if (sc.idle) pets = baseGoatsPerSecond(s) > 0 ? 0 : 3
      else if (sc.petsPerSecond === undefined) pets = realisticPets(t - runStart)
      // Petting at all keeps the clock at zero; leaving the herd alone runs it out.
      s.sincePet = pets > 0 ? 0 : BALANCE.idleSeconds
      const pending = pendingOccult(s)
      const ready =
        sc.ascend === 'often'
          ? pending >= 1
          : sc.ascend === 'rare'
            ? pending >= Math.max(5, s.occultEarned)
            : pending >= Math.max(5, 0.2 * s.occultEarned)
      if (ready && t - runStart >= 3600) {
        const result = ascend(s, rng)
        ascensions.push({ t, gain: result.occult })
        runStart = t
        nextGolden = t + BALANCE.goldenFirstDelay
        if (sc.spend !== 'never') spendOnOccult(s)
        continue
      }
      if (sc.spend !== 'never') {
        if (sc.spend !== 'smart') manageGilds(s, rng)
        spendOnOccult(s)
      }

      const gps = income(s)
      const best = bestPurchase(s)
      if (!best) break
      let wait = Math.max(0, (best.cost - s.goats) / gps)
      if (!Number.isFinite(wait)) break
      // A golden goat due before the purchase interrupts the wait; the loop then re-plans.
      if (sc.goldens && t + wait > nextGolden) {
        const at = Math.max(t, nextGolden)
        const partial = at - t
        s.goats += gps * partial
        s.totalGoats += gps * partial
        t = at
        goldenGoat(at)
        continue
      }
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
            `  ${String(m).padStart(3)}h gps=${baseGoatsPerSecond(s).toExponential(1)} pets=${(goatsPerClick(s) * pets).toExponential(1)}/s total=${(s.lifetimeGoats + s.totalGoats).toExponential(1)} asc=${s.ascensions} pts=${s.occult}/${s.occultEarned} ach=${s.achievements.length} upg=${s.upgrades.length} ` +
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

  const goldenLine = sc.goldens
    ? `  golden goats caught: ${goldenLog.caught} (${goldenLog.clickFrenzies} petting frenzies); goats from them <1h/<4h/<24h/rest: ${goldenLog.goatsByHour.map((g) => g.toExponential(1)).join('/')}`
    : ''
  const finalLine = `  END ${(t / 3600).toFixed(0)}h lifetime=${(s.lifetimeGoats + s.totalGoats).toExponential(1)} asc=${s.ascensions} pts=${s.occult}/${s.occultEarned} gilds=${Object.values(s.gilds).reduce((a, b) => a + b, 0)}/max${Math.max(...Object.values(s.gilds))} elder@${firstBought.elder === undefined ? '-' : (firstBought.elder / 3600).toFixed(0) + 'h'}`
  return [
    `=== ${sc.name}${runaway ? '  *** RUNAWAY ***' : ''}`,
    finalLine,
    ...snapshots,
    ...(goldenLine ? [goldenLine] : []),
    `  first bought: ${frontier}`,
    `  ascensions (${ascensions.length}): ${asc}`,
    `  achievements earned by 1h/8h/24h/96h/400h: ${[1, 8, 24, 96, 400].map(achievementsBy).join('/')} of ${ACHIEVEMENTS.length}; never: ${never.length} (${never.slice(0, 12).join(',')}${never.length > 12 ? ',…' : ''})`,
    `  upgrades bought at end: ${s.upgrades.length} of ${UPGRADES.length}; gild actions: ${gildActions}; longest wait: ${(longestWait / 3600).toFixed(1)}h`,
    `  relics: ${RELICS.map((r) => `${r.id}=${s.occultLevels[r.id] ?? 0}`).join(' ')}`,
  ].join('\n')
}

const SCENARIOS: Scenario[] = [
  { name: 'greedy spender: buys anything that lifts income now, rerolls gilds', goldens: true },
  { name: 'smart spender: production upgrades only, no gild moves', goldens: true, spend: 'smart' },
  { name: 'hoarder: never spends a point', goldens: true, spend: 'never' },
  { name: 'idle build: never pets, lives off the Hourglass', goldens: true, idle: true },
  { name: 'idle, smart spender: the fair comparison against the smart spender above', goldens: true, idle: true, spend: 'smart' },
  {
    name: 'idle build without the Hourglass: shows what the relic itself is worth',
    goldens: true,
    idle: true,
    relics: ['candle', 'sigil', 'grimoire', 'ashes', 'lantern', 'crown'],
  },
  { name: 'click build: pets three a second forever', goldens: true, petsPerSecond: 3 },
]

test.skipIf(!import.meta.env.VITE_SIM)('balance sweep', () => {
  const only = import.meta.env.VITE_SIM_ONLY as string | undefined
  const picked = only ? SCENARIOS.filter((s) => s.name.startsWith(only)) : SCENARIOS
  console.log(picked.map(run).join('\n\n'))
}, 600_000)
