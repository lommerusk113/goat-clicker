import { describe, expect, test } from 'vitest'
import {
  OFFLINE_CAP_SECONDS,
  OFFLINE_RATE,
  decodeSave,
  encodeSave,
  loadGame,
  offlineGain,
  saveGame,
} from './save'
import { BALANCE } from './balance'
import { createInitialState, occultLevel, pendingOccult } from './state'

function fakeStorage(): Storage {
  const map = new Map<string, string>()
  return {
    get length() {
      return map.size
    },
    clear: () => map.clear(),
    getItem: (k: string) => (map.has(k) ? map.get(k)! : null),
    key: (i: number) => [...map.keys()][i] ?? null,
    removeItem: (k: string) => void map.delete(k),
    setItem: (k: string, v: string) => void map.set(k, v),
  }
}

describe('encodeSave / decodeSave', () => {
  test('round-trips a played game', () => {
    const s = createInitialState(1_000)
    s.goats = 1234.5
    s.totalGoats = 9_999
    s.clicks = 42
    s.buildings.barn = 7
    s.gilds.barn = 2
    s.upgrades = ['click-handshake']
    s.achievements = ['first-goat']
    s.goldenClicks = 3
    s.playTime = 60

    // The idle clock is not saved: whoever is loading has been away.
    const back = decodeSave(encodeSave(s))
    expect(back).toEqual({ ...s, sincePet: BALANCE.idleSeconds })
  })

  test('rejects text that is not a save', () => {
    expect(decodeSave('')).toBeNull()
    expect(decodeSave('hello goats')).toBeNull()
    expect(decodeSave(btoa('{"not":"a save"}'))).toBeNull()
  })

  test('fills in fields missing from an older save', () => {
    const partial = btoa(JSON.stringify({ version: 1, goats: 5, buildings: { post: 2 } }))
    const back = decodeSave(partial)
    expect(back).not.toBeNull()
    expect(back!.goats).toBe(5)
    expect(back!.buildings.post).toBe(2)
    expect(back!.buildings.cosmos).toBe(0)
    expect(back!.upgrades).toEqual([])
    expect(back!.buffs).toEqual([])
    expect(back!.goldenClicks).toBe(0)
    expect(back!.ascensions).toBe(0)
    expect(back!.occult).toBe(0)
    expect(back!.occultEarned).toBe(0)
    expect(back!.lifetimeGoats).toBe(0)
    expect(back!.gilds.post).toBe(0)
    expect(back!.occultLevels.candle).toBe(0)
    expect(back!.occultCredit).toBe(0)
  })

  test('carries version 1 goat pens over as scratching posts', () => {
    const old = btoa(JSON.stringify({ version: 1, goats: 5, buildings: { pen: 7 } }))
    expect(decodeSave(old)!.buildings.post).toBe(7)
  })

  test('keeps the idle clock run out, so time away pays the idle rate', () => {
    const fresh = btoa(JSON.stringify({ version: 3, goats: 1 }))
    expect(decodeSave(fresh)!.sincePet).toBe(BALANCE.idleSeconds)
  })

  test('drops unknown building and upgrade ids', () => {
    const junk = btoa(
      JSON.stringify({
        version: 1,
        goats: 1,
        buildings: { pen: 1, unicornStable: 99 },
        upgrades: ['click-handshake', 'ghost-upgrade'],
        achievements: ['first-goat', 'ghost-achievement'],
      }),
    )
    const back = decodeSave(junk)!
    expect('unicornStable' in back.buildings).toBe(false)
    expect(back.upgrades).toEqual(['click-handshake'])
    expect(back.achievements).toEqual(['first-goat'])
  })
})

/** A save written before the relics, by someone well into the occult tree. */
function version2Save(over: Record<string, unknown> = {}): string {
  return btoa(
    JSON.stringify({
      version: 2,
      goats: 1e9,
      totalGoats: 2.5e9,
      lifetimeGoats: 0,
      occult: 4,
      occultEarned: 21,
      ascensions: 6,
      upgrades: [
        'post-t1',
        'post-t2',
        'post-t3',
        'post-t4',
        'post-t5',
        'post-t6',
        'post-t7',
        'post-t8',
        'meadow-t1',
        'meadow-t2',
        'click-handshake',
        'occult-candle',
        'occult-grimoire',
      ],
      achievements: ['first-goat', 'upgrades-100', 'upgrades-130'],
      gilds: { barn: 3 },
      ...over,
    }),
  )
}

describe('migrating a version 2 save to the relics', () => {
  test('hands every point ever earned back to be respent', () => {
    const back = decodeSave(version2Save())!
    expect(back.occult).toBe(21)
    expect(back.occultEarned).toBe(21)
  })

  test('starts every relic at level zero', () => {
    const back = decodeSave(version2Save())!
    expect(Object.values(back.occultLevels).every((level) => level === 0)).toBe(true)
  })

  test('credits points the retuned curve would otherwise claw back', () => {
    const back = decodeSave(version2Save())!
    // 2.5e9 goats is worth three points on the current curve, so 18 are credit.
    expect(occultLevel(back.lifetimeGoats + back.totalGoats)).toBe(3)
    expect(back.occultCredit).toBe(18)
  })

  test('credits nothing to a save the current curve already covers', () => {
    const rich = decodeSave(version2Save({ totalGoats: 1e20, occultEarned: 10 }))!
    expect(rich.occultCredit).toBe(0)
  })

  test('keeps as many building tiers as the shortened ladder holds', () => {
    const back = decodeSave(version2Save())!
    // Eight rungs climbed on the post, five rungs left to stand on.
    expect(back.upgrades.filter((id) => id.startsWith('post-t')).sort()).toEqual([
      'post-t1',
      'post-t2',
      'post-t3',
      'post-t4',
      'post-t5',
    ])
    expect(back.upgrades.filter((id) => id.startsWith('meadow-t')).sort()).toEqual([
      'meadow-t1',
      'meadow-t2',
    ])
  })

  test('drops the occult upgrade ids and keeps the goat-bought ones', () => {
    const back = decodeSave(version2Save())!
    expect(back.upgrades).toContain('click-handshake')
    expect(back.upgrades.some((id) => id.startsWith('occult-'))).toBe(false)
  })

  test('carries renamed achievements across', () => {
    const back = decodeSave(version2Save())!
    expect(back.achievements.sort()).toEqual(['first-goat', 'upgrades-75', 'upgrades-90'])
  })

  test('leaves gilds and ascensions alone', () => {
    const back = decodeSave(version2Save())!
    expect(back.gilds.barn).toBe(3)
    expect(back.ascensions).toBe(6)
  })

  test('does not respec a save that already has relics', () => {
    const current = btoa(
      JSON.stringify({
        version: 3,
        goats: 1,
        occult: 2,
        occultEarned: 30,
        occultCredit: 5,
        occultLevels: { candle: 4 },
      }),
    )
    const back = decodeSave(current)!
    expect(back.occult).toBe(2)
    expect(back.occultLevels.candle).toBe(4)
    // A version 3 save is retuned onto the root curve: one goat is worth nothing, so all 30 points become credit.
    expect(back.occultCredit).toBe(30)
  })
})

function version3Save(over: Record<string, unknown> = {}): string {
  return btoa(
    JSON.stringify({
      version: 3,
      goats: 0,
      totalGoats: 0,
      lifetimeGoats: 1e12,
      occult: 4,
      occultEarned: 10,
      occultCredit: 0,
      occultLevels: { candle: 3 },
      ...over,
    }),
  )
}

describe('migrating a version 3 save to the root curve', () => {
  test('credits the points the new curve is short around a trillion', () => {
    const back = decodeSave(version3Save())!
    // 1e12 was ten points on the log curve and is eight on the root.
    expect(occultLevel(1e12)).toBe(8)
    expect(back.occultCredit).toBe(2)
    expect(pendingOccult(back)).toBe(0)
  })

  test('credits nothing where the new curve already pays more', () => {
    // 1e18 was forty points on the log curve and is eighty-six on the root.
    const back = decodeSave(version3Save({ lifetimeGoats: 1e18, occultEarned: 40 }))!
    expect(back.occultCredit).toBe(0)
    expect(pendingOccult(back)).toBe(86 - 40)
  })

  test('keeps relic levels and unspent points as they are', () => {
    const back = decodeSave(version3Save())!
    expect(back.occult).toBe(4)
    expect(back.occultLevels.candle).toBe(3)
  })

  test('loads as the current version', () => {
    expect(decodeSave(version3Save())!.version).toBe(4)
  })
})

describe('a version 4 save', () => {
  test('keeps its stored credit', () => {
    const current = btoa(JSON.stringify({ version: 4, goats: 1, lifetimeGoats: 1e12, occultEarned: 30, occultCredit: 5 }))
    expect(decodeSave(current)!.occultCredit).toBe(5)
  })
})

describe('saveGame / loadGame', () => {
  test('persists through storage', () => {
    const storage = fakeStorage()
    const s = createInitialState(0)
    s.goats = 500
    saveGame(s, storage, 12_345)
    expect(s.lastSaved).toBe(12_345)

    const loaded = loadGame(storage)
    expect(loaded!.goats).toBe(500)
    expect(loaded!.lastSaved).toBe(12_345)
  })

  test('returns null when there is nothing saved', () => {
    expect(loadGame(fakeStorage())).toBeNull()
  })

  test('returns null when the stored save is corrupt', () => {
    const storage = fakeStorage()
    saveGame(createInitialState(0), storage, 0)
    storage.setItem('goatclicker.save', 'corrupted!!')
    expect(loadGame(storage)).toBeNull()
  })
})

describe('offlineGain', () => {
  test('pays a reduced rate for time away', () => {
    const gain = offlineGain(10, 100)
    expect(gain.seconds).toBe(100)
    expect(gain.goats).toBeCloseTo(10 * 100 * OFFLINE_RATE)
  })

  test('caps how much time counts', () => {
    const gain = offlineGain(10, OFFLINE_CAP_SECONDS + 5_000)
    expect(gain.seconds).toBe(OFFLINE_CAP_SECONDS)
    expect(gain.goats).toBeCloseTo(10 * OFFLINE_CAP_SECONDS * OFFLINE_RATE)
  })

  test('pays nothing for a clock that ran backwards', () => {
    expect(offlineGain(10, -500)).toEqual({ seconds: 0, goats: 0 })
  })

  test('pays nothing without production', () => {
    expect(offlineGain(0, 3_600)).toEqual({ seconds: 3_600, goats: 0 })
  })

  test('never pays above full pace', () => {
    const gain = offlineGain(10, OFFLINE_CAP_SECONDS * 2, OFFLINE_RATE * 4, OFFLINE_CAP_SECONDS * 4)
    expect(gain.seconds).toBe(OFFLINE_CAP_SECONDS * 2)
    expect(gain.goats).toBeCloseTo(10 * OFFLINE_CAP_SECONDS * 2)
  })
})
