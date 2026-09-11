import { BALANCE } from './balance'
import { baseGoatsPerSecond, multipliers } from './economy'
import type { Multipliers } from './economy'
import type { Buff, GameState } from './types'

export type GoldenKind = 'lucky' | 'frenzy' | 'clickFrenzy'

export interface GoldenReward {
  kind: GoldenKind
  name: string
  /** Short line shown on the goat's floating label. */
  note: string
  goats: number
  buff?: Buff
}

/**
 * Seconds until the next golden goat. Rare enough that the game stays idle;
 * they linger long enough that glancing back now and then catches them.
 */
export function nextGoldenDelay(m: Multipliers, rng: () => number = Math.random): number {
  const span = BALANCE.goldenMaxDelay - BALANCE.goldenMinDelay
  return (BALANCE.goldenMinDelay + rng() * span) / m.goldenFreq
}

export function goldenLifetime(m: Multipliers): number {
  return BALANCE.goldenLifetime * m.goldenLife
}

function pick(roll: number): GoldenKind {
  if (roll < BALANCE.goldenClickFrenzyChance) return 'clickFrenzy'
  if (roll < BALANCE.goldenClickFrenzyChance + BALANCE.goldenFrenzyChance) return 'frenzy'
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
      note: 'The herd goes wild, and so do your hands',
      goats: 0,
      buff: {
        id: 'frenzy',
        name: 'Frenzy',
        icon: '🔥',
        kind: 'gpsMult',
        factor: 7,
        remaining: 77 * m.goldenLife,
        duration: 77 * m.goldenLife,
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
        factor: BALANCE.goldenClickFrenzyMult,
        remaining: 13 * m.goldenLife,
        duration: 13 * m.goldenLife,
      },
    }
  }

  const cap = baseGoatsPerSecond(state, m) * 900
  const goats = (Math.min(state.goats * 0.15, cap) + 13) * m.goldenPower
  return { kind: 'lucky', name: 'Lucky!', note: 'Found a stash', goats }
}
