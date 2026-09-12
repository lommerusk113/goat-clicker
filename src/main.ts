import './style.css'

import { BUILDING_BY_ID } from './game/buildings'
import { baseGoatsPerSecond, computeStats, multipliers } from './game/economy'
import { goldenLifetime, nextGoldenDelay, rollGolden } from './game/golden'
import { startLoop } from './game/loop'
import type { GameState } from './game/types'
import {
  OFFLINE_CAP_SECONDS,
  OFFLINE_RATE,
  clearGame,
  decodeSave,
  encodeSave,
  loadGame,
  offlineGain,
  saveGame,
} from './game/save'
import {
  addBuff,
  ascend,
  buyRelic,
  moveGild,
  rerollGild,
  buyBuilding as purchaseBuilding,
  buyUpgrade as purchaseUpgrade,
  claimAchievements,
  createInitialState,
  earn,
  petGoat,
  produce,
  tickBuffs,
} from './game/state'
import { SEEN_KEY, cloudVerdict, isSyncToken, loadSyncToken, newSyncToken, pullSave, pushSave, storeSyncToken } from './sync'
import { formatGoats } from './ui/format'
import { createUi } from './ui/render'

const AUTOSAVE_SECONDS = 10
/**
 * Cloud writes are far rarer than local ones. The save is tiny, but the whole
 * game shares one metered daily write budget, so a tab left open all day has to
 * cost a few dozen writes rather than a few hundred.
 */
const CLOUD_SAVE_SECONDS = 600
/**
 * No two cloud writes closer together than this, whoever asks. Hiding the tab
 * pushes as well, and without a floor a player flicking between tabs would
 * spend the day's budget on their own herd.
 */
const CLOUD_MIN_SECONDS = 300
const PANEL_REFRESH_SECONDS = 0.2
/** Rough frame time, used only to pace panel refreshes. */
const FRAME_ESTIMATE_SECONDS = 1 / 60
/** Time away below this is not worth a "welcome back" panel. */
const WELCOME_THRESHOLD_SECONDS = 30

const saved = loadGame(localStorage)
let state = saved ?? createInitialState(Date.now())

interface Welcome {
  /** Seconds since the save was written. */
  away: number
  /** Seconds actually paid for, after the offline cap. */
  paid: number
  goats: number
}

/** Pays out for the time since the save was written. Returns the payout when it was worth mentioning. */
function payOfflineTime(loaded: GameState): Welcome | null {
  const away = (Date.now() - loaded.lastSaved) / 1000
  // A loaded save is already idle, so this rate carries the Hourglass with it.
  const gain = offlineGain(baseGoatsPerSecond(loaded), away, OFFLINE_RATE, OFFLINE_CAP_SECONDS)
  if (gain.goats < 1 || gain.seconds < WELCOME_THRESHOLD_SECONDS) return null
  earn(loaded, gain.goats)
  return { away, paid: gain.seconds, goats: gain.goats }
}

// Pay out for the time the tab was closed before anything else touches state.
const welcomeBack = saved ? payOfflineTime(state) : null

// --- cloud sync ---------------------------------------------------------------
let syncToken = loadSyncToken(localStorage)
/**
 * `lastSaved` of the cloud save this browser last wrote or adopted. Every open
 * tab bumps its own `lastSaved` every few seconds, so that cannot tell whose
 * save is newer; a cloud save is only news when it is newer than this.
 */
let cloudSeen = Number(localStorage.getItem(SEEN_KEY)) || 0

function markSeen(lastSaved: number): void {
  cloudSeen = lastSaved
  localStorage.setItem(SEEN_KEY, String(lastSaved))
}

interface Adoption {
  /** Swap the save in without announcing it. */
  quiet?: boolean
  /** The player asked for this herd by name, so take it even if it is behind. */
  deliberate?: boolean
}

/** Swaps in a save from the cloud when another device has got further than this one. */
function adoptCloudSave(code: string, { quiet = false, deliberate = false }: Adoption = {}): boolean {
  const remote = decodeSave(code)
  if (!remote) return false
  const verdict = deliberate ? 'adopt' : cloudVerdict(remote, state, cloudSeen)
  if (verdict === 'ignore') return false
  // Seen either way. Recording it lets the next push land instead of bouncing
  // off the same stored save every time.
  markSeen(remote.lastSaved)
  if (verdict === 'overwrite') return false
  state = remote
  const gain = payOfflineTime(state)
  saveGame(state, localStorage, Date.now())
  refreshPanels()
  if (quiet) return true
  ui.toast({ icon: '☁️', kind: 'Cloud', name: 'Save loaded', desc: 'A newer herd came in from the cloud.' })
  if (gain) ui.welcome(gain)
  return true
}

async function pullCloud(quiet = false): Promise<void> {
  if (!syncToken) return
  const code = await pullSave(syncToken)
  if (code) adoptCloudSave(code, { quiet })
}

interface Push {
  /** Let the request outlive a closing tab. */
  keepalive?: boolean
  /** The cloud save this push claims to have seen, instead of the one this browser recorded. */
  base?: number
  /** Write now whatever the last write cost; for the handful the player asked for. */
  force?: boolean
}

/** When the last cloud write went out, so the metered ones can be spaced. */
let lastPush = 0

/** Uploads this herd unless another device has got further since `base`; then that herd is adopted instead. */
async function pushCloud({ keepalive = false, base = cloudSeen, force = false }: Push = {}): Promise<void> {
  if (!syncToken) return
  const now = Date.now()
  if (!force && now - lastPush < CLOUD_MIN_SECONDS * 1000) return
  lastPush = now

  const lastSaved = state.lastSaved
  // A keepalive push outlives the page, so its reply usually lands nowhere. The
  // write itself goes out all the same, and a watermark left behind is exactly
  // what makes the cloud offer this browser its own stale save back later, so
  // record it up front rather than awaiting an acknowledgement that will not come.
  if (keepalive) markSeen(lastSaved)
  const result = await pushSave(syncToken, encodeSave(state), base, keepalive)
  if (result.status === 'saved') markSeen(lastSaved)
  else if (result.status === 'stale') adoptCloudSave(result.code, { quiet: true })
}

const ui = createUi({
  pet: () => petGoat(state),

  buyBuilding(id, count) {
    if (purchaseBuilding(state, id, count)) refreshPanels()
  },

  buyUpgrade(id) {
    if (purchaseUpgrade(state, id)) refreshPanels()
  },

  buyRelic(id, count) {
    if (buyRelic(state, id, count) > 0) refreshPanels()
  },

  ascend() {
    const sure = window.confirm(
      'Give up the farm? Every goat, building and ordinary upgrade goes. You keep your achievements, your relics, and gain occult points that boost every future herd.',
    )
    if (!sure) return
    const result = ascend(state)
    if (result.occult <= 0) return
    saveGame(state, localStorage, Date.now())
    // Ascensions are rare and are the one moment worth a write of its own: it
    // is the herd the other devices most need, and the one a stale cloud copy
    // would most visibly undo.
    void pushCloud({ force: true })
    refreshPanels()
    const gilded = result.gilded.map((id) => `${BUILDING_BY_ID[id].icon} ${BUILDING_BY_ID[id].name}`)
    ui.toast({
      icon: '🕯️',
      kind: 'Ascended',
      name: `+${result.occult.toLocaleString('en-US')} occult`,
      desc: gilded.length > 0 ? `Gilded: ${gilded.join(', ')}. Fresh pasture awaits.` : 'Fresh pasture. The old herd remembers you.',
    })
  },

  moveGild(from, to) {
    if (moveGild(state, from, to)) {
      refreshPanels()
      ui.toast({ icon: '✨', kind: 'Gild moved', name: BUILDING_BY_ID[to].name, desc: 'Placed exactly where you wanted it.' })
    }
  },

  rerollGild(from) {
    const to = rerollGild(state, from)
    if (!to) return
    refreshPanels()
    const def = BUILDING_BY_ID[to]
    ui.toast({ icon: def.icon, kind: 'Gild rerolled', name: def.name, desc: 'The gild wandered off and settled here.' })
  },

  saveNow() {
    saveGame(state, localStorage, Date.now())
    ui.status('Saved.')
  },

  exportSave() {
    const code = encodeSave(state)
    navigator.clipboard?.writeText(code).then(
      () => ui.status('Save code copied to your clipboard.'),
      () => ui.status('Could not reach the clipboard. The code is in the box below.'),
    )
    const box = document.getElementById('import-box') as HTMLTextAreaElement | null
    if (box) box.value = code
  },

  importSave(code) {
    const next = decodeSave(code)
    if (!next) {
      ui.status('That is not a save code.')
      return
    }
    state = next
    saveGame(state, localStorage, Date.now())
    refreshPanels()
    ui.status('Save loaded.')
  },

  wipeSave() {
    const sure = window.confirm(
      syncToken
        ? 'Sell the farm? Every goat, building, upgrade and occult point goes, here and on every device sharing this sync code. Turn off cloud sync first to reset only this browser.'
        : 'Sell the farm? Every goat, building and upgrade goes, and there is no getting them back.',
    )
    if (!sure) return
    clearGame(localStorage)
    state = createInitialState(Date.now())
    // The fresh save is the newest, so pushing it now sells the cloud herd too
    // and every other device adopts the empty pasture on its next save.
    saveGame(state, localStorage, Date.now())
    refreshPanels()
    if (syncToken) {
      // Selling outranks whatever another device saved meanwhile, so push as if we had just seen it.
      void pushCloud({ base: Date.now(), force: true }).then(() => ui.status('Farm sold, here and in the cloud. Fresh pasture, one goat at a time.'))
    } else {
      ui.status('Farm sold. Fresh pasture, one goat at a time.')
    }
  },

  enableSync() {
    syncToken = newSyncToken()
    storeSyncToken(localStorage, syncToken)
    markSeen(0)
    saveGame(state, localStorage, Date.now())
    ui.sync(syncToken)
    pushCloud({ force: true }).then(() => ui.status('Cloud sync is on. Enter this code on another device to share the herd.'))
  },

  async linkSync(code) {
    const token = code.trim().toLowerCase()
    if (!isSyncToken(token)) {
      ui.status('That is not a sync code.')
      return
    }
    syncToken = token
    storeSyncToken(localStorage, token)
    // The code names a herd that already exists somewhere; linking means joining it.
    markSeen(0)
    ui.sync(token)
    const remote = await pullSave(token)
    if (remote && adoptCloudSave(remote, { quiet: true, deliberate: true })) {
      ui.status('Linked. You are now playing the cloud herd.')
    } else {
      saveGame(state, localStorage, Date.now())
      await pushCloud({ force: true })
      ui.status('Linked. This herd is now the cloud herd.')
    }
  },

  disableSync() {
    syncToken = null
    storeSyncToken(localStorage, null)
    markSeen(0)
    ui.sync(null)
    ui.status('Cloud sync is off. The cloud copy stays where it is.')
  },
})

function refreshPanels(): void {
  ui.slow(state, computeStats(state))
}

function spawnGolden(): void {
  const m = multipliers(state)
  state.goldenTimer = nextGoldenDelay(m)

  ui.showGolden(goldenLifetime(m), () => {
    const reward = rollGolden(state)
    state.goldenClicks += 1
    if (reward.goats > 0) earn(state, reward.goats)
    if (reward.buff) addBuff(state, reward.buff)

    ui.toast({
      icon: reward.buff?.icon ?? '🍀',
      kind: 'Golden goat',
      name: reward.name,
      desc: reward.goats > 0 ? `${formatGoats(reward.goats)} goats, on the spot.` : reward.note,
    })
    refreshPanels()

    return reward.goats > 0 ? `+${formatGoats(reward.goats)}` : reward.name
  })
}

let sinceSave = 0
let sinceCloud = 0
let sincePanels = 0

startLoop({
  // Simulation. Driven by a timer against the wall clock, so the herd keeps
  // working while the tab sits in the background.
  tick(dt) {
    state.playTime += dt
    produce(state, dt)

    for (const buff of tickBuffs(state, dt)) {
      ui.toast({
        icon: buff.icon,
        kind: 'Wore off',
        name: buff.name,
        desc: 'Back to the usual pace.',
      })
    }

    // A golden goat nobody can see is a wasted one, so the timer waits at zero
    // until the tab is back in view.
    if (state.goldenTimer > 0) state.goldenTimer -= dt
    else if (!document.hidden) spawnGolden()

    for (const earned of claimAchievements(state)) {
      ui.toast({ icon: earned.icon, kind: 'Achievement', name: earned.name, desc: earned.desc })
    }

    sinceSave += dt
    if (sinceSave >= AUTOSAVE_SECONDS) {
      sinceSave = 0
      saveGame(state, localStorage, Date.now())
    }

    sinceCloud += dt
    if (sinceCloud >= CLOUD_SAVE_SECONDS) {
      sinceCloud = 0
      void pushCloud()
    }
  },

  // Drawing. Paused by the browser whenever nothing is on screen.
  render() {
    const stats = computeStats(state)
    ui.fast(state, stats)

    sincePanels += FRAME_ESTIMATE_SECONDS
    if (sincePanels >= PANEL_REFRESH_SECONDS) {
      sincePanels = 0
      ui.slow(state, stats)
    }
  },
})

// Saving on the way out means a closed tab is paid as offline time. Coming back
// asks the cloud what the other devices did meanwhile.
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) {
    void pullCloud()
    return
  }
  saveGame(state, localStorage, Date.now())
  void pushCloud({ keepalive: true })
})

window.addEventListener('pagehide', () => {
  saveGame(state, localStorage, Date.now())
  void pushCloud({ keepalive: true })
})

refreshPanels()
ui.sync(syncToken)
if (welcomeBack) ui.welcome(welcomeBack)
void pullCloud()
