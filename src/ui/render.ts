import type { BuildingId, GameState, Stats } from '../game/types'
import { byId, el, setText } from './dom'
import { formatGoats, formatRate, formatTime } from './format'
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
  saveNow(): void
  exportSave(): void
  importSave(code: string): void
  wipeSave(): void
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
  welcome(seconds: number, goats: number): void
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
      setText(rateNode, formatRate(stats.gps))
      setText(perClickNode, formatRate(stats.perClick))
      drawBuffs(state)
      drawHerd(stats.buildingsOwned)
    },

    slow(state, stats) {
      store.update(state, stats)
      panels.update(state, stats)
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

    welcome(seconds, goats) {
      setText(byId('welcome-time'), formatTime(seconds))
      setText(byId('welcome-goats'), `${formatGoats(goats)} goats`)
      welcomeNode.hidden = false
    },
  }
}
