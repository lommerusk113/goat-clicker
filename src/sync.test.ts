import { describe, expect, test } from 'vitest'
import { lastSavedOf, onRequestGet, onRequestPut } from '../functions/api/save/[token]'
import type { Context } from '../functions/api/save/[token]'
import { encodeSave } from './game/save'
import { createInitialState } from './game/state'
import { isSyncToken, pullSave, pushSave } from './sync'

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

function ctx(store: ReturnType<typeof fakeStore>, token: string, body?: string, base?: number): Context {
  const headers = base === undefined ? undefined : { 'x-base-saved': String(base) }
  return {
    request: new Request('https://goat.test/api/save/x', body === undefined ? undefined : { method: 'PUT', body, headers }),
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

  test('refuses a write from a device that has not seen the stored save', async () => {
    const store = fakeStore()
    await onRequestPut(ctx(store, TOKEN, saveAt(200), 0))
    // Another device last saw the cloud at 100, so its save is newer only by its own clock.
    const res = await onRequestPut(ctx(store, TOKEN, saveAt(300), 100))
    expect(res.status).toBe(409)
    expect(await res.text()).toBe(saveAt(200))
    expect(store.map.get(TOKEN)!.metadata.lastSaved).toBe(200)
  })

  test('accepts a write from a device that has seen the stored save', async () => {
    const store = fakeStore()
    await onRequestPut(ctx(store, TOKEN, saveAt(200), 0))
    expect((await onRequestPut(ctx(store, TOKEN, saveAt(300), 200))).status).toBe(204)
    expect(store.map.get(TOKEN)!.metadata.lastSaved).toBe(300)
  })

  test('falls back to comparing lastSaved when no base is sent', async () => {
    const store = fakeStore()
    await onRequestPut(ctx(store, TOKEN, saveAt(200)))
    expect((await onRequestPut(ctx(store, TOKEN, saveAt(100)))).status).toBe(409)
    expect((await onRequestPut(ctx(store, TOKEN, saveAt(300)))).status).toBe(204)
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

  test('pull and push map responses to results', async () => {
    const ok: typeof fetch = async () => new Response('code', { status: 200 })
    const stale: typeof fetch = async () => new Response('newer', { status: 409 })
    const down: typeof fetch = async () => {
      throw new Error('offline')
    }
    expect(await pullSave(TOKEN, ok)).toBe('code')
    expect(await pullSave(TOKEN, down)).toBeNull()
    expect(await pushSave(TOKEN, 'x', 0, false, async () => new Response(null, { status: 204 }))).toEqual({ status: 'saved' })
    expect(await pushSave(TOKEN, 'x', 0, false, stale)).toEqual({ status: 'stale', code: 'newer' })
    expect(await pushSave(TOKEN, 'x', 0, false, down)).toEqual({ status: 'failed' })
  })

  test('push tells the server which cloud save it last saw', async () => {
    let seen: string | null = null
    const spy: typeof fetch = async (_url, init) => {
      seen = new Headers(init?.headers).get('x-base-saved')
      return new Response(null, { status: 204 })
    }
    await pushSave(TOKEN, 'x', 4200, false, spy)
    expect(seen).toBe('4200')
  })
})
