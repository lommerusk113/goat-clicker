import { describe, expect, test } from 'vitest'
import { costOf } from './economy'
import { BUILDING_BY_ID } from './buildings'
import {
  addBuff,
  ascend,
  buyBuilding,
  buyRelic,
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

})

describe('buyRelic', () => {
  test('levels a relic with occult points, not goats', () => {
    const s = createInitialState(0)
    s.goats = 1e12
    expect(buyRelic(s, 'candle')).toBe(0)
    s.occult = 1
    expect(buyRelic(s, 'candle')).toBe(1)
    expect(s.occultLevels.candle).toBe(1)
    expect(s.occult).toBe(0)
    expect(s.goats).toBe(1e12)
  })

  test('charges a doubling price per level', () => {
    const s = createInitialState(0)
    s.occult = 7
    // Levels 1, 2 and 3 of a step-1 relic come to 1 + 2 + 4.
    expect(buyRelic(s, 'candle', 3)).toBe(3)
    expect(s.occult).toBe(0)
    expect(s.occultLevels.candle).toBe(3)
  })

  test('a dearer relic starts its ladder at its step', () => {
    const s = createInitialState(0)
    s.occult = 9
    // The Crown steps from three: 3 + 6 for two levels.
    expect(buyRelic(s, 'crown', 2)).toBe(2)
    expect(s.occult).toBe(0)
  })

  test('buys nothing when the whole order is out of reach', () => {
    const s = createInitialState(0)
    s.occult = 5
    expect(buyRelic(s, 'candle', 3)).toBe(0)
    expect(s.occult).toBe(5)
    expect(s.occultLevels.candle).toBe(0)
  })

  test('max takes as many levels as the points stretch to', () => {
    const s = createInitialState(0)
    s.occult = 15
    // 1+2+4+8 = 15 exactly; a fifth level would cost 16 more.
    expect(buyRelic(s, 'candle', 'max')).toBe(4)
    expect(s.occult).toBe(0)
  })

  test('max on an empty purse buys nothing', () => {
    const s = createInitialState(0)
    expect(buyRelic(s, 'candle', 'max')).toBe(0)
  })
})

describe('the idle clock', () => {
  test('starts at zero on a fresh farm', () => {
    expect(createInitialState(0).sincePet).toBe(0)
  })

  test('runs on while the herd produces', () => {
    const s = createInitialState(0)
    produce(s, 30)
    produce(s, 45)
    expect(s.sincePet).toBe(75)
  })

  test('shrugs off five stray pets, then the sixth resets it', () => {
    const s = createInitialState(0)
    produce(s, 600)
    for (let i = 0; i < 5; i++) petGoat(s)
    expect(s.sincePet).toBe(600)
    petGoat(s)
    expect(s.sincePet).toBe(0)
    expect(s.idlePets).toBe(0)
  })

  test('is reset by a pet while busy', () => {
    const s = createInitialState(0)
    produce(s, 60)
    petGoat(s)
    expect(s.sincePet).toBe(0)
  })

  test('a pet never collects the idle bonus it just cancelled', () => {
    const idle = createInitialState(0)
    idle.buildings.meadow = 10
    idle.occultLevels.hourglass = 4
    idle.upgrades = ['click-whisperer']
    produce(idle, 600)

    const active = { ...idle, sincePet: 0 }
    // The click share reads production, so the two must price a pet the same,
    // whether the pet is shrugged off or breaks the idle.
    expect(petGoat(idle)).toBeCloseTo(petGoat(active))
    idle.idlePets = 5
    expect(petGoat(idle)).toBeCloseTo(petGoat(active))
  })
})

describe('occultLevel', () => {
  test('is three times the fourth root of lifetime goats in units of ten billion', () => {
    expect(occultLevel(0)).toBe(0)
    expect(occultLevel(1e8)).toBe(0)
    expect(occultLevel(1.3e8)).toBe(1)
    expect(occultLevel(1e10)).toBe(3)
    expect(occultLevel(1e11)).toBe(5)
    expect(occultLevel(1e12)).toBe(9)
    expect(occultLevel(1e14)).toBe(30)
    expect(occultLevel(1e18)).toBe(300)
    expect(occultLevel(1e22)).toBe(3000)
  })

  test('inverts back to the goats needed', () => {
    expect(occultLevel(goatsForOccultLevel(12))).toBe(12)
    expect(occultLevel(goatsForOccultLevel(12) * 0.999)).toBe(11)
    expect(occultLevel(goatsForOccultLevel(3000))).toBe(3000)
  })
})

describe('ascend', () => {
  function veteran() {
    const s = createInitialState(0)
    s.goats = 5e11
    s.totalGoats = 1.5e12
    s.clicks = 500
    s.buildings.meadow = 40
    s.upgrades = ['meadow-t1']
    s.occultLevels.candle = 3
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
    expect(ascend(s)).toEqual({ occult: 0, gilded: [] })
    expect(s.buildings.meadow).toBe(3)
    expect(s.ascensions).toBe(0)
  })

  test('banks the pending points and resets the farm', () => {
    const s = veteran()
    expect(pendingOccult(s)).toBe(10)
    expect(ascend(s).occult).toBe(10)
    expect(s.occult).toBe(10)
    expect(s.occultEarned).toBe(10)
    expect(s.ascensions).toBe(1)
    expect(s.lifetimeGoats).toBe(1.5e12)
    expect(s.goats).toBe(0)
    expect(s.totalGoats).toBe(0)
    expect(s.buildings.meadow).toBe(0)
    expect(s.buffs).toEqual([])
  })

  test('keeps achievements, lifetime stats and relics but no goat upgrades', () => {
    const s = veteran()
    ascend(s)
    expect(s.upgrades).toEqual([])
    expect(s.occultLevels.candle).toBe(3)
    expect(s.achievements).toEqual(['first-goat'])
    expect(s.clicks).toBe(500)
  })

  test('only pays for goats herded since the last ascension', () => {
    const s = veteran()
    ascend(s)
    s.totalGoats = 1e12
    // 2.5e12 lifetime is level 11 (3 × 250^¼ = 11.9), and 10 of those are already banked.
    expect(pendingOccult(s)).toBe(1)
    expect(ascend(s).occult).toBe(1)
    expect(s.occultEarned).toBe(11)
  })

  test('starts the new herd with whatever the Ashes grant', () => {
    const s = veteran()
    s.occultLevels.ashes = 2
    ascend(s)
    expect(s.goats).toBe(100_000)
  })

  test('hands out a gild per five points earned, on buildings owned this run', () => {
    const s = veteran()
    s.buildings.barn = 1
    // Ten points: two gilds. Owned: meadow, barn. A roll of 0.9 lands on the last of them.
    expect(ascend(s, () => 0.9)).toEqual({ occult: 10, gilded: ['barn', 'barn'] })
    expect(s.gilds.barn).toBe(2)
    // One more point (11 earned) crosses no multiple of five: no gild.
    s.totalGoats = 1e12
    s.buildings.meadow = 1
    expect(ascend(s, () => 0)).toEqual({ occult: 1, gilded: [] })
    expect(s.gilds).toMatchObject({ barn: 2, meadow: 0 })
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
