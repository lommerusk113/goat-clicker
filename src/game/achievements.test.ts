import { describe, expect, test } from 'vitest'
import { ACHIEVEMENTS } from './achievements'
import { UPGRADES } from './upgrades'
import { createInitialState } from './state'
import type { GameState } from './types'

function stateWith(patch: Partial<GameState>): GameState {
  return { ...createInitialState(0), ...patch }
}

const upgradeBadges = ACHIEVEMENTS.filter((a) => a.id.startsWith('upgrades-'))

describe('upgrade achievements', () => {
  test('are all within reach of a run that owns every upgrade', () => {
    // The guard this file exists for: 'upgrades-90' asked for ninety of the
    // eighty upgrades that exist, and had already been retargeted once from
    // a hundred and thirty. Tying the top one to UPGRADES.length keeps the
    // ceiling honest as the table changes.
    const everything = stateWith({ upgrades: UPGRADES.map((u) => u.id) })
    for (const a of upgradeBadges) {
      expect(a.earned(everything), `${a.id} (${a.desc})`).toBe(true)
    }
  })

  test('the last one takes the whole table, not a number that can drift', () => {
    const allButOne = stateWith({ upgrades: UPGRADES.slice(1).map((u) => u.id) })
    const top = upgradeBadges.at(-1)!
    expect(top.earned(allButOne)).toBe(false)
    expect(top.earned(stateWith({ upgrades: UPGRADES.map((u) => u.id) }))).toBe(true)
  })
})

describe('petting achievements', () => {
  const earned = (id: string, clicks: number) =>
    ACHIEVEMENTS.find((a) => a.id === id)!.earned(stateWith({ clicks }))

  test('ask for a grind a clicker can finish', () => {
    expect(earned('clicks-50000', 49_999)).toBe(false)
    expect(earned('clicks-50000', 50_000)).toBe(true)
    expect(earned('clicks-250000', 249_999)).toBe(false)
    expect(earned('clicks-250000', 250_000)).toBe(true)
  })

  test('no petting badge asks for more than a few hours of it', () => {
    // At five pets a second, anything past a quarter million is a day's work.
    const CAP = 250_000
    for (const a of ACHIEVEMENTS.filter((x) => /^clicks-\d/.test(x.id))) {
      expect(a.earned(stateWith({ clicks: CAP })), `${a.id} (${a.desc})`).toBe(true)
    }
  })
})
