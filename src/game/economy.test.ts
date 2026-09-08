import { describe, expect, test } from 'vitest'
import { BUILDING_BY_ID } from './buildings'
import {
  baseGoatsPerSecond,
  bulkCost,
  computeStats,
  costOf,
  goatsPerClick,
  goatsPerSecond,
  milestoneMult,
  nextMilestone,
  totalBuildings,
} from './economy'
import { createInitialState } from './state'
import type { Buff, GameState } from './types'

function stateWith(patch: Partial<GameState>): GameState {
  return { ...createInitialState(0), ...patch }
}

const post = BUILDING_BY_ID.post
const meadow = BUILDING_BY_ID.meadow

describe('costOf', () => {
  test('is the base cost when none are owned', () => {
    expect(costOf(post, 0)).toBe(15)
  })

  test('grows 10% per unit owned, rounded up', () => {
    expect(costOf(post, 1)).toBe(17)
    expect(costOf(post, 2)).toBe(19)
    expect(costOf(meadow, 10)).toBe(Math.ceil(100 * 1.1 ** 10))
  })
})

describe('bulkCost', () => {
  test('sums the next N prices', () => {
    expect(bulkCost(post, 0, 1)).toBe(costOf(post, 0))
    expect(bulkCost(post, 0, 3)).toBe(costOf(post, 0) + costOf(post, 1) + costOf(post, 2))
  })
})

describe('milestoneMult', () => {
  test('is flat below 200', () => {
    expect(milestoneMult(0)).toBe(1)
    expect(milestoneMult(199)).toBe(1)
  })

  test('quadruples at 200 and every 25 after', () => {
    expect(milestoneMult(200)).toBe(4)
    expect(milestoneMult(224)).toBe(4)
    expect(milestoneMult(225)).toBe(16)
    expect(milestoneMult(300)).toBe(4 ** 5)
  })

  test('every thousandth is worth ten instead of four', () => {
    expect(milestoneMult(1000)).toBe(4 ** 32 * 10)
    expect(milestoneMult(2000)).toBe(4 ** 71 * 100)
  })

  test('reports the next count that matters', () => {
    expect(nextMilestone(0)).toBe(200)
    expect(nextMilestone(200)).toBe(225)
    expect(nextMilestone(230)).toBe(250)
  })
})

describe('gilds', () => {
  test('add half a building\'s output per gild', () => {
    const s = stateWith({ buildings: { ...createInitialState(0).buildings, meadow: 10 } })
    s.gilds = { ...s.gilds, meadow: 2 }
    expect(baseGoatsPerSecond(s)).toBeCloseTo(10 * 2)
  })

  test('boost the click bonus of a gilded scratching post', () => {
    const s = stateWith({ buildings: { ...createInitialState(0).buildings, post: 10 } })
    s.gilds = { ...s.gilds, post: 1 }
    expect(goatsPerClick(s)).toBeCloseTo(1 + 10 * 0.2 * 1.5)
  })
})

describe('totalBuildings', () => {
  test('counts every building the player owns', () => {
    const s = stateWith({ buildings: { ...createInitialState(0).buildings, post: 3, barn: 2 } })
    expect(totalBuildings(s)).toBe(5)
  })
})

describe('baseGoatsPerSecond', () => {
  test('is zero with an empty farm', () => {
    expect(baseGoatsPerSecond(createInitialState(0))).toBe(0)
  })

  test('sums each building line', () => {
    const s = stateWith({ buildings: { ...createInitialState(0).buildings, post: 10, meadow: 2 } })
    expect(baseGoatsPerSecond(s)).toBeCloseTo(10 * 0.3 + 2 * 1)
  })

  test('a building upgrade doubles only its own line', () => {
    const s = stateWith({
      buildings: { ...createInitialState(0).buildings, post: 10, meadow: 2 },
      upgrades: ['post-t1'],
    })
    expect(baseGoatsPerSecond(s)).toBeCloseTo(10 * 0.3 * 2 + 2 * 1)
  })

  test('unspent occult points add a percentage each', () => {
    const s = stateWith({
      buildings: { ...createInitialState(0).buildings, meadow: 10 },
      occult: 25,
      occultEarned: 100,
    })
    expect(baseGoatsPerSecond(s)).toBeCloseTo(10 * 2.25)
  })

  test('occult upgrades raise the bonus per point', () => {
    const s = stateWith({
      buildings: { ...createInitialState(0).buildings, meadow: 10 },
      occult: 25,
      upgrades: ['occult-grimoire'],
    })
    expect(baseGoatsPerSecond(s)).toBeCloseTo(10 * 2.5)
  })

  test('per-achievement upgrades scale all production', () => {
    const s = stateWith({
      buildings: { ...createInitialState(0).buildings, meadow: 10 },
      upgrades: ['global-farmhands'],
      achievements: ['a', 'b', 'c'],
    })
    expect(baseGoatsPerSecond(s)).toBeCloseTo(10 * 1.03)
  })

  test('ignores buffs', () => {
    const s = stateWith({
      buildings: { ...createInitialState(0).buildings, meadow: 10 },
      buffs: [frenzy()],
    })
    expect(baseGoatsPerSecond(s)).toBeCloseTo(10)
  })
})

function frenzy(): Buff {
  return {
    id: 'frenzy',
    name: 'Frenzy',
    icon: '🔥',
    kind: 'gpsMult',
    factor: 7,
    remaining: 77,
    duration: 77,
  }
}

function clickFrenzy(): Buff {
  return {
    id: 'click-frenzy',
    name: 'Petting Frenzy',
    icon: '✋',
    kind: 'clickMult',
    factor: 777,
    remaining: 13,
    duration: 13,
  }
}

describe('goatsPerSecond', () => {
  test('applies production buffs', () => {
    const s = stateWith({
      buildings: { ...createInitialState(0).buildings, meadow: 10 },
      buffs: [frenzy()],
    })
    expect(goatsPerSecond(s)).toBeCloseTo(70)
  })

  test('is unaffected by click buffs', () => {
    const s = stateWith({
      buildings: { ...createInitialState(0).buildings, meadow: 10 },
      buffs: [clickFrenzy()],
    })
    expect(goatsPerSecond(s)).toBeCloseTo(10)
  })
})

describe('goatsPerClick', () => {
  test('starts at one goat per pet', () => {
    expect(goatsPerClick(createInitialState(0))).toBe(1)
  })

  test('adds flat bonuses before multiplying', () => {
    const flat = stateWith({ upgrades: ['click-handshake'] })
    expect(goatsPerClick(flat)).toBe(2)

    const both = stateWith({ upgrades: ['click-handshake', 'click-scritch'] })
    expect(goatsPerClick(both)).toBe(4)
  })

  test('scratching posts add to every pet, doubled by their own tiers', () => {
    const posts = stateWith({ buildings: { ...createInitialState(0).buildings, post: 10 } })
    expect(goatsPerClick(posts)).toBeCloseTo(1 + 10 * 0.2)

    const tiered = stateWith({
      buildings: { ...createInitialState(0).buildings, post: 10 },
      upgrades: ['post-t1'],
    })
    expect(goatsPerClick(tiered)).toBeCloseTo(1 + 10 * 0.2 * 2)
  })

  test('adds a share of production, based on unbuffed output', () => {
    const s = stateWith({
      buildings: { ...createInitialState(0).buildings, meadow: 100 },
      upgrades: ['click-whisperer'],
    })
    expect(goatsPerClick(s)).toBeCloseTo(1 + 100 * 0.01)
  })

  test('applies click buffs', () => {
    const s = stateWith({ buffs: [clickFrenzy()] })
    expect(goatsPerClick(s)).toBe(777)
  })

  test('a frenzy lifts pets too, and stacks with a petting frenzy', () => {
    expect(goatsPerClick(stateWith({ buffs: [frenzy()] }))).toBe(7)
    expect(goatsPerClick(stateWith({ buffs: [frenzy(), clickFrenzy()] }))).toBe(7 * 777)
  })
})

describe('computeStats', () => {
  test('reports per-building output that adds up to total production', () => {
    const s = stateWith({
      buildings: { ...createInitialState(0).buildings, post: 10, meadow: 2 },
      buffs: [frenzy()],
    })
    const stats = computeStats(s)
    const summed = Object.values(stats.byBuilding).reduce((a, b) => a + b, 0)
    expect(summed).toBeCloseTo(stats.gps)
    expect(stats.buildingsOwned).toBe(12)
    expect(stats.gpsBase).toBeCloseTo(stats.gps / 7)
  })
})
