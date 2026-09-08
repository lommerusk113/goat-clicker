export type BuildingId =
  | 'post'
  | 'meadow'
  | 'barn'
  | 'dairy'
  | 'yoga'
  | 'ranch'
  | 'lab'
  | 'portal'
  | 'temple'
  | 'cosmos'
  | 'circle'
  | 'void'
  | 'elder'

export interface BuildingDef {
  id: BuildingId
  name: string
  icon: string
  baseCost: number
  baseCps: number
  /** Flat goats each unit adds to every manual click. */
  baseClick?: number
  /** Flavour text shown in the tooltip. */
  blurb: string
}

export type UpgradeKind = 'building' | 'click' | 'golden' | 'global' | 'occult'

export type Effect =
  /** Multiplies one building's output. */
  | { type: 'buildingMult'; building: BuildingId; factor: number }
  /** Adds flat goats to every manual click. */
  | { type: 'clickFlat'; amount: number }
  /** Multiplies manual click output. */
  | { type: 'clickMult'; factor: number }
  /** Adds a percentage of goats-per-second to every manual click. */
  | { type: 'clickFromCps'; percent: number }
  /** Multiplies all production. */
  | { type: 'globalMult'; factor: number }
  /** Multiplies all production by 1 + percent per achievement earned. */
  | { type: 'globalPerAchievement'; percent: number }
  /** Multiplies how often golden goats wander in. */
  | { type: 'goldenFreq'; factor: number }
  /** Multiplies how long golden goats stay. */
  | { type: 'goldenLife'; factor: number }
  /** Multiplies golden goat rewards. */
  | { type: 'goldenPower'; factor: number }
  /** Adds to the production percentage each occult point grants. */
  | { type: 'occultPercent'; percent: number }
  /** Multiplies the share of production earned while the tab is closed. */
  | { type: 'offlineRate'; factor: number }
  /** Multiplies how long time away keeps counting. */
  | { type: 'offlineCap'; factor: number }
  /** Goats the herd starts each ascension with. */
  | { type: 'startGoats'; amount: number }

export interface UpgradeDef {
  id: string
  name: string
  icon: string
  cost: number
  /** What it does, in mechanical terms. */
  desc: string
  /** Flavour text. */
  blurb: string
  kind: UpgradeKind
  /** Occult upgrades: id of the upgrade that must be owned first. */
  requires?: string
  building?: BuildingId
  /** Which of a building's upgrade tiers this is, 1-based. */
  tier?: number
  effect: Effect
  /** True when the upgrade should appear in the store. */
  unlocked: (state: GameState) => boolean
}

export interface AchievementDef {
  id: string
  name: string
  icon: string
  desc: string
  earned: (state: GameState) => boolean
}

export type BuffKind = 'gpsMult' | 'clickMult'

export interface Buff {
  id: string
  name: string
  icon: string
  kind: BuffKind
  factor: number
  /** Seconds left. Counted down by the game loop, so saves survive reloads. */
  remaining: number
  /** Seconds the buff started with, for drawing the timer bar. */
  duration: number
}

export interface GameState {
  version: number
  /** Goats in the herd right now. */
  goats: number
  /** Every goat ever herded, all-time. */
  totalGoats: number
  goatsFromClicks: number
  clicks: number
  goldenClicks: number
  /** Times the farm has been given up for occult points. */
  ascensions: number
  /** Occult points not yet spent. Each one boosts production, so spending is a trade. */
  occult: number
  /** Occult points ever earned, for achievements. */
  occultEarned: number
  /** Goats herded in every finished run before this one. */
  lifetimeGoats: number
  buildings: Record<BuildingId, number>
  /** Gilds on each building. One is handed out per ascension and they never reset. */
  gilds: Record<BuildingId, number>
  /** Bought upgrades. Occult ones survive ascension, the rest do not. */
  upgrades: string[]
  achievements: string[]
  buffs: Buff[]
  /** Seconds until the next golden goat wanders in. */
  goldenTimer: number
  /** Seconds of play, accumulated. */
  playTime: number
  startedAt: number
  lastSaved: number
}

export interface Stats {
  /** Goats per second, buffs included. */
  gps: number
  /** Goats per second before buffs — what the click bonus is based on. */
  gpsBase: number
  perClick: number
  /** Output of each building line, buffs included. */
  byBuilding: Record<BuildingId, number>
  globalMult: number
  buildingsOwned: number
}
