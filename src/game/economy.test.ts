import { describe, expect, test } from 'vitest'
import { BUILDING_BY_ID } from './buildings'
import {
  baseGoatsPerSecond,
  bulkCost,
  computeStats,
  costOf,
  goatsPerClick,
  goatsPerSecond,
  idleIn,
  isIdle,
  milestoneMult,
  milestonesCrossed,
  nextMilestone,
  renown,
  renownMult,
  totalBuildings,
} from './economy'
import { BALANCE } from './balance'
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

describe('milestonesCrossed', () => {
  test('counts nothing until the first milestone', () => {
    expect(milestonesCrossed(0)).toBe(0)
    expect(milestonesCrossed(199)).toBe(0)
  })

  test('counts one per 25 owned from 200 up', () => {
    expect(milestonesCrossed(200)).toBe(1)
    expect(milestonesCrossed(224)).toBe(1)
    expect(milestonesCrossed(225)).toBe(2)
    expect(milestonesCrossed(300)).toBe(5)
  })

  test('a thousandth counts as one like any other', () => {
    expect(milestonesCrossed(1000)).toBe(milestonesCrossed(975) + 1)
  })
})

describe('renown', () => {
  test('is nothing on a fresh herd', () => {
    expect(renown(createInitialState(0))).toBe(0)
    expect(renownMult(createInitialState(0))).toBe(1)
  })

  test('adds up the milestones every building has crossed', () => {
    const s = stateWith({ buildings: { ...createInitialState(0).buildings, post: 300, meadow: 225 } })
    expect(renown(s)).toBe(5 + 2)
  })

  test('compounds the herd-wide bonus once per milestone', () => {
    const s = stateWith({ buildings: { ...createInitialState(0).buildings, post: 225 } })
    expect(renownMult(s)).toBeCloseTo((1 + BALANCE.renownPercent / 100) ** 2)
  })

  test('multiplies production, so a milestone pays the whole herd', () => {
    const bare = stateWith({ buildings: { ...createInitialState(0).buildings, post: 199, meadow: 50 } })
    const past = stateWith({ buildings: { ...createInitialState(0).buildings, post: 200, meadow: 50 } })
    // The post's own line quadruples; the meadow only gains what renown pays it.
    expect(computeStats(past).byBuilding.meadow / computeStats(bare).byBuilding.meadow).toBeCloseTo(
      1 + BALANCE.renownPercent / 100,
    )
  })

  test('is reported to the interface alongside what it pays', () => {
    const s = stateWith({ buildings: { ...createInitialState(0).buildings, post: 250 } })
    const stats = computeStats(s)
    expect(stats.renown).toBe(3)
    expect(stats.renownMult).toBeCloseTo((1 + BALANCE.renownPercent / 100) ** 3)
  })

  test('leaves a herd below the first milestone exactly as it was', () => {
    const s = stateWith({ buildings: { ...createInitialState(0).buildings, post: 199, meadow: 199 } })
    expect(renownMult(s)).toBe(1)
    expect(computeStats(s).globalMult).toBe(1)
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
  test('add a building\'s full output per gild', () => {
    const s = stateWith({ buildings: { ...createInitialState(0).buildings, meadow: 10 } })
    s.gilds = { ...s.gilds, meadow: 2 }
    expect(baseGoatsPerSecond(s)).toBeCloseTo(10 * 3)
  })

  test('boost the click bonus of a gilded scratching post', () => {
    const s = stateWith({ buildings: { ...createInitialState(0).buildings, post: 10 } })
    s.gilds = { ...s.gilds, post: 1 }
    expect(goatsPerClick(s)).toBeCloseTo(1 + 10 * 0.02 * 2)
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

  test('unspent occult points add fifteen percent each; spent ones do not', () => {
    const s = stateWith({
      buildings: { ...createInitialState(0).buildings, meadow: 10 },
      occult: 25,
      occultEarned: 100,
    })
    expect(baseGoatsPerSecond(s)).toBeCloseTo(10 * 4.75)
  })

  test('the Grimoire raises the bonus per point', () => {
    const base = createInitialState(0)
    const s = stateWith({
      buildings: { ...base.buildings, meadow: 10 },
      occult: 25,
      // Two levels take each point from 15% to 19%, so 25 points pay ×5.75.
      occultLevels: { ...base.occultLevels, grimoire: 2 },
    })
    expect(baseGoatsPerSecond(s)).toBeCloseTo(10 * 5.75)
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
    expect(goatsPerClick(both)).toBe(2.5)
  })

  test('scratching posts add to every pet, doubled by their own tiers', () => {
    const posts = stateWith({ buildings: { ...createInitialState(0).buildings, post: 10 } })
    expect(goatsPerClick(posts)).toBeCloseTo(1 + 10 * 0.02)

    const tiered = stateWith({
      buildings: { ...createInitialState(0).buildings, post: 10 },
      upgrades: ['post-t1'],
    })
    expect(goatsPerClick(tiered)).toBeCloseTo(1 + 10 * 0.02 * 2)
  })

  test('milestones lift a post\'s production but not its click bonus', () => {
    const s = stateWith({ buildings: { ...createInitialState(0).buildings, post: 200 } })
    // The 200th post is also the herd's first milestone, so renown pays on top of
    // both — it is herd-wide, like the occult bonus. The x4 itself stays off pets.
    expect(baseGoatsPerSecond(s)).toBeCloseTo(200 * 0.3 * 4 * renownMult(s))
    expect(goatsPerClick(s)).toBeCloseTo((1 + 200 * 0.02) * renownMult(s))
  })

  test('adds a share of production, based on unbuffed output', () => {
    const s = stateWith({
      buildings: { ...createInitialState(0).buildings, meadow: 100 },
      upgrades: ['click-whisperer'],
    })
    expect(goatsPerClick(s)).toBeCloseTo(1 + 100 * 0.005)
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

describe('the idle bonus', () => {
  function idler(level: number, sincePet: number) {
    const base = createInitialState(0)
    return stateWith({
      buildings: { ...base.buildings, meadow: 10 },
      occultLevels: { ...base.occultLevels, hourglass: level },
      sincePet,
    })
  }

  test('pays nothing until the herd has been left alone long enough', () => {
    expect(isIdle(idler(2, BALANCE.idleSeconds - 1))).toBe(false)
    expect(baseGoatsPerSecond(idler(2, BALANCE.idleSeconds - 1))).toBeCloseTo(10)
  })

  test('pays the Hourglass once the clock runs out', () => {
    expect(isIdle(idler(2, BALANCE.idleSeconds))).toBe(true)
    expect(baseGoatsPerSecond(idler(2, BALANCE.idleSeconds))).toBeCloseTo(10 * 1.5 ** 2)
  })

  test('counts down the seconds left before it starts', () => {
    expect(idleIn(idler(2, 0))).toBe(BALANCE.idleSeconds)
    expect(idleIn(idler(2, 90))).toBe(BALANCE.idleSeconds - 90)
    expect(idleIn(idler(2, 1_000))).toBe(0)
  })

  test('does nothing at all without the Hourglass', () => {
    const base = createInitialState(0)
    const s = stateWith({
      buildings: { ...base.buildings, meadow: 10 },
      sincePet: 1_000,
    })
    expect(baseGoatsPerSecond(s)).toBeCloseTo(10)
  })

  test('shows up in the stats the interface draws', () => {
    const stats = computeStats(idler(2, BALANCE.idleSeconds))
    expect(stats.idleMult).toBeCloseTo(1.5 ** 2)
    expect(stats.idleIn).toBe(0)
    expect(stats.gps).toBeCloseTo(10 * 1.5 ** 2)
  })
})
