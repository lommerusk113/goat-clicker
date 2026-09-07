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
import { createInitialState } from './state'

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
    s.upgrades = ['click-handshake']
    s.achievements = ['first-goat']
    s.goldenClicks = 3
    s.playTime = 60

    const back = decodeSave(encodeSave(s))
    expect(back).toEqual(s)
  })

  test('rejects text that is not a save', () => {
    expect(decodeSave('')).toBeNull()
    expect(decodeSave('hello goats')).toBeNull()
    expect(decodeSave(btoa('{"not":"a save"}'))).toBeNull()
  })

  test('fills in fields missing from an older save', () => {
    const partial = btoa(JSON.stringify({ version: 1, goats: 5, buildings: { pen: 2 } }))
    const back = decodeSave(partial)
    expect(back).not.toBeNull()
    expect(back!.goats).toBe(5)
    expect(back!.buildings.pen).toBe(2)
    expect(back!.buildings.cosmos).toBe(0)
    expect(back!.upgrades).toEqual([])
    expect(back!.buffs).toEqual([])
    expect(back!.goldenClicks).toBe(0)
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
})
