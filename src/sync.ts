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
