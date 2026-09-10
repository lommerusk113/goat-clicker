import { BUILDINGS } from '../game/buildings'
import { BALANCE } from '../game/balance'
import { bulkCost, milestoneMult, nextMilestone } from '../game/economy'
import { UPGRADES, availableUpgrades } from '../game/upgrades'
import type { BuildingDef, BuildingId, GameState, Stats, UpgradeDef } from '../game/types'
import { byId, el, setText, toggleClass } from './dom'
import { formatRate, formatShort } from './format'
import type { TipContent, Tooltip } from './tooltip'

export interface StoreHandlers {
  /** How many units the ×1 / ×10 / ×100 switch is set to. */
  amount(): number
  buyBuilding(id: BuildingId, count: number): void
  buyUpgrade(id: string): void
}

/** A building stays behind "???" until the herd is within sight of its price. */
const REVEAL_FRACTION = 0.4

const TIER_NUMERALS = ['I', 'II', 'III', 'IV', 'V']

const KIND_LABELS: Record<UpgradeDef['kind'], string> = {
  building: 'Building upgrade',
  click: 'Petting upgrade',
  golden: 'Golden goat upgrade',
  global: 'Herd-wide upgrade',
}

interface View {
  state: GameState
  stats: Stats
}

interface Row {
  def: BuildingDef
  root: HTMLButtonElement
  icon: HTMLElement
  name: HTMLElement
  cost: HTMLElement
  owned: HTMLElement
  gild: HTMLElement
}

export interface Store {
  update(state: GameState, stats: Stats): void
}

export function createStore(tooltip: Tooltip, handlers: StoreHandlers): Store {
  const listNode = byId('building-list')
  const gridNode = byId('upgrade-grid')
  const hintNode = byId('upgrade-hint')

  // The tooltips read live numbers, so they share the latest view.
  let view: View | null = null

  function priceOf(def: BuildingDef, state: GameState): number {
    return bulkCost(def, state.buildings[def.id], handlers.amount())
  }

  function revealed(def: BuildingDef, state: GameState): boolean {
    // The starter building is always on show — there has to be something to buy.
    if (def === BUILDINGS[0]) return true
    return state.buildings[def.id] > 0 || state.totalGoats >= def.baseCost * REVEAL_FRACTION
  }

  function buildingTip(def: BuildingDef): TipContent {
    if (!view) return { icon: def.icon, name: def.name, desc: '' }
    const { state, stats } = view
    const owned = state.buildings[def.id]

    if (!revealed(def, state)) {
      return {
        icon: '❓',
        name: '???',
        desc: 'Something to aim for. Keep herding.',
        stats: [`Costs around ${formatShort(def.baseCost)} goats`],
      }
    }

    const price = priceOf(def, state)
    const count = handlers.amount()
    const line = stats.byBuilding[def.id]
    // Same multipliers whether owned or not, so a Frenzy does not flatter only what you already have.
    const perUnit = stats.perUnit[def.id]
    const lines: string[] = []

    if (owned > 0) {
      const share = stats.gps > 0 ? (line / stats.gps) * 100 : 0
      lines.push(
        `${owned.toLocaleString('en-US')} owned, herding ${formatRate(line)} per second`,
        `${share.toFixed(1)}% of everything you produce`,
      )
    }

    const upcoming = nextMilestone(owned)
    const bump = upcoming % BALANCE.milestoneBig === 0 ? BALANCE.milestoneBigMult : BALANCE.milestoneMult
    lines.push(
      `Next milestone at ${upcoming}: ×${bump} output` +
        (milestoneMult(owned) > 1 ? ` (×${formatShort(milestoneMult(owned))} so far)` : '') +
        `, then every ${BALANCE.milestoneStep}`,
    )
    const gilds = state.gilds[def.id]
    if (gilds > 0) lines.push(`${gilds} gild${gilds === 1 ? '' : 's'}: +${gilds * stats.gildBonus * 100}% output`)

    // Building tiers double the click bonus along with production.
    const perClick = def.baseClick ? def.baseClick * (perUnit / def.baseCps) : 0
    const clickNote = perClick > 0 ? ` and adds ${formatRate(perClick)} to every pet` : ''

    return {
      icon: def.icon,
      name: def.name,
      cost: `🐐 ${formatShort(price)}${count > 1 ? ` for ${count}` : ''}`,
      tooDear: state.goats < price,
      desc: `Each one herds ${formatRate(perUnit)} goats per second${clickNote}.`,
      stats: lines,
      blurb: def.blurb,
    }
  }

  const rows: Row[] = BUILDINGS.map((def) => {
    const root = el('button', 'building')
    root.type = 'button'

    const icon = el('span', 'building__icon', def.icon)
    const body = el('span')
    const name = el('span', 'building__name', def.name)
    const cost = el('span', 'building__cost')
    body.append(name, cost)
    const owned = el('span', 'building__owned')
    const gild = el('span', 'building__gild')

    root.append(icon, body, gild, owned)
    root.addEventListener('click', () => handlers.buyBuilding(def.id, handlers.amount()))
    tooltip.attach(root, () => buildingTip(def))
    listNode.append(root)

    return { def, root, icon, name, cost, owned, gild }
  })

  function upgradeTip(def: UpgradeDef): TipContent {
    const state = view?.state
    return {
      icon: def.icon,
      name: def.name,
      cost: `🐐 ${formatShort(def.cost)}`,
      tooDear: state ? state.goats < def.cost : false,
      desc: def.desc,
      stats: [
        def.tier ? `${KIND_LABELS[def.kind]}, tier ${def.tier}` : KIND_LABELS[def.kind],
      ],
      blurb: def.blurb,
    }
  }

  /** Which upgrades are on show, so the grid is only rebuilt when that changes. */
  let gridSignature = ''

  function rebuildGrid(offered: UpgradeDef[]) {
    gridNode.replaceChildren()
    for (const def of offered) {
      const node = el('button', 'upgrade', def.icon)
      node.type = 'button'
      node.dataset.id = def.id
      if (def.tier) node.dataset.tier = TIER_NUMERALS[def.tier - 1] ?? String(def.tier)
      node.addEventListener('click', () => handlers.buyUpgrade(def.id))
      tooltip.attach(node, () => upgradeTip(def))
      gridNode.append(node)
    }
  }

  return {
    update(state, stats) {
      view = { state, stats }

      for (const row of rows) {
        const { def } = row
        const owned = state.buildings[def.id]
        const shown = revealed(def, state)
        const price = priceOf(def, state)

        setText(row.icon, shown ? def.icon : '❓')
        setText(row.name, shown ? def.name : '???')
        setText(row.cost, shown ? `🐐 ${formatShort(price)}` : '???')
        setText(row.owned, owned > 0 ? String(owned) : '')
        setText(row.gild, state.gilds[def.id] > 0 ? `✦ ${state.gilds[def.id]}` : '')

        toggleClass(row.root, 'building--hidden', !shown)
        toggleClass(row.root, 'building--short', shown && state.goats < price)
        row.root.disabled = !shown
      }

      const offered = availableUpgrades(state)
      const signature = offered.map((u) => u.id).join('|')
      if (signature !== gridSignature) {
        gridSignature = signature
        rebuildGrid(offered)
      }

      for (const node of gridNode.children) {
        const def = UPGRADES.find((u) => u.id === (node as HTMLElement).dataset.id)
        if (!def) continue
        const affordable = state.goats >= def.cost
        toggleClass(node as HTMLElement, 'upgrade--ready', affordable)
        toggleClass(node as HTMLElement, 'upgrade--short', !affordable)
      }

      const cheapest = offered[0]
      setText(
        hintNode,
        offered.length === 0
          ? 'Nothing on offer — buy some buildings'
          : `${offered.length} available, from ${formatShort(cheapest.cost)} goats`,
      )
    },
  }
}
