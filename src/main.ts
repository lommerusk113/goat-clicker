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
import { isSyncToken, loadSyncToken, newSyncToken, pullSave, pushSave, storeSyncToken } from './sync'
import { formatGoats } from './ui/format'
import { createUi } from './ui/render'

const AUTOSAVE_SECONDS = 10
/** Cloud writes are rarer than local ones; the save is tiny but KV writes are metered. */
const CLOUD_SAVE_SECONDS = 60
const PANEL_REFRESH_SECONDS = 0.2
/** Rough frame time, used only to pace panel refreshes. */
const FRAME_ESTIMATE_SECONDS = 1 / 60
/** Time away below this is not worth a "welcome back" panel. */
const WELCOME_THRESHOLD_SECONDS = 30

const saved = loadGame(localStorage)
let state = saved ?? createInitialState(Date.now())

/** Pays out for the time since the save was written. Returns the payout when it was worth mentioning. */
function payOfflineTime(loaded: GameState): { seconds: number; goats: number } | null {
  const away = (Date.now() - loaded.lastSaved) / 1000
  const m = multipliers(loaded)
  const gain = offlineGain(
    baseGoatsPerSecond(loaded, m),
    away,
    OFFLINE_RATE * m.offlineRate,
    OFFLINE_CAP_SECONDS * m.offlineCap,
  )
  if (gain.goats < 1 || gain.seconds < WELCOME_THRESHOLD_SECONDS) return null
  earn(loaded, gain.goats)
  return gain
}

// Pay out for the time the tab was closed before anything else touches state.
const welcomeBack = saved ? payOfflineTime(state) : null

// --- cloud sync ---------------------------------------------------------------
let syncToken = loadSyncToken(localStorage)
/** Cloud writes wait until the first pull has had its say, so a stale device cannot overwrite a newer save. */
let cloudReady = syncToken === null

/** Swaps in a save from the cloud when it is newer than what this browser had. */
function adoptCloudSave(code: string, quiet = false): boolean {
  const remote = decodeSave(code)
  if (!remote || remote.lastSaved <= state.lastSaved) return false
  state = remote
  const gain = payOfflineTime(state)
  saveGame(state, localStorage, Date.now())
  refreshPanels()
  if (!quiet) ui.toast({ icon: '☁️', kind: 'Cloud', name: 'Save loaded', desc: 'A newer herd came in from the cloud.' })
  if (gain) ui.welcome(gain.seconds, gain.goats)
  return true
}

async function pullCloud(): Promise<void> {
  if (!syncToken) return
  const code = await pullSave(syncToken)
  if (code) adoptCloudSave(code, true)
  cloudReady = true
}

async function pushCloud(keepalive = false): Promise<void> {
  if (!syncToken || !cloudReady) return
  const result = await pushSave(syncToken, encodeSave(state), keepalive)
  if (result.status === 'stale') adoptCloudSave(result.code)
}

const ui = createUi({
  pet: () => petGoat(state),

  buyBuilding(id, count) {
    if (purchaseBuilding(state, id, count)) refreshPanels()
  },

  buyUpgrade(id) {
    if (purchaseUpgrade(state, id)) refreshPanels()
  },

  ascend() {
    const sure = window.confirm(
      'Give up the farm? Every goat, building and ordinary upgrade goes. You keep your achievements, your occult upgrades, and gain occult points that boost every future herd.',
    )
    if (!sure) return
    const result = ascend(state)
    if (result.occult <= 0) return
    saveGame(state, localStorage, Date.now())
    refreshPanels()
    const gilded = result.gilded ? BUILDING_BY_ID[result.gilded] : null
    ui.toast({
      icon: '🕯️',
      kind: 'Ascended',
      name: `+${result.occult.toLocaleString('en-US')} occult`,
      desc: gilded
        ? `${gilded.icon} ${gilded.name} is gilded. Fresh pasture awaits.`
        : 'Fresh pasture. The old herd remembers you.',
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
      'Sell the farm? Every goat, building and upgrade goes, and there is no getting them back.',
    )
    if (!sure) return
    clearGame(localStorage)
    state = createInitialState(Date.now())
    refreshPanels()
    ui.status('Farm sold. Fresh pasture, one goat at a time.')
  },

  enableSync() {
    syncToken = newSyncToken()
    storeSyncToken(localStorage, syncToken)
    cloudReady = true
    saveGame(state, localStorage, Date.now())
    ui.sync(syncToken)
    pushCloud().then(() => ui.status('Cloud sync is on. Enter this code on another device to share the herd.'))
  },

  async linkSync(code) {
    const token = code.trim().toLowerCase()
    if (!isSyncToken(token)) {
      ui.status('That is not a sync code.')
      return
    }
    syncToken = token
    storeSyncToken(localStorage, token)
    cloudReady = false
    ui.sync(token)
    const remote = await pullSave(token)
    cloudReady = true
    if (remote && adoptCloudSave(remote, true)) {
      ui.status('Linked. The cloud herd was newer, so it is now the one you are playing.')
    } else {
      saveGame(state, localStorage, Date.now())
      await pushCloud()
      ui.status('Linked. This herd is now the cloud herd.')
    }
  },

  disableSync() {
    syncToken = null
    storeSyncToken(localStorage, null)
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

// Saving on the way out means a closed tab is paid as offline time.
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) return
  saveGame(state, localStorage, Date.now())
  void pushCloud(true)
})

window.addEventListener('pagehide', () => {
  saveGame(state, localStorage, Date.now())
  void pushCloud(true)
})

refreshPanels()
ui.sync(syncToken)
if (welcomeBack) ui.welcome(welcomeBack.seconds, welcomeBack.goats)
void pullCloud()
