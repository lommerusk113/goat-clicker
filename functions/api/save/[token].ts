/**
 * Cloud save endpoint, deployed with the site as a Cloudflare Pages Function.
 * One save blob per sync token. A client says which cloud save it last saw
 * (`x-base-saved`, the `lastSaved` of that save); a write is refused when
 * another device has stored something newer since, so the client adopts that
 * instead of clobbering it. Without the header the save's own `lastSaved` is
 * compared, which only guards against a device that has been offline.
 */

/** The slice of Cloudflare's KVNamespace this file uses; keeps workers-types out of the build. */
interface SaveStore {
  getWithMetadata(key: string): Promise<{ value: string | null; metadata: SaveMeta | null }>
  put(key: string, value: string, options?: { metadata?: SaveMeta }): Promise<void>
}

interface SaveMeta {
  lastSaved: number
}

interface Env {
  SAVES: SaveStore
}

export interface Context {
  request: Request
  env: Env
  params: Record<string, string | string[]>
}

/** Tokens are client-generated UUIDs; anything else is refused before touching storage. */
const TOKEN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
/** A save is a couple of kilobytes; this is a generous ceiling. */
const MAX_BYTES = 64 * 1024

const HEADERS = { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' }

function reply(status: number, body = ''): Response {
  return new Response(body === '' ? null : body, { status, headers: HEADERS })
}

function tokenOf(params: Context['params']): string | null {
  const raw = params.token
  const token = Array.isArray(raw) ? raw[0] : raw
  return typeof token === 'string' && TOKEN.test(token) ? token : null
}

/** Reads `lastSaved` out of a base64 save code without trusting anything else in it. */
export function lastSavedOf(code: string): number | null {
  try {
    const parsed = JSON.parse(atob(code)) as { lastSaved?: unknown }
    return typeof parsed.lastSaved === 'number' && Number.isFinite(parsed.lastSaved) ? parsed.lastSaved : null
  } catch {
    return null
  }
}

export const onRequestGet = async ({ env, params }: Context): Promise<Response> => {
  const token = tokenOf(params)
  if (!token) return reply(400, 'bad token')
  const { value } = await env.SAVES.getWithMetadata(token)
  return value === null ? reply(404) : reply(200, value)
}

export const onRequestPut = async ({ request, env, params }: Context): Promise<Response> => {
  const token = tokenOf(params)
  if (!token) return reply(400, 'bad token')

  const code = (await request.text()).trim()
  if (code.length === 0 || code.length > MAX_BYTES) return reply(413, 'bad size')
  const lastSaved = lastSavedOf(code)
  if (lastSaved === null) return reply(400, 'not a save')

  const base = Number(request.headers.get('x-base-saved') ?? NaN)
  const seen = Number.isFinite(base) ? base : lastSaved
  const current = await env.SAVES.getWithMetadata(token)
  if (current.value !== null && current.metadata && current.metadata.lastSaved > seen) {
    // Another device stored a newer save since this one last looked: hand it back.
    return reply(409, current.value)
  }

  await env.SAVES.put(token, code, { metadata: { lastSaved } })
  return reply(204)
}
