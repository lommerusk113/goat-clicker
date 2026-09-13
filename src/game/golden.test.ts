import { describe, expect, test } from 'vitest'
import { BALANCE } from './balance'
import { multipliers } from './economy'
import { goldenLifetime, goldenMakeup, nextGoldenDelay, rollGolden } from './golden'
import { addBuff, createInitialState } from './state'
import type { GameState, Multipliers } from './types'

/** An rng that hands out queued values, then repeats the last one. */
function fakeRng(...values: number[]): () => number {
  let i = 0
  return () => values[Math.min(i++, values.length - 1)]
}

describe('nextGoldenDelay', () => {
  test('stays inside the spawn window', () => {
    const m = multipliers(createInitialState(0))
    expect(nextGoldenDelay(m, fakeRng(0))).toBe(BALANCE.goldenMinDelay)
    expect(nextGoldenDelay(m, fakeRng(0.999999))).toBeCloseTo(BALANCE.goldenMaxDelay, 2)
  })

  test('shortens the wait when spawn upgrades are owned', () => {
    const s = createInitialState(0)
    s.upgrades = ['golden-clover']
    const faster = nextGoldenDelay(multipliers(s), fakeRng(0.5))
    const plain = nextGoldenDelay(multipliers(createInitialState(0)), fakeRng(0.5))
    expect(faster).toBeCloseTo(plain / 1.5)
  })

  test('never sends one sooner than the floor, however high the frequency', () => {
    const m = multipliers(createInitialState(0))
    m.goldenFreq = 1_000
    for (const roll of [0, 0.5, 0.999999]) {
      expect(nextGoldenDelay(m, fakeRng(roll))).toBe(BALANCE.goldenMinGap)
    }
  })
})

/**
 * The floor thins the goats, so the reward makes the thinning back. What an
 * hour pays runs as the reward over the gap, and the make-up is defined as the
 * ratio of those gaps, so the two cancel: a levelled-up player earns the same
 * an hour with the floor as they would have without it.
 */
describe('goldenMakeup', () => {
  const withFreq = (freq: number): Multipliers => {
    const m = multipliers(createInitialState(0))
    m.goldenFreq = freq
    return m
  }

  /** The average gap the draw would give with no floor. */
  const bareGap = (freq: number) => (BALANCE.goldenMinDelay + BALANCE.goldenMaxDelay) / 2 / freq

  /** The average gap actually waited, measured off the real draw. */
  function measuredGap(freq: number): number {
    const m = withFreq(freq)
    let total = 0
    const steps = 20_000
    for (let i = 0; i < steps; i++) total += nextGoldenDelay(m, fakeRng((i + 0.5) / steps))
    return total / steps
  }

  test('is nothing at a frequency the floor cannot reach', () => {
    expect(goldenMakeup(withFreq(1))).toBe(1)
    expect(goldenMakeup(withFreq(14))).toBe(1)
  })

  test('pays back exactly what the floor held back', () => {
    // Frequencies either side of where the floor starts to bite (15) and where
    // it swallows the whole draw (45).
    for (const freq of [16, 20, 45, 100, 1_000]) {
      expect(goldenMakeup(withFreq(freq))).toBeCloseTo(measuredGap(freq) / bareGap(freq), 3)
    }
  })

  test('an hour pays the same as it did before the floor', () => {
    for (const freq of [1, 20, 150]) {
      const perHour = (3_600 / measuredGap(freq)) * goldenMakeup(withFreq(freq))
      expect(perHour).toBeCloseTo(3_600 / bareGap(freq), 6)
    }
  })

  test('a goat at the deep end is worth many of the old ones', () => {
    // A goat every two seconds becomes one every ten, each worth five.
    expect(goldenMakeup(withFreq(150))).toBeCloseTo(5, 5)
  })
})

describe('goldenLifetime', () => {
  test('is the base lifetime with no upgrades', () => {
    expect(goldenLifetime(multipliers(createInitialState(0)))).toBe(BALANCE.goldenLifetime)
  })

  test('is extended by lifetime upgrades', () => {
    const s = createInitialState(0)
    s.upgrades = ['golden-prints']
    expect(goldenLifetime(multipliers(s))).toBe(BALANCE.goldenLifetime * 2)
  })
})

function richFarm(): GameState {
  const s = createInitialState(0)
  s.goats = 1_000_000
  s.buildings.meadow = 1_000 // 1,000 goats per second, so the cap is not the binding limit
  return s
}

/** A farm already running the buff a golden goat would otherwise hand out. */
function running(kind: 'frenzy' | 'clickFrenzy'): GameState {
  const s = richFarm()
  const rolled = rollGolden(s, fakeRng(kind === 'frenzy' ? 0.2 : 0.01))
  expect(rolled.kind).toBe(kind)
  addBuff(s, rolled.buff!)
  return s
}

describe('rollGolden never repeats a buff the herd already has', () => {
  test('a herd in a Frenzy is offered anything but another Frenzy', () => {
    const s = running('frenzy')
    for (let roll = 0; roll < 1; roll += 0.02) {
      expect(rollGolden(s, fakeRng(roll)).kind).not.toBe('frenzy')
    }
  })

  test('a herd in a Petting Frenzy is offered anything but another', () => {
    const s = running('clickFrenzy')
    for (let roll = 0; roll < 1; roll += 0.02) {
      expect(rollGolden(s, fakeRng(roll)).kind).not.toBe('clickFrenzy')
    }
  })

  test('a herd running both can only be lucky', () => {
    const s = running('frenzy')
    addBuff(s, rollGolden(richFarm(), fakeRng(0.01)).buff!)
    for (let roll = 0; roll < 1; roll += 0.02) {
      expect(rollGolden(s, fakeRng(roll)).kind).toBe('lucky')
    }
  })

  test('the odds are untouched while no frenzy is running', () => {
    const s = richFarm()
    expect(rollGolden(s, fakeRng(0.01)).kind).toBe('clickFrenzy')
    expect(rollGolden(s, fakeRng(0.2)).kind).toBe('frenzy')
    expect(rollGolden(s, fakeRng(0.9)).kind).toBe('lucky')
  })

  test('the freed odds go to what is left rather than always landing on lucky', () => {
    // With the Frenzy out of the pool its 40% is shared, so the Petting Frenzy
    // widens from 5% of the roll to 5/60ths of it.
    const s = running('frenzy')
    expect(rollGolden(s, fakeRng(0.08)).kind).toBe('clickFrenzy')
    expect(rollGolden(s, fakeRng(0.09)).kind).toBe('lucky')
  })
})

describe('rollGolden', () => {
  test('lucky pays a slice of the herd and nothing else', () => {
    const s = richFarm()
    const reward = rollGolden(s, fakeRng(0.9))
    expect(reward.kind).toBe('lucky')
    expect(reward.goats).toBeCloseTo(1_000_000 * 0.15 + 13)
    expect(reward.buff).toBeUndefined()
  })

  test('lucky is capped by production, so a fat bank cannot be milked early', () => {
    const s = createInitialState(0)
    s.goats = 1e12
    s.buildings.meadow = 1 // 1 goat per second
    const reward = rollGolden(s, fakeRng(0.9))
    expect(reward.goats).toBeCloseTo(1 * 900 + 13)
  })

  test('frenzy multiplies production for a while', () => {
    const reward = rollGolden(richFarm(), fakeRng(0.3))
    expect(reward.kind).toBe('frenzy')
    expect(reward.buff).toMatchObject({ kind: 'gpsMult', factor: 7, remaining: 60 })
    expect(reward.goats).toBe(0)
  })

  test('petting frenzy multiplies clicks for a short burst', () => {
    const reward = rollGolden(richFarm(), fakeRng(0.01))
    expect(reward.kind).toBe('clickFrenzy')
    expect(reward.buff).toMatchObject({ kind: 'clickMult', factor: 777, remaining: 13 })
  })

  test('lifetime upgrades stretch the frenzies too', () => {
    const s = richFarm()
    s.upgrades.push('golden-prints')
    expect(rollGolden(s, fakeRng(0.3)).buff).toMatchObject({ remaining: 120, duration: 120 })
    expect(rollGolden(s, fakeRng(0.01)).buff).toMatchObject({ remaining: 26, duration: 26 })
  })

  test('power upgrades scale the payout', () => {
    const s = richFarm()
    s.upgrades = ['golden-bell']
    const reward = rollGolden(s, fakeRng(0.9))
    expect(reward.goats).toBeCloseTo((1_000_000 * 0.15 + 13) * 1.3)
  })

  test('power upgrades do not stretch buff timers', () => {
    const s = richFarm()
    s.upgrades = ['golden-bell']
    const reward = rollGolden(s, fakeRng(0.3))
    expect(reward.buff!.remaining).toBe(60)
  })
})
