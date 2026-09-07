import './style.css'

import { baseGoatsPerSecond, computeStats, multipliers } from './game/economy'
import { goldenLifetime, nextGoldenDelay, rollGolden } from './game/golden'
import { startLoop } from './game/loop'
import {
  clearGame,
  decodeSave,
  encodeSave,
  loadGame,
  offlineGain,
  saveGame,
} from './game/save'
import {
  addBuff,
  buyBuilding as purchaseBuilding,
  buyUpgrade as purchaseUpgrade,
  claimAchievements,
  createInitialState,
  earn,
  petGoat,
  produce,
  tickBuffs,
} from './game/state'
import { formatGoats } from './ui/format'
import { createUi } from './ui/render'

const AUTOSAVE_SECONDS = 10
const PANEL_REFRESH_SECONDS = 0.2
/** Rough frame time, used only to pace panel refreshes. */
const FRAME_ESTIMATE_SECONDS = 1 / 60
/** Time away below this is not worth a "welcome back" panel. */
const WELCOME_THRESHOLD_SECONDS = 30

const saved = loadGame(localStorage)
let state = saved ?? createInitialState(Date.now())

// Pay out for the time the tab was closed before anything else touches state.
let welcomeBack: { seconds: number; goats: number } | null = null
if (saved) {
  const away = (Date.now() - saved.lastSaved) / 1000
  const gain = offlineGain(baseGoatsPerSecond(state), away)
  if (gain.goats >= 1 && gain.seconds >= WELCOME_THRESHOLD_SECONDS) {
    earn(state, gain.goats)
    welcomeBack = gain
  }
}

const ui = createUi({
  pet: () => petGoat(state),

  buyBuilding(id, count) {
    if (purchaseBuilding(state, id, count)) refreshPanels()
  },

  buyUpgrade(id) {
    if (purchaseUpgrade(state, id)) refreshPanels()
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
  if (document.hidden) saveGame(state, localStorage, Date.now())
})

window.addEventListener('pagehide', () => saveGame(state, localStorage, Date.now()))

refreshPanels()
if (welcomeBack) ui.welcome(welcomeBack.seconds, welcomeBack.goats)
