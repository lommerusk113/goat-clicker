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

export type UpgradeKind = 'building' | 'click' | 'golden' | 'global'

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
  building?: BuildingId
  /** Which of a building's upgrade tiers this is, 1-based. */
  tier?: number
  effect: Effect
  /** True when the upgrade should appear in the store. */
  unlocked: (state: GameState) => boolean
}

export type RelicId =
  | 'candle'
  | 'sigil'
  | 'grimoire'
  | 'ashes'
  | 'lantern'
  | 'hourglass'
  | 'crown'

export interface RelicDef {
  id: RelicId
  name: string
  icon: string
  /**
   * Occult points for the first level. Level L costs this times L, so reaching
   * level N costs `costStep * N * (N + 1) / 2`.
   */
  costStep: number
  /** What one more level buys, in mechanical terms. */
  desc: string
  /** Flavour text. */
  blurb: string
  /** Folds `level` levels of this relic into the running multipliers. */
  apply(m: Multipliers, level: number): void
  /** What the relic is doing at `level` right now, for the tooltip. */
  summary(level: number): string
}

/** Everything the player's upgrades, relics and gilds add up to. */
export interface Multipliers {
  /** Per-building output factor: tiers, milestones and gilds together. */
  building: Record<BuildingId, number>
  /**
   * Per-building factor from tier upgrades and gilds only. Click bonuses use
   * this, so milestones cannot turn a heavy clicker into a runaway; simulated
   * with milestones included, a click-only player finished 6,000x ahead.
   */
  buildingClick: Record<BuildingId, number>
  global: number
  clickFlat: number
  clickMult: number
  clickCpsPercent: number
  goldenFreq: number
  goldenLife: number
  goldenPower: number
  /** Production bonus per unspent occult point, in percent. */
  occultPercent: number
  /** Production multiplier that applies only while the herd is left alone. */
  idle: number
  /** Extra output each gild grants, as a fraction. */
  gildBonus: number
  startGoats: number
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
  /** Level of each occult relic. Levelled with occult points, never reset. */
  occultLevels: Record<RelicId, number>
  /**
   * Occult points granted beyond what the goat curve says they are worth, set
   * once when a save from an older, more generous curve is migrated. Without it
   * a grandfathered player owes back every point the retuning took away before
   * the next one arrives.
   */
  occultCredit: number
  /** Goats bought upgrades. All of them go on ascension. */
  upgrades: string[]
  achievements: string[]
  buffs: Buff[]
  /** Seconds until the next golden goat wanders in. */
  goldenTimer: number
  /** Seconds of play, accumulated. */
  playTime: number
  /** Seconds since the goat was last petted. Past `BALANCE.idleSeconds` the herd is idle. Not saved. */
  sincePet: number
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
  /** Extra output each gild is granting, as a fraction. */
  gildBonus: number
  buildingsOwned: number
  /** Multiplier the idle relics are paying right now: 1 when the herd is not idle. */
  idleMult: number
  /** Seconds until the herd counts as idle, or 0 once it does. */
  idleIn: number
}
