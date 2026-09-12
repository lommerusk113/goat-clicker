import type { GameState } from './game/types'

/** Where the browser remembers which sync code it is linked to. */
export const SYNC_KEY = 'goatclicker.sync'
/** Where the browser remembers the `lastSaved` of the cloud save it last wrote or adopted. */
export const SEEN_KEY = 'goatclicker.sync.seen'

const TOKEN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/

export function isSyncToken(text: string): boolean {
  return TOKEN.test(text.trim().toLowerCase())
}

export function newSyncToken(): string {
  return crypto.randomUUID()
}

export function loadSyncToken(storage: Storage): string | null {
  const token = storage.getItem(SYNC_KEY)
  return token && isSyncToken(token) ? token : null
}

export function storeSyncToken(storage: Storage, token: string | null): void {
  if (token === null) storage.removeItem(SYNC_KEY)
  else storage.setItem(SYNC_KEY, token)
}

function url(token: string): string {
  return `/api/save/${token}`
}

/** The save code stored for this token, or null when there is none or the network failed. */
export async function pullSave(token: string, fetchFn: typeof fetch = fetch): Promise<string | null> {
  try {
    const res = await fetchFn(url(token), { cache: 'no-store' })
    return res.ok ? await res.text() : null
  } catch {
    return null
  }
}

export type PushResult =
  | { status: 'saved' }
  /** The cloud holds a newer save; here it is. */
  | { status: 'stale'; code: string }
  | { status: 'failed' }

/**
 * Uploads a save code. `base` is the `lastSaved` of the cloud save this device
 * last saw; the server refuses the write if another device has stored something
 * newer since. `keepalive` lets the request outlive a closing tab.
 */
export async function pushSave(
  token: string,
  code: string,
  base: number,
  keepalive = false,
  fetchFn: typeof fetch = fetch,
): Promise<PushResult> {
  try {
    const res = await fetchFn(url(token), { method: 'PUT', body: code, keepalive, headers: { 'x-base-saved': String(base) } })
    if (res.status === 409) return { status: 'stale', code: await res.text() }
    return res.ok ? { status: 'saved' } : { status: 'failed' }
  } catch {
    return { status: 'failed' }
  }
}

/** What a browser should do with the save code the cloud just handed it. */
export type CloudVerdict =
  /** Nothing this browser has not already seen. */
  | 'ignore'
  /** A herd worth playing: take it. */
  | 'adopt'
  /** An older copy of the herd being played: keep playing, and let the next push replace it. */
  | 'overwrite'

/**
 * Every goat a save has ever counted. Ascension rolls `totalGoats` into
 * `lifetimeGoats`, so the sum only ever grows and two saves of one herd can be
 * ordered by it.
 */
function goatsEver(state: GameState): number {
  return state.lifetimeGoats + state.totalGoats
}

/**
 * Decides what to do with a cloud save. `seen` is the `lastSaved` this browser
 * last recorded for the cloud copy.
 *
 * Beating `seen` makes a save news, but news is not always progress. When a
 * push's acknowledgement never lands the watermark stays behind a save this
 * very browser wrote, and the cloud then offers back a copy of the herd from
 * before whatever happened since — an ascension, most visibly. Neither measure
 * here ever falls while a herd is played, so a save behind on either is an
 * older copy of it and is refused.
 *
 * A save that started on a different day is a different herd rather than an
 * older copy of this one — a sold farm, or the herd behind a freshly entered
 * sync code — and there the newer save wins, which is what lets selling the
 * farm reach every device.
 */
export function cloudVerdict(remote: GameState, local: GameState, seen: number): CloudVerdict {
  if (remote.lastSaved <= seen) return 'ignore'
  if (remote.startedAt !== local.startedAt) return 'adopt'
  const behind = remote.occultEarned < local.occultEarned || goatsEver(remote) < goatsEver(local)
  return behind ? 'overwrite' : 'adopt'
}
