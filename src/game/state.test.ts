import { describe, expect, test } from 'vitest'
import { costOf } from './economy'
import { BUILDING_BY_ID } from './buildings'
import {
  addBuff,
  buyBuilding,
  buyUpgrade,
  claimAchievements,
  createInitialState,
  earn,
  petGoat,
  produce,
  tickBuffs,
} from './state'
import type { Buff } from './types'

describe('createInitialState', () => {
  test('starts with an empty farm', () => {
    const s = createInitialState(1_000)
    expect(s.goats).toBe(0)
    expect(s.totalGoats).toBe(0)
    expect(s.clicks).toBe(0)
    expect(s.upgrades).toEqual([])
    expect(s.achievements).toEqual([])
    expect(Object.values(s.buildings).every((n) => n === 0)).toBe(true)
    expect(s.startedAt).toBe(1_000)
  })
})

describe('petGoat', () => {
  test('gathers one goat and records the pet', () => {
    const s = createInitialState(0)
    expect(petGoat(s)).toBe(1)
    expect(s.goats).toBe(1)
    expect(s.totalGoats).toBe(1)
    expect(s.goatsFromClicks).toBe(1)
    expect(s.clicks).toBe(1)
  })
})

describe('earn', () => {
  test('raises both the bank and the all-time total', () => {
    const s = createInitialState(0)
    earn(s, 50)
    expect(s.goats).toBe(50)
    expect(s.totalGoats).toBe(50)
  })
})

describe('produce', () => {
  test('pays out production for the elapsed time', () => {
    const s = createInitialState(0)
    s.buildings.meadow = 10
    expect(produce(s, 0.5)).toBeCloseTo(5)
    expect(s.goats).toBeCloseTo(5)
  })
})

describe('buyBuilding', () => {
  test('spends goats and adds the building', () => {
    const s = createInitialState(0)
    s.goats = 20
    expect(buyBuilding(s, 'pen')).toBe(true)
    expect(s.buildings.pen).toBe(1)
    expect(s.goats).toBe(5)
  })

  test('refuses when the herd cannot cover it', () => {
    const s = createInitialState(0)
    s.goats = 14
    expect(buyBuilding(s, 'pen')).toBe(false)
    expect(s.buildings.pen).toBe(0)
    expect(s.goats).toBe(14)
  })

  test('buys several at the escalating price', () => {
    const s = createInitialState(0)
    const price = costOf(BUILDING_BY_ID.pen, 0) + costOf(BUILDING_BY_ID.pen, 1)
    s.goats = price
    expect(buyBuilding(s, 'pen', 2)).toBe(true)
    expect(s.buildings.pen).toBe(2)
    expect(s.goats).toBe(0)
  })

  test('buys nothing when it cannot afford the whole batch', () => {
    const s = createInitialState(0)
    s.goats = 20
    expect(buyBuilding(s, 'pen', 2)).toBe(false)
    expect(s.buildings.pen).toBe(0)
  })

  test('does not count bought buildings as goats spent from nowhere', () => {
    const s = createInitialState(0)
    s.goats = 1_000
    s.totalGoats = 1_000
    buyBuilding(s, 'pen')
    expect(s.totalGoats).toBe(1_000)
  })
})

describe('buyUpgrade', () => {
  test('spends goats and records the upgrade', () => {
    const s = createInitialState(0)
    s.clicks = 20
    s.goats = 100
    expect(buyUpgrade(s, 'click-handshake')).toBe(true)
    expect(s.upgrades).toContain('click-handshake')
    expect(s.goats).toBe(0)
  })

  test('refuses an upgrade that is still locked', () => {
    const s = createInitialState(0)
    s.goats = 1_000
    expect(buyUpgrade(s, 'click-handshake')).toBe(false)
    expect(s.upgrades).toEqual([])
  })

  test('refuses when too poor', () => {
    const s = createInitialState(0)
    s.clicks = 20
    s.goats = 99
    expect(buyUpgrade(s, 'click-handshake')).toBe(false)
  })

  test('refuses to buy the same upgrade twice', () => {
    const s = createInitialState(0)
    s.clicks = 20
    s.goats = 1_000
    buyUpgrade(s, 'click-handshake')
    expect(buyUpgrade(s, 'click-handshake')).toBe(false)
    expect(s.upgrades).toEqual(['click-handshake'])
  })

  test('refuses an unknown id', () => {
    const s = createInitialState(0)
    s.goats = 1e12
    expect(buyUpgrade(s, 'not-a-real-upgrade')).toBe(false)
  })
})

function buff(remaining: number): Buff {
  return {
    id: 'frenzy',
    name: 'Frenzy',
    icon: '🔥',
    kind: 'gpsMult',
    factor: 7,
    remaining,
    duration: 77,
  }
}

describe('tickBuffs', () => {
  test('counts down without dropping a live buff', () => {
    const s = createInitialState(0)
    s.buffs = [buff(10)]
    expect(tickBuffs(s, 4)).toEqual([])
    expect(s.buffs[0].remaining).toBeCloseTo(6)
  })

  test('removes and reports expired buffs', () => {
    const s = createInitialState(0)
    s.buffs = [buff(3)]
    const expired = tickBuffs(s, 4)
    expect(expired.map((b) => b.id)).toEqual(['frenzy'])
    expect(s.buffs).toEqual([])
  })
})

describe('addBuff', () => {
  test('adds a buff to an empty herd', () => {
    const s = createInitialState(0)
    addBuff(s, buff(77))
    expect(s.buffs).toHaveLength(1)
  })

  test('refreshes a buff already running instead of stacking it', () => {
    const s = createInitialState(0)
    s.buffs = [buff(3)]
    addBuff(s, buff(77))
    expect(s.buffs).toHaveLength(1)
    expect(s.buffs[0].remaining).toBe(77)
  })
})

describe('claimAchievements', () => {
  test('awards newly met achievements once', () => {
    const s = createInitialState(0)
    s.clicks = 1
    const first = claimAchievements(s)
    expect(first.map((a) => a.id)).toContain('first-goat')
    expect(s.achievements).toContain('first-goat')
    expect(claimAchievements(s)).toEqual([])
  })
})
