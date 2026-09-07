import { describe, expect, test } from 'vitest'
import { BUILDING_BY_ID } from './buildings'
import {
  baseGoatsPerSecond,
  bulkCost,
  computeStats,
  costOf,
  goatsPerClick,
  goatsPerSecond,
  totalBuildings,
} from './economy'
import { createInitialState } from './state'
import type { Buff, GameState } from './types'

function stateWith(patch: Partial<GameState>): GameState {
  return { ...createInitialState(0), ...patch }
}

const pen = BUILDING_BY_ID.pen
const meadow = BUILDING_BY_ID.meadow

describe('costOf', () => {
  test('is the base cost when none are owned', () => {
    expect(costOf(pen, 0)).toBe(15)
  })

  test('grows 15% per unit owned, rounded up', () => {
    expect(costOf(pen, 1)).toBe(18)
    expect(costOf(pen, 2)).toBe(20)
    expect(costOf(meadow, 10)).toBe(Math.ceil(100 * 1.15 ** 10))
  })
})

describe('bulkCost', () => {
  test('sums the next N prices', () => {
    expect(bulkCost(pen, 0, 1)).toBe(costOf(pen, 0))
    expect(bulkCost(pen, 0, 3)).toBe(costOf(pen, 0) + costOf(pen, 1) + costOf(pen, 2))
  })
})

describe('totalBuildings', () => {
  test('counts every building the player owns', () => {
    const s = stateWith({ buildings: { ...createInitialState(0).buildings, pen: 3, barn: 2 } })
    expect(totalBuildings(s)).toBe(5)
  })
})

describe('baseGoatsPerSecond', () => {
  test('is zero with an empty farm', () => {
    expect(baseGoatsPerSecond(createInitialState(0))).toBe(0)
  })

  test('sums each building line', () => {
    const s = stateWith({ buildings: { ...createInitialState(0).buildings, pen: 10, meadow: 2 } })
    expect(baseGoatsPerSecond(s)).toBeCloseTo(10 * 0.1 + 2 * 1)
  })

  test('a building upgrade doubles only its own line', () => {
    const s = stateWith({
      buildings: { ...createInitialState(0).buildings, pen: 10, meadow: 2 },
      upgrades: ['pen-t1'],
    })
    expect(baseGoatsPerSecond(s)).toBeCloseTo(10 * 0.1 * 2 + 2 * 1)
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

  test('adds a share of production, based on unbuffed output', () => {
    const s = stateWith({
      buildings: { ...createInitialState(0).buildings, meadow: 1_000 },
      upgrades: ['click-whisperer'],
    })
    expect(goatsPerClick(s)).toBeCloseTo(1 + 1_000 * 0.01)
  })

  test('applies click buffs', () => {
    const s = stateWith({ buffs: [clickFrenzy()] })
    expect(goatsPerClick(s)).toBe(777)
  })
})

describe('computeStats', () => {
  test('reports per-building output that adds up to total production', () => {
    const s = stateWith({
      buildings: { ...createInitialState(0).buildings, pen: 10, meadow: 2 },
      buffs: [frenzy()],
    })
    const stats = computeStats(s)
    const summed = Object.values(stats.byBuilding).reduce((a, b) => a + b, 0)
    expect(summed).toBeCloseTo(stats.gps)
    expect(stats.buildingsOwned).toBe(12)
    expect(stats.gpsBase).toBeCloseTo(stats.gps / 7)
  })
})
