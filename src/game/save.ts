import { ACHIEVEMENTS } from './achievements'
import { BALANCE } from './balance'
import { BUILDING_IDS } from './buildings'
import { RELICS, emptyRelics } from './relics'
import { UPGRADE_BY_ID } from './upgrades'
import { SAVE_VERSION, createInitialState, occultLevel } from './state'
import type { Buff, BuffKind, GameState, RelicId } from './types'

/** Saves older than this spent their points on occult upgrades that became relics. */
const RELIC_VERSION = 3
/** Saves older than this counted their points on the log curve rather than the root. */
const CURVE_VERSION = 4

/**
 * Achievements renamed when the occult scale was retuned. They are not all
 * re-earnable — the upgrade pool shrank — and an earned badge should stay
 * earned, so the old ids are carried across rather than dropped.
 */
const RENAMED_ACHIEVEMENTS: Record<string, string> = {
  'upgrades-100': 'upgrades-75',
  // Only one hop is followed, so the older names point at the current id too.
  'upgrades-130': 'upgrades-80',
  'upgrades-90': 'upgrades-80',
  'clicks-100000': 'clicks-50000',
  'clicks-1m': 'clicks-250000',
}

/** Highest tier each building still has, so a save from the eight-tier days can be squared up. */
const MAX_TIER = 5

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
 * Squares up a list of upgrade ids with the upgrades that currently exist.
 *
 * Building tiers were cut from eight to five, which silently deleted ids such
 * as `post-t6`. Dropping them would take back tiers the player paid for, so
 * instead each building keeps as many tiers as it had, capped at what the
 * ladder now holds: someone who had climbed seven rungs keeps all five.
 */
function repairUpgrades(saved: string[]): string[] {
  const tiersPer = new Map<string, number>()
  const kept: string[] = []

  for (const id of saved) {
    const tier = /^(.+)-t(\d+)$/.exec(id)
    if (tier) {
      tiersPer.set(tier[1], (tiersPer.get(tier[1]) ?? 0) + 1)
    } else if (UPGRADE_BY_ID.has(id)) {
      kept.push(id)
    }
  }

  for (const [building, owned] of tiersPer) {
    for (let tier = 1; tier <= Math.min(owned, MAX_TIER); tier++) {
      const id = `${building}-t${tier}`
      if (UPGRADE_BY_ID.has(id)) kept.push(id)
    }
  }
  return kept
}

/** Carries renamed achievements across and drops the ones that truly went. */
function repairAchievements(saved: string[]): string[] {
  const out = new Set<string>()
  for (const id of saved) {
    const current = RENAMED_ACHIEVEMENTS[id] ?? id
    if (ACHIEVEMENT_IDS.has(current)) out.add(current)
  }
  return [...out]
}

function relicLevels(value: unknown): Record<RelicId, number> {
  const saved = (value ?? {}) as Record<string, unknown>
  const levels = emptyRelics()
  for (const r of RELICS) levels[r.id] = Math.max(0, Math.floor(num(saved[r.id], 0)))
  return levels
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
  // Version 1 saves called the starter building a pen.
  if (savedBuildings.post === undefined) buildings.post = Math.max(0, Math.floor(num(savedBuildings.pen, 0)))

  const savedGilds = (raw.gilds ?? {}) as Record<string, unknown>
  const gilds = base.gilds
  for (const id of BUILDING_IDS) gilds[id] = Math.max(0, Math.floor(num(savedGilds[id], 0)))

  const version = num(raw.version, 1)
  const totalGoats = Math.max(0, num(raw.totalGoats, num(raw.goats, 0)))
  const lifetimeGoats = Math.max(0, num(raw.lifetimeGoats, 0))
  const occultEarned = Math.max(0, Math.floor(num(raw.occultEarned, 0)))

  // Saves from before the relics spent their points on occult upgrades that no
  // longer exist. Hand every point ever earned back rather than map fourteen
  // one-shot buys onto seven ladders: the player re-plans, nobody is short.
  const respec = version < RELIC_VERSION
  const occult = respec ? occultEarned : Math.max(0, Math.floor(num(raw.occult, 0)))

  // Points counted on an older curve can be more than the current one says
  // the goats are worth, which would leave a grandfathered save owing back the
  // difference before its next point. The credit writes that difference off,
  // once. Relic levels bought at the old prices are kept: nobody is short.
  const retuned = version < CURVE_VERSION
  const occultCredit = retuned
    ? Math.max(0, occultEarned - occultLevel(lifetimeGoats + totalGoats))
    : Math.max(0, Math.floor(num(raw.occultCredit, 0)))

  return {
    version: SAVE_VERSION,
    goats: Math.max(0, num(raw.goats, 0)),
    totalGoats,
    goatsFromClicks: Math.max(0, num(raw.goatsFromClicks, 0)),
    clicks: Math.max(0, num(raw.clicks, 0)),
    goldenClicks: Math.max(0, num(raw.goldenClicks, 0)),
    ascensions: Math.max(0, Math.floor(num(raw.ascensions, 0))),
    occult,
    occultEarned,
    lifetimeGoats,
    occultLevels: relicLevels(raw.occultLevels),
    occultCredit,
    buildings,
    gilds,
    upgrades: repairUpgrades(ids(raw.upgrades, () => true)),
    achievements: repairAchievements(ids(raw.achievements, () => true)),
    buffs: buffs(raw.buffs),
    goldenTimer: num(raw.goldenTimer, base.goldenTimer),
    playTime: Math.max(0, num(raw.playTime, 0)),
    // Whoever is loading a save has not petted anything for a while, so the
    // herd is already idle — which is what makes time away pay the idle rate.
    sincePet: BALANCE.idleSeconds,
    idlePets: 0,
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

/** What the herd produced while the tab was closed, at the idle rate it was already earning. */
export function offlineGain(
  gps: number,
  elapsedSeconds: number,
  rate = OFFLINE_RATE,
  capSeconds = OFFLINE_CAP_SECONDS,
): { seconds: number; goats: number } {
  const seconds = Math.min(Math.max(elapsedSeconds, 0), capSeconds)
  return { seconds, goats: gps * seconds * Math.min(rate, 1) }
}
