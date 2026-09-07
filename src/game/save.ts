import { ACHIEVEMENTS } from './achievements'
import { BUILDING_IDS } from './buildings'
import { UPGRADE_BY_ID } from './upgrades'
import { SAVE_VERSION, createInitialState } from './state'
import type { Buff, BuffKind, GameState } from './types'

export const SAVE_KEY = 'goatclicker.save'

/** Share of production earned while the tab is closed. */
export const OFFLINE_RATE = 0.5
/** Time away stops counting after this long. */
export const OFFLINE_CAP_SECONDS = 3 * 60 * 60

const ACHIEVEMENT_IDS = new Set(ACHIEVEMENTS.map((a) => a.id))

function toBase64(text: string): string {
  const bytes = new TextEncoder().encode(text)
  let binary = ''
  for (const b of bytes) binary += String.fromCharCode(b)
  return btoa(binary)
}

function fromBase64(text: string): string {
  const binary = atob(text)
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0))
  return new TextDecoder().decode(bytes)
}

export function encodeSave(state: GameState): string {
  return toBase64(JSON.stringify(state))
}

function num(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function ids(value: unknown, known: (id: string) => boolean): string[] {
  if (!Array.isArray(value)) return []
  return value.filter((v): v is string => typeof v === 'string' && known(v))
}

const BUFF_KINDS: BuffKind[] = ['gpsMult', 'clickMult']

function buffs(value: unknown): Buff[] {
  if (!Array.isArray(value)) return []
  return value.flatMap((raw): Buff[] => {
    if (typeof raw !== 'object' || raw === null) return []
    const b = raw as Record<string, unknown>
    if (typeof b.id !== 'string') return []
    if (!BUFF_KINDS.includes(b.kind as BuffKind)) return []
    const remaining = num(b.remaining, 0)
    if (remaining <= 0) return []
    return [
      {
        id: b.id,
        name: typeof b.name === 'string' ? b.name : b.id,
        icon: typeof b.icon === 'string' ? b.icon : '✨',
        kind: b.kind as BuffKind,
        factor: num(b.factor, 1),
        remaining,
        duration: num(b.duration, remaining),
      },
    ]
  })
}

/**
 * Rebuilds a full state from whatever a save happens to contain, so an older
 * or hand-edited save loads instead of breaking the game.
 */
function migrate(raw: Record<string, unknown>): GameState {
  const base = createInitialState(num(raw.startedAt, 0))
  const savedBuildings = (raw.buildings ?? {}) as Record<string, unknown>

  const buildings = base.buildings
  for (const id of BUILDING_IDS) buildings[id] = Math.max(0, Math.floor(num(savedBuildings[id], 0)))

  return {
    version: SAVE_VERSION,
    goats: Math.max(0, num(raw.goats, 0)),
    totalGoats: Math.max(0, num(raw.totalGoats, num(raw.goats, 0))),
    goatsFromClicks: Math.max(0, num(raw.goatsFromClicks, 0)),
    clicks: Math.max(0, num(raw.clicks, 0)),
    goldenClicks: Math.max(0, num(raw.goldenClicks, 0)),
    buildings,
    upgrades: ids(raw.upgrades, (id) => UPGRADE_BY_ID.has(id)),
    achievements: ids(raw.achievements, (id) => ACHIEVEMENT_IDS.has(id)),
    buffs: buffs(raw.buffs),
    goldenTimer: num(raw.goldenTimer, base.goldenTimer),
    playTime: Math.max(0, num(raw.playTime, 0)),
    startedAt: num(raw.startedAt, 0),
    lastSaved: num(raw.lastSaved, num(raw.startedAt, 0)),
  }
}

/** Returns null for anything that is not a readable save. */
export function decodeSave(text: string): GameState | null {
  try {
    const raw = JSON.parse(fromBase64(text.trim())) as unknown
    if (typeof raw !== 'object' || raw === null) return null
    const rec = raw as Record<string, unknown>
    if (typeof rec.version !== 'number' || typeof rec.goats !== 'number') return null
    return migrate(rec)
  } catch {
    return null
  }
}

export function saveGame(state: GameState, storage: Storage, now: number): void {
  state.lastSaved = now
  storage.setItem(SAVE_KEY, encodeSave(state))
}

export function loadGame(storage: Storage): GameState | null {
  const raw = storage.getItem(SAVE_KEY)
  return raw === null ? null : decodeSave(raw)
}

export function clearGame(storage: Storage): void {
  storage.removeItem(SAVE_KEY)
}

/** What the herd produced while the tab was closed. */
export function offlineGain(gps: number, elapsedSeconds: number): {
  seconds: number
  goats: number
} {
  const seconds = Math.min(Math.max(elapsedSeconds, 0), OFFLINE_CAP_SECONDS)
  return { seconds, goats: gps * seconds * OFFLINE_RATE }
}
