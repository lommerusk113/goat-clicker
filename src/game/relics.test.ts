import { describe, expect, test } from 'vitest'
import { multipliers } from './economy'
import { RELICS, RELIC_BY_ID, relicAffordable, relicBulkCost, relicCost } from './relics'
import { createInitialState } from './state'
import type { GameState, RelicId } from './types'

function withRelic(id: RelicId, level: number): GameState {
  const s = createInitialState(0)
  s.occultLevels[id] = level
  return s
}

describe('relic prices', () => {
  const candle = RELIC_BY_ID.get('candle')!
  const crown = RELIC_BY_ID.get('crown')!
  const hourglass = RELIC_BY_ID.get('hourglass')!

  test('each level costs twice the last, starting at the step', () => {
    expect(relicCost(candle, 0)).toBe(1)
    expect(relicCost(candle, 1)).toBe(2)
    expect(relicCost(candle, 9)).toBe(512)
    expect(relicCost(crown, 0)).toBe(3)
    expect(relicCost(crown, 4)).toBe(48)
  })

  test('the Hourglass climbs three and a half times a level, rounded up', () => {
    expect(relicCost(hourglass, 0)).toBe(1)
    expect(relicCost(hourglass, 1)).toBe(4)
    expect(relicCost(hourglass, 2)).toBe(13)
    expect(relicCost(hourglass, 5)).toBe(526)
  })

  test('reaching level N costs one step short of level N+1', () => {
    expect(relicBulkCost(candle, 0, 10)).toBe(1023)
    expect(relicBulkCost(crown, 0, 4)).toBe(3 * 15)
  })

  test('bulk cost picks up from the level already held', () => {
    expect(relicBulkCost(candle, 3, 2)).toBe(8 + 16)
  })

  test('affordable stops at the last level the points cover', () => {
    expect(relicAffordable(candle, 0, 10)).toBe(3)
    expect(relicAffordable(candle, 0, 15)).toBe(4)
    expect(relicAffordable(candle, 0, 0)).toBe(0)
    expect(relicAffordable(crown, 0, 8)).toBe(1)
  })

  /**
   * The shape that keeps relics from running away now that points come as a
   * root of goats: levels arrive at the log of what has been spent, so a
   * relic's whole effect is a modest power of the points earned.
   */
  test('levels come at the log of the points spent', () => {
    for (const points of [50, 200, 1_000, 10_000]) {
      expect(relicAffordable(candle, 0, points)).toBe(Math.floor(Math.log2(points + 1)))
    }
  })
})

describe('relic effects', () => {
  test('the Candle multiplies all production', () => {
    expect(multipliers(withRelic('candle', 4)).global).toBeCloseTo(1.25 ** 4)
  })

  test('the Sigil multiplies petting', () => {
    expect(multipliers(withRelic('sigil', 3)).clickMult).toBeCloseTo(1.5 ** 3)
  })

  test('the Grimoire adds to what each unspent point is worth', () => {
    expect(multipliers(withRelic('grimoire', 5)).occultPercent).toBe(15 + 10)
  })

  test('the Ashes start a run ten times richer per level', () => {
    expect(multipliers(withRelic('ashes', 1)).startGoats).toBe(10_000)
    expect(multipliers(withRelic('ashes', 3)).startGoats).toBe(1e6)
  })

  test('the Lantern makes golden goats both more frequent and longer', () => {
    const m = multipliers(withRelic('lantern', 2))
    expect(m.goldenFreq).toBeCloseTo(1.25 ** 2)
    expect(m.goldenLife).toBeCloseTo(1.25 ** 2)
  })

  test('the Hourglass raises only the idle multiplier', () => {
    const m = multipliers(withRelic('hourglass', 3))
    expect(m.idle).toBeCloseTo(1.5 ** 3)
    expect(m.global).toBe(1)
  })

  test('the Crown makes every gild worth more', () => {
    expect(multipliers(withRelic('crown', 2)).gildBonus).toBeCloseTo(1 + 1)
  })

  test('an unlevelled relic changes nothing', () => {
    const bare = multipliers(createInitialState(0))
    for (const def of RELICS) {
      expect(multipliers(withRelic(def.id, 0))).toEqual(bare)
    }
  })
})

describe('relic summaries', () => {
  test('every relic can describe itself at a level it might reach', () => {
    for (const def of RELICS) {
      for (const level of [1, 10, 40]) {
        const text = def.summary(level)
        expect(text).toBeTruthy()
        expect(text).not.toContain('NaN')
        expect(text).not.toContain('Infinity')
      }
    }
  })
})

/**
 * A relic's worth per point runs as `ln(factor)/ln(costRatio)`, because
 * geometric pricing buys levels at the log of what is spent. Two relics that
 * multiply the *same* income — the Candle always, the Hourglass whenever the
 * herd is left alone — have to come out level on that measure, or whichever
 * is ahead wins by a margin that grows with every point earned and the build
 * stops being a choice. `ln 1.5 / ln 3.5 = 0.324` against the Candle's
 * `ln 1.25 / ln 2 = 0.322`. Relics that move only a slice of income (the
 * Sigil, on petting alone) are deliberately allowed a better raw rate.
 */
describe('relics that multiply all production stay level with each other', () => {
  /** Best multiplier `points` can buy on one ladder. */
  function reach(id: RelicId, points: number): number {
    const def = RELIC_BY_ID.get(id)!
    const levels = relicAffordable(def, 0, points)
    return { candle: 1.25, hourglass: 1.5 }[id as 'candle' | 'hourglass'] ** levels
  }

  /**
   * The Hourglass ladder is coarser (×3.5 a level), so the ratio wobbles as
   * one ladder or the other lands a level first; the point is that it wobbles
   * around one rather than climbing.
   */
  test('stays level with the Candle across every reachable budget', () => {
    for (const points of [10, 30, 100, 300, 1_000]) {
      const ratio = reach('hourglass', points) / reach('candle', points)
      expect(ratio).toBeGreaterThan(0.7)
      expect(ratio).toBeLessThan(1.7)
    }
  })

  test('drifts only slowly beyond that, rather than running away', () => {
    expect(reach('hourglass', 5_000) / reach('candle', 5_000)).toBeLessThan(3)
  })
})
