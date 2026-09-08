import { describe, expect, test } from 'vitest'
import { costOf } from './economy'
import { BUILDING_BY_ID } from './buildings'
import {
  addBuff,
  ascend,
  buyBuilding,
  moveGild,
  rerollGild,
  buyUpgrade,
  claimAchievements,
  createInitialState,
  earn,
  goatsForOccultLevel,
  occultLevel,
  pendingOccult,
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
    expect(buyBuilding(s, 'post')).toBe(true)
    expect(s.buildings.post).toBe(1)
    expect(s.goats).toBe(5)
  })

  test('refuses when the herd cannot cover it', () => {
    const s = createInitialState(0)
    s.goats = 14
    expect(buyBuilding(s, 'post')).toBe(false)
    expect(s.buildings.post).toBe(0)
    expect(s.goats).toBe(14)
  })

  test('buys several at the escalating price', () => {
    const s = createInitialState(0)
    const price = costOf(BUILDING_BY_ID.post, 0) + costOf(BUILDING_BY_ID.post, 1)
    s.goats = price
    expect(buyBuilding(s, 'post', 2)).toBe(true)
    expect(s.buildings.post).toBe(2)
    expect(s.goats).toBe(0)
  })

  test('buys nothing when it cannot afford the whole batch', () => {
    const s = createInitialState(0)
    s.goats = 20
    expect(buyBuilding(s, 'post', 2)).toBe(false)
    expect(s.buildings.post).toBe(0)
  })

  test('does not count bought buildings as goats spent from nowhere', () => {
    const s = createInitialState(0)
    s.goats = 1_000
    s.totalGoats = 1_000
    buyBuilding(s, 'post')
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

  test('occult upgrades cost occult points, not goats', () => {
    const s = createInitialState(0)
    s.goats = 1e12
    expect(buyUpgrade(s, 'occult-candle')).toBe(false)
    s.occult = 1
    expect(buyUpgrade(s, 'occult-candle')).toBe(true)
    expect(s.occult).toBe(0)
    expect(s.goats).toBe(1e12)
  })

  test('occult upgrades wait for the one they build on', () => {
    const s = createInitialState(0)
    s.occult = 100
    expect(buyUpgrade(s, 'occult-sigil')).toBe(false)
    buyUpgrade(s, 'occult-candle')
    expect(buyUpgrade(s, 'occult-sigil')).toBe(true)
  })
})

describe('occultLevel', () => {
  test('gives fifteen points per tenfold of lifetime goats', () => {
    expect(occultLevel(0)).toBe(0)
    expect(occultLevel(1e8)).toBe(4)
    expect(occultLevel(1e9)).toBe(15)
    expect(occultLevel(1e10)).toBe(30)
    expect(occultLevel(1e12)).toBe(60)
    expect(occultLevel(1e20)).toBe(180)
  })

  test('inverts back to the goats needed', () => {
    expect(occultLevel(goatsForOccultLevel(40))).toBe(40)
    expect(occultLevel(goatsForOccultLevel(40) - 1)).toBe(39)
  })
})

describe('ascend', () => {
  function veteran() {
    const s = createInitialState(0)
    s.goats = 5e10
    s.totalGoats = 1e11
    s.clicks = 500
    s.buildings.meadow = 40
    s.upgrades = ['meadow-t1', 'occult-candle']
    s.achievements = ['first-goat']
    s.buffs = [buff(10)]
    return s
  }

  test('does nothing when there is nothing to gain', () => {
    const s = createInitialState(0)
    s.goats = 500
    s.totalGoats = 500
    s.buildings.meadow = 3
    expect(pendingOccult(s)).toBe(0)
    expect(ascend(s)).toEqual({ occult: 0, gilded: null })
    expect(s.buildings.meadow).toBe(3)
    expect(s.ascensions).toBe(0)
  })

  test('banks the pending points and resets the farm', () => {
    const s = veteran()
    expect(pendingOccult(s)).toBe(45)
    expect(ascend(s).occult).toBe(45)
    expect(s.occult).toBe(45)
    expect(s.occultEarned).toBe(45)
    expect(s.ascensions).toBe(1)
    expect(s.lifetimeGoats).toBe(1e11)
    expect(s.goats).toBe(0)
    expect(s.totalGoats).toBe(0)
    expect(s.buildings.meadow).toBe(0)
    expect(s.buffs).toEqual([])
  })

  test('keeps achievements, lifetime stats and occult upgrades', () => {
    const s = veteran()
    ascend(s)
    expect(s.upgrades).toEqual(['occult-candle'])
    expect(s.achievements).toEqual(['first-goat'])
    expect(s.clicks).toBe(500)
  })

  test('only pays for goats herded since the last ascension', () => {
    const s = veteran()
    ascend(s)
    s.totalGoats = 1e11
    // 2e11 lifetime is level 49, and 45 of those are already banked.
    expect(pendingOccult(s)).toBe(4)
    expect(ascend(s).occult).toBe(4)
    expect(s.occultEarned).toBe(49)
  })

  test('starts the new herd with whatever the occult upgrades grant', () => {
    const s = veteran()
    s.upgrades.push('occult-ashes')
    ascend(s)
    expect(s.goats).toBe(10_000)
  })

  test('gilds one of the buildings owned this run, and gilds survive', () => {
    const s = veteran()
    s.buildings.barn = 1
    // Owned: meadow, barn. A roll of 0.9 lands on the last of them.
    expect(ascend(s, () => 0.9)).toEqual({ occult: 45, gilded: 'barn' })
    expect(s.gilds.barn).toBe(1)
    s.totalGoats = 1e11
    s.buildings.meadow = 1
    expect(ascend(s, () => 0).gilded).toBe('meadow')
    expect(s.gilds).toMatchObject({ barn: 1, meadow: 1 })
  })
})

describe('moveGild', () => {
  test('moves one gild for occult points', () => {
    const s = createInitialState(0)
    s.gilds.meadow = 2
    s.occult = 25
    expect(moveGild(s, 'meadow', 'cosmos')).toBe(true)
    expect(s.gilds).toMatchObject({ meadow: 1, cosmos: 1 })
    expect(s.occult).toBe(5)
  })

  test('refuses without a gild to move, without the points, or to the same building', () => {
    const s = createInitialState(0)
    s.gilds.meadow = 1
    s.occult = 19
    expect(moveGild(s, 'meadow', 'cosmos')).toBe(false)
    s.occult = 100
    expect(moveGild(s, 'barn', 'cosmos')).toBe(false)
    expect(moveGild(s, 'meadow', 'meadow')).toBe(false)
    expect(s.occult).toBe(100)
  })
})

describe('rerollGild', () => {
  test('throws a gild onto a random other building for one point', () => {
    const s = createInitialState(0)
    s.gilds.post = 1
    s.occult = 3
    // Roll 0 picks the first building that is not the source.
    expect(rerollGild(s, 'post', () => 0)).toBe('meadow')
    expect(s.gilds).toMatchObject({ post: 0, meadow: 1 })
    expect(s.occult).toBe(2)
  })

  test('never lands back on the source', () => {
    const s = createInitialState(0)
    s.gilds.meadow = 1
    s.occult = 1
    expect(rerollGild(s, 'meadow', () => 0)).toBe('post')
  })

  test('refuses without a gild or a point', () => {
    const s = createInitialState(0)
    s.occult = 5
    expect(rerollGild(s, 'meadow')).toBeNull()
    s.gilds.meadow = 1
    s.occult = 0
    expect(rerollGild(s, 'meadow')).toBeNull()
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
