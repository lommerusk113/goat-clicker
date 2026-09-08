import { baseGoatsPerSecond, multipliers } from './economy'
import type { Multipliers } from './economy'
import type { Buff, GameState } from './types'

/**
 * Seconds between golden goats, before upgrades. Rare enough that the game
 * stays idle, and they linger long enough that glancing back now and then is
 * all it takes to catch one.
 */
export const GOLDEN_MIN_DELAY = 150
export const GOLDEN_MAX_DELAY = 400
/** Seconds a golden goat sticks around, before upgrades. */
export const GOLDEN_LIFETIME = 40

export type GoldenKind = 'lucky' | 'frenzy' | 'clickFrenzy'

export interface GoldenReward {
  kind: GoldenKind
  name: string
  /** Short line shown on the goat's floating label. */
  note: string
  goats: number
  buff?: Buff
}

export function nextGoldenDelay(m: Multipliers, rng: () => number = Math.random): number {
  const span = GOLDEN_MAX_DELAY - GOLDEN_MIN_DELAY
  return (GOLDEN_MIN_DELAY + rng() * span) / m.goldenFreq
}

export function goldenLifetime(m: Multipliers): number {
  return GOLDEN_LIFETIME * m.goldenLife
}

/** Chance of each outcome, in order. */
const ODDS: [GoldenKind, number][] = [
  ['lucky', 0.5],
  ['frenzy', 0.35],
  ['clickFrenzy', 0.15],
]

function pick(roll: number): GoldenKind {
  let acc = 0
  for (const [kind, chance] of ODDS) {
    acc += chance
    if (roll < acc) return kind
  }
  return 'lucky'
}

/**
 * Decides what a golden goat gives. Lucky pays out of the bank but is capped
 * at 15 minutes of production, so an idle herd cannot be farmed for jackpots.
 */
export function rollGolden(state: GameState, rng: () => number = Math.random): GoldenReward {
  const m = multipliers(state)
  const kind = pick(rng())

  if (kind === 'frenzy') {
    return {
      kind,
      name: 'Frenzy',
      note: 'The herd goes wild',
      goats: 0,
      buff: {
        id: 'frenzy',
        name: 'Frenzy',
        icon: '🔥',
        kind: 'gpsMult',
        factor: 7,
        remaining: 77,
        duration: 77,
      },
    }
  }

  if (kind === 'clickFrenzy') {
    return {
      kind,
      name: 'Petting Frenzy',
      note: 'Pet everything, now',
      goats: 0,
      buff: {
        id: 'click-frenzy',
        name: 'Petting Frenzy',
        icon: '✋',
        kind: 'clickMult',
        factor: 777,
        remaining: 13,
        duration: 13,
      },
    }
  }

  const cap = baseGoatsPerSecond(state, m) * 900
  const goats = (Math.min(state.goats * 0.15, cap) + 13) * m.goldenPower
  return { kind: 'lucky', name: 'Lucky!', note: 'Found a stash', goats }
}
