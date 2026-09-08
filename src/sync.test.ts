import { describe, expect, test } from 'vitest'
import { lastSavedOf, onRequestGet, onRequestPut } from '../functions/api/save/[token]'
import type { Context } from '../functions/api/save/[token]'
import { encodeSave } from './game/save'
import { createInitialState } from './game/state'
import { isSyncToken, newerSave, pullSave, pushSave } from './sync'

const TOKEN = '123e4567-e89b-12d3-a456-426614174000'

function fakeStore() {
  const map = new Map<string, { value: string; metadata: { lastSaved: number } }>()
  return {
    map,
    async getWithMetadata(key: string) {
      const hit = map.get(key)
      return hit ? { value: hit.value, metadata: hit.metadata } : { value: null, metadata: null }
    },
    async put(key: string, value: string, options?: { metadata?: { lastSaved: number } }) {
      map.set(key, { value, metadata: options?.metadata ?? { lastSaved: 0 } })
    },
  }
}

function ctx(store: ReturnType<typeof fakeStore>, token: string, body?: string): Context {
  return {
    request: new Request('https://goat.test/api/save/x', body === undefined ? undefined : { method: 'PUT', body }),
    env: { SAVES: store },
    params: { token },
  }
}

function saveAt(lastSaved: number): string {
  const s = createInitialState(0)
  s.lastSaved = lastSaved
  return encodeSave(s)
}

describe('save endpoint', () => {
  test('stores a save and hands it back', async () => {
    const store = fakeStore()
    expect((await onRequestPut(ctx(store, TOKEN, saveAt(100)))).status).toBe(204)
    const res = await onRequestGet(ctx(store, TOKEN))
    expect(res.status).toBe(200)
    expect(await res.text()).toBe(saveAt(100))
  })

  test('404s a token with nothing stored', async () => {
    expect((await onRequestGet(ctx(fakeStore(), TOKEN))).status).toBe(404)
  })

  test('refuses a stale write and returns the newer save', async () => {
    const store = fakeStore()
    await onRequestPut(ctx(store, TOKEN, saveAt(200)))
    const res = await onRequestPut(ctx(store, TOKEN, saveAt(100)))
    expect(res.status).toBe(409)
    expect(await res.text()).toBe(saveAt(200))
    expect(store.map.get(TOKEN)!.metadata.lastSaved).toBe(200)
  })

  test('rejects malformed tokens and bodies before touching storage', async () => {
    const store = fakeStore()
    expect((await onRequestPut(ctx(store, 'not-a-token', saveAt(1)))).status).toBe(400)
    expect((await onRequestPut(ctx(store, TOKEN, 'hello goats'))).status).toBe(400)
    expect((await onRequestPut(ctx(store, TOKEN, ''))).status).toBe(413)
    expect(store.map.size).toBe(0)
  })

  test('reads lastSaved out of a save code', () => {
    expect(lastSavedOf(saveAt(42))).toBe(42)
    expect(lastSavedOf('nope')).toBeNull()
  })
})

describe('client helpers', () => {
  test('recognises sync tokens', () => {
    expect(isSyncToken(TOKEN)).toBe(true)
    expect(isSyncToken(TOKEN.toUpperCase())).toBe(true)
    expect(isSyncToken('abc')).toBe(false)
  })

  test('prefers whichever save is newer, tolerating a missing side', () => {
    const older = createInitialState(0)
    older.lastSaved = 1
    const newer = createInitialState(0)
    newer.lastSaved = 2
    expect(newerSave(older, newer)).toBe(newer)
    expect(newerSave(newer, older)).toBe(newer)
    expect(newerSave(null, newer)).toBe(newer)
    expect(newerSave(older, null)).toBe(older)
  })

  test('pull and push map responses to results', async () => {
    const ok: typeof fetch = async () => new Response('code', { status: 200 })
    const stale: typeof fetch = async () => new Response('newer', { status: 409 })
    const down: typeof fetch = async () => {
      throw new Error('offline')
    }
    expect(await pullSave(TOKEN, ok)).toBe('code')
    expect(await pullSave(TOKEN, down)).toBeNull()
    expect(await pushSave(TOKEN, 'x', false, async () => new Response(null, { status: 204 }))).toEqual({ status: 'saved' })
    expect(await pushSave(TOKEN, 'x', false, stale)).toEqual({ status: 'stale', code: 'newer' })
    expect(await pushSave(TOKEN, 'x', false, down)).toEqual({ status: 'failed' })
  })
})
