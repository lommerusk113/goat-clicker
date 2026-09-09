import type { GameState, Multipliers, RelicDef, RelicId } from './types'

/**
 * Relics are the occult tree: a handful of permanent things you level rather
 * than a long list of things you buy once.
 *
 * Level L costs `costStep * L` points, so reaching level N costs
 * `costStep * N(N+1)/2` and levels come at roughly the square root of what you
 * have spent. That shape is deliberate. Occult points are logarithmic in goats
 * — five per tenfold — so an exponential price against an exponential effect
 * would leave production merely linear in points, worse than not spending them
 * at all. Triangular against multiplicative gives `1.25^sqrt(2P)`: always one
 * more level to want, never fast enough to outrun the goat curve.
 */
export const RELICS: RelicDef[] = [
  {
    id: 'candle',
    name: 'Tallow Candle',
    icon: '🕯️',
    costStep: 1,
    desc: 'All production ×1.25 per level.',
    blurb: 'Rendered from a goat that volunteered. Allegedly.',
    apply: (m, level) => {
      m.global *= 1.25 ** level
    },
    summary: (level) => `All production ×${mult(1.25 ** level)}`,
  },
  {
    id: 'sigil',
    name: 'Hoofprint Sigil',
    icon: '✴️',
    costStep: 1,
    desc: 'Petting is 50% more effective per level.',
    blurb: 'Drawn in the mud by a goat that knew exactly what it was doing.',
    apply: (m, level) => {
      m.clickMult *= 1.5 ** level
    },
    summary: (level) => `Petting ×${mult(1.5 ** level)}`,
  },
  {
    id: 'grimoire',
    name: 'Grimoire of Bleats',
    icon: '📕',
    costStep: 2,
    desc: 'Each unspent occult point grants an extra 2% production per level.',
    blurb: 'Every page says the same word. The meaning changes with the reader.',
    apply: (m, level) => {
      m.occultPercent += 2 * level
    },
    summary: (level) => `+${2 * level}% production per unspent point`,
  },
  {
    id: 'ashes',
    name: 'Ashes of the Old Farm',
    icon: '⚱️',
    costStep: 1,
    desc: 'Start every ascension with ten times as many goats per level.',
    blurb: 'Scattered over the new pasture. The grass comes up already chewed.',
    apply: (m, level) => {
      m.startGoats += startGoats(level)
    },
    summary: (level) => `Start each run with ${startGoats(level).toExponential(0)} goats`,
  },
  {
    id: 'lantern',
    name: 'Lantern in the Fog',
    icon: '🏮',
    costStep: 2,
    desc: 'Golden goats wander in 25% more often and stay 25% longer per level.',
    blurb: 'They are drawn to the light. So is everything else.',
    apply: (m, level) => {
      m.goldenFreq *= 1.25 ** level
      m.goldenLife *= 1.25 ** level
    },
    summary: (level) => `Golden goats ×${mult(1.25 ** level)} as often and as long`,
  },
  {
    id: 'hourglass',
    name: 'Bottomless Hourglass',
    icon: '⏳',
    /**
     * Three, not two. Triangular cost means a level costs the square root of
     * what has gone into a ladder, so a relic's worth per point runs as
     * `ln(factor)/sqrt(costStep)` — at step 2 the Hourglass beats the Candle by
     * a margin that grows with every point earned, and idle play stops being a
     * choice. At step 3 the two sit level and the idle build's real edge is that
     * it has one more cheap ladder to spread across.
     */
    costStep: 3,
    desc: 'Production ×1.5 per level, but only while the herd is left alone.',
    blurb: 'The sand runs out. Then it keeps running.',
    apply: (m, level) => {
      m.idle *= 1.5 ** level
    },
    summary: (level) => `×${mult(1.5 ** level)} production while idle`,
  },
  {
    id: 'crown',
    name: 'Horned Crown',
    icon: '👑',
    costStep: 3,
    desc: 'Every gild is worth another 50% per level.',
    blurb: 'Heavy. Pointy. Yours now.',
    apply: (m, level) => {
      m.gildBonus += 0.5 * level
    },
    summary: (level) => `Each gild +${(0.5 * level * 100).toFixed(0)}% output`,
  },
]

export const RELIC_BY_ID = new Map<RelicId, RelicDef>(RELICS.map((r) => [r.id, r]))

/** Two decimals until the number is big enough that they are noise. */
function mult(factor: number): string {
  if (factor >= 1e6) return factor.toExponential(1)
  return factor >= 100 ? factor.toFixed(0) : factor.toFixed(2)
}

/** Goats the Ashes hand over at the start of a run. Level 1 is ten thousand. */
function startGoats(level: number): number {
  return level < 1 ? 0 : 1e3 * 10 ** level
}

export function emptyRelics(): Record<RelicId, number> {
  return Object.fromEntries(RELICS.map((r) => [r.id, 0])) as Record<RelicId, number>
}

/** Occult points to go from `level` to `level + 1`. */
export function relicCost(def: RelicDef, level: number): number {
  return def.costStep * (level + 1)
}

/** Occult points for the next `count` levels, at their escalating prices. */
export function relicBulkCost(def: RelicDef, level: number, count: number): number {
  let total = 0
  for (let i = 0; i < count; i++) total += relicCost(def, level + i)
  return total
}

/** How many more levels `points` buys, at most. */
export function relicAffordable(def: RelicDef, level: number, points: number): number {
  let count = 0
  let spent = 0
  for (;;) {
    const next = spent + relicCost(def, level + count)
    if (next > points) return count
    spent = next
    count += 1
  }
}

/** Folds every relic the player has levelled into the running multipliers. */
export function applyRelics(state: GameState, m: Multipliers): void {
  for (const def of RELICS) {
    const level = state.occultLevels[def.id] ?? 0
    if (level > 0) def.apply(m, level)
  }
}
