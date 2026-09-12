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

/**
 * What a golden goat is worth catching right now. A frenzy the herd is already
 * running is left out of the draw and its share handed to whatever is left:
 * re-catching one only refreshed a buff that was running anyway, which reads
 * as a golden goat that did nothing, and the Lantern makes that the common
 * case — at a few levels it shortens the wait and lengthens the frenzy until
 * they overlap, and better than a third of the goats caught were repeats.
 * With nothing running the draw is exactly as it was.
 */
function pick(roll: number, state: GameState): GoldenKind {
  const running = (id: string) => state.buffs.some((b) => b.id === id)
  const odds: [GoldenKind, number][] = [
    ['clickFrenzy', running('click-frenzy') ? 0 : BALANCE.goldenClickFrenzyChance],
    ['frenzy', running('frenzy') ? 0 : BALANCE.goldenFrenzyChance],
  ]
  const lucky = 1 - BALANCE.goldenClickFrenzyChance - BALANCE.goldenFrenzyChance
  let left = roll * (lucky + odds[0][1] + odds[1][1])
  for (const [kind, chance] of odds) {
    if (left < chance) return kind
    left -= chance
  }
  return 'lucky'
}

/**
 * Decides what a golden goat gives. Lucky pays out of the bank but is capped
 * at 15 minutes of production, so an idle herd cannot be farmed for jackpots.
 */
export function rollGolden(state: GameState, rng: () => number = Math.random): GoldenReward {
  const m = multipliers(state)
  const kind = pick(rng(), state)

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
        remaining: 60 * m.goldenLife,
        duration: 60 * m.goldenLife,
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
