import type { BuildingId, GameState, RelicId, Stats } from '../game/types'
import { createAscend } from './ascend'
import { byId, el, setText, toggleClass } from './dom'
import { formatGoats, formatRate, formatShort, formatTime } from './format'
import { createPanels } from './panels'
import { createParticles } from './particles'
import { createStore } from './store'
import { createToasts } from './toast'
import type { ToastContent } from './toast'
import { createTooltip } from './tooltip'

/** One grazing goat per building, up to a pasture-full. */
const MAX_HERD_GOATS = 60

export interface UiHandlers {
  /** Runs one pet of the goat and reports what it gathered. */
  pet(): number
  buyBuilding(id: BuildingId, count: number): void
  buyUpgrade(id: string): void
  buyRelic(id: RelicId, count: number | 'max'): void
  ascend(): void
  moveGild(from: BuildingId, to: BuildingId): void
  rerollGild(from: BuildingId): void
  saveNow(): void
  exportSave(): void
  importSave(code: string): void
  wipeSave(): void
  enableSync(): void
  linkSync(code: string): void
  disableSync(): void
}

export interface Ui {
  /** Numbers that change every frame. */
  fast(state: GameState, stats: Stats): void
  /** Lists and panels, which only need refreshing a few times a second. */
  slow(state: GameState, stats: Stats): void
  toast(content: ToastContent): void
  /** Puts a golden goat on screen. `onCatch` reports what catching it gave. */
  showGolden(lifetime: number, onCatch: () => string): void
  status(message: string): void
  /** `away` is the real time gone; `paid` is how much of it the herd worked, after the offline cap. */
  welcome(gain: { away: number; paid: number; goats: number }): void
  /** Shows the cloud sync section for the given code, or the "turn on" state for null. */
  sync(token: string | null): void
}

export function createUi(handlers: UiHandlers): Ui {
  const tooltip = createTooltip(byId('tooltip'))
  const particles = createParticles(byId('particles'))
  const toasts = createToasts(byId('toasts'))

  let amount = 1
  const store = createStore(tooltip, {
    amount: () => amount,
    buyBuilding: handlers.buyBuilding,
    buyUpgrade: handlers.buyUpgrade,
  })
  const panels = createPanels(tooltip)
  const ascendPanel = createAscend(tooltip, {
    buyRelic: handlers.buyRelic,
    ascend: handlers.ascend,
    moveGild: handlers.moveGild,
    rerollGild: handlers.rerollGild,
  })

  const countNode = byId('goat-count')
  const rateNode = byId('goat-rate')
  const perClickNode = byId('per-click')
  const buffsNode = byId('buffs')
  const herdNode = byId('herd')
  const goldensNode = byId('goldens')
  const statusNode = byId('settings-status')

  // --- the goat itself -------------------------------------------------------
  const bigGoat = byId<HTMLButtonElement>('big-goat')
  bigGoat.addEventListener('click', (event) => {
    const gain = handlers.pet()
    const spot = bigGoat.getBoundingClientRect()
    // Keyboard activation reports no coordinates, so fall back to the goat.
    const x = event.clientX || spot.left + spot.width / 2
    const y = event.clientY || spot.top + spot.height / 3
    particles.pop(x, y, `+${formatRate(gain)}`)
  })

  // --- tabs ------------------------------------------------------------------
  const tabs = [...byId('tabs').querySelectorAll<HTMLButtonElement>('.tab')]
  for (const tab of tabs) {
    tab.addEventListener('click', () => {
      for (const other of tabs) other.classList.toggle('tab--active', other === tab)
      for (const pane of document.querySelectorAll<HTMLElement>('.tab-pane')) {
        pane.classList.toggle('tab-pane--active', pane.id === `pane-${tab.dataset.tab}`)
      }
    })
  }

  // --- narrow-screen section switcher ---------------------------------------
  const game = byId('game')
  const navGoats = byId('nav-goats')
  const navButtons = [...byId('mobile-nav').querySelectorAll<HTMLButtonElement>('.mobile-nav__btn')]
  for (const button of navButtons) {
    button.addEventListener('click', () => {
      game.dataset.view = button.dataset.view
      for (const other of navButtons) {
        other.classList.toggle('mobile-nav__btn--active', other === button)
      }
    })
  }

  // --- buy amount ------------------------------------------------------------
  const amountButtons = [...byId('buy-amount').querySelectorAll<HTMLButtonElement>('.amount__btn')]
  for (const button of amountButtons) {
    button.addEventListener('click', () => {
      amount = Number(button.dataset.amount ?? 1)
      for (const other of amountButtons) {
        other.classList.toggle('amount__btn--active', other === button)
      }
    })
  }

  // --- settings --------------------------------------------------------------
  byId('btn-save').addEventListener('click', handlers.saveNow)
  byId('btn-export').addEventListener('click', handlers.exportSave)
  byId('btn-wipe').addEventListener('click', handlers.wipeSave)
  const importBox = byId<HTMLTextAreaElement>('import-box')
  byId('btn-import').addEventListener('click', () => handlers.importSave(importBox.value))

  // --- cloud sync ------------------------------------------------------------
  const syncOff = byId('sync-off')
  const syncOn = byId('sync-on')
  const syncCode = byId('sync-code')
  const syncLinkBox = byId<HTMLInputElement>('sync-link-box')
  byId('btn-sync-enable').addEventListener('click', handlers.enableSync)
  byId('btn-sync-link').addEventListener('click', () => handlers.linkSync(syncLinkBox.value))
  byId('btn-sync-disable').addEventListener('click', handlers.disableSync)
  byId('btn-sync-copy').addEventListener('click', () => {
    navigator.clipboard?.writeText(syncCode.textContent ?? '').then(
      () => setText(statusNode, 'Sync code copied.'),
      () => setText(statusNode, 'Could not reach the clipboard. Copy the code by hand.'),
    )
  })

  // --- welcome back ----------------------------------------------------------
  const welcomeNode = byId('welcome')
  byId('welcome-ok').addEventListener('click', () => {
    welcomeNode.hidden = true
  })

  // --- pasture bookkeeping ---------------------------------------------------
  let herdSize = -1
  function drawHerd(buildingsOwned: number) {
    const wanted = Math.min(buildingsOwned, MAX_HERD_GOATS)
    if (wanted === herdSize) return
    herdSize = wanted

    herdNode.replaceChildren()
    for (let i = 0; i < wanted; i++) {
      const goat = el('span', 'herd__goat', '🐐')
      // Spread the bobbing out so the herd does not move as one block.
      goat.style.animationDelay = `${(i % 7) * 0.31}s`
      goat.style.fontSize = `${0.85 + ((i * 7) % 5) * 0.09}rem`
      herdNode.append(goat)
    }
  }

  let buffKey = ''
  const buffTimes = new Map<string, HTMLElement>()
  function drawBuffs(state: GameState) {
    const key = state.buffs.map((b) => b.id).join('|')
    if (key !== buffKey) {
      buffKey = key
      buffTimes.clear()
      buffsNode.replaceChildren()
      for (const buff of state.buffs) {
        const chip = el('div', 'buff')
        chip.append(el('span', undefined, `${buff.icon} ${buff.name}`))
        const time = el('span', 'buff__time')
        chip.append(time)
        buffTimes.set(buff.id, time)
        buffsNode.append(chip)
      }
    }
    for (const buff of state.buffs) {
      const node = buffTimes.get(buff.id)
      if (node) setText(node, formatTime(Math.ceil(buff.remaining)))
    }
  }

  let statusTimer = 0
  return {
    fast(state, stats) {
      setText(countNode, formatGoats(state.goats))
      setText(navGoats, formatShort(state.goats))
      setText(rateNode, formatRate(stats.gps))
      setText(perClickNode, formatRate(stats.perClick))
      // The idle bonus is worth nothing the player cannot see coming.
      toggleClass(bigGoat, 'big-goat--idle', stats.idleMult > 1)
      drawBuffs(state)
      drawHerd(stats.buildingsOwned)
    },

    slow(state, stats) {
      store.update(state, stats)
      panels.update(state, stats)
      ascendPanel.update(state)
    },

    toast: toasts.show,

    showGolden(lifetime, onCatch) {
      const node = el('button', 'golden', '🐐')
      node.type = 'button'
      node.title = 'A golden goat!'
      // Keep it clear of the edges so it is always fully clickable.
      node.style.left = `${8 + Math.random() * 74}vw`
      node.style.top = `${10 + Math.random() * 70}vh`

      const remove = () => {
        clearTimeout(timer)
        node.remove()
      }
      const timer = setTimeout(remove, lifetime * 1000)

      node.addEventListener('click', () => {
        const spot = node.getBoundingClientRect()
        const label = onCatch()
        particles.pop(spot.left + spot.width / 2, spot.top, label, true)
        remove()
      })

      goldensNode.append(node)
    },

    status(message) {
      setText(statusNode, message)
      clearTimeout(statusTimer)
      statusTimer = window.setTimeout(() => setText(statusNode, ''), 4_000)
    },

    welcome({ away, paid, goats }) {
      setText(byId('welcome-time'), formatTime(away))
      setText(byId('welcome-goats'), `${formatGoats(goats)} goats`)
      setText(byId('welcome-cap'), paid < away ? ` They knocked off after ${formatTime(paid)}, as goats do.` : '')
      welcomeNode.hidden = false
    },

    sync(token) {
      syncOff.hidden = token !== null
      syncOn.hidden = token === null
      setText(syncCode, token ?? '')
    },
  }
}
