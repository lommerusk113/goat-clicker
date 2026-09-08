import { BALANCE } from '../game/balance'
import { BUILDINGS, BUILDING_IDS } from '../game/buildings'
import { goatsForOccultLevel, pendingOccult } from '../game/state'
import { OCCULT_UPGRADES } from '../game/upgrades'
import { multipliers } from '../game/economy'
import type { BuildingId, GameState, UpgradeDef } from '../game/types'
import { byId, el, setText, toggleClass } from './dom'
import { formatGoats } from './format'
import type { Tooltip } from './tooltip'

export interface AscendHandlers {
  buyUpgrade(id: string): void
  ascend(): void
  moveGild(from: BuildingId, to: BuildingId): void
  rerollGild(from: BuildingId): void
}

export interface AscendPanel {
  update(state: GameState): void
}

/** The Ascend tab: occult points, the ascend button, and the occult upgrade tree. */
export function createAscend(tooltip: Tooltip, handlers: AscendHandlers): AscendPanel {
  const pointsNode = byId('occult-points')
  const bonusNode = byId('occult-bonus')
  const pendingNode = byId('occult-pending')
  const nextNode = byId('occult-next')
  const button = byId<HTMLButtonElement>('btn-ascend')
  const grid = byId('occult-grid')
  const tally = byId('ascend-tally')
  const gildList = byId('gild-list')
  const gildFrom = byId<HTMLSelectElement>('gild-from')
  const gildTo = byId<HTMLSelectElement>('gild-to')
  const gildButton = byId<HTMLButtonElement>('btn-gild-move')
  const rerollButton = byId<HTMLButtonElement>('btn-gild-reroll')

  let state: GameState | null = null

  button.addEventListener('click', handlers.ascend)
  gildButton.addEventListener('click', () =>
    handlers.moveGild(gildFrom.value as BuildingId, gildTo.value as BuildingId),
  )
  rerollButton.addEventListener('click', () => handlers.rerollGild(gildFrom.value as BuildingId))
  setText(gildButton, `Move here (🕯️ ${BALANCE.gildMoveCost})`)
  setText(rerollButton, `Reroll (🕯️ ${BALANCE.gildRerollCost})`)

  for (const b of BUILDINGS) {
    const option = el('option', undefined, `${b.icon} ${b.name}`)
    option.value = b.id
    gildTo.append(option)
  }

  /** Which buildings hold gilds, so the list and the source picker only rebuild when that changes. */
  let gildSignature = ''

  function drawGilds(s: GameState) {
    const signature = BUILDING_IDS.map((id) => s.gilds[id]).join('|')
    if (signature === gildSignature) return
    gildSignature = signature

    const held = BUILDINGS.filter((b) => s.gilds[b.id] > 0)
    gildList.replaceChildren(
      ...held.map((b) =>
        el('span', 'gild', `${b.icon} ${b.name} ×${s.gilds[b.id]} (+${s.gilds[b.id] * BALANCE.gildBonus * 100}%)`),
      ),
    )
    if (held.length === 0) gildList.append(el('span', 'ascend__key', 'No gilds yet. Your first ascension hands one out.'))

    const chosen = gildFrom.value
    gildFrom.replaceChildren(
      ...held.map((b) => {
        const option = el('option', undefined, `${b.icon} ${b.name} ×${s.gilds[b.id]}`)
        option.value = b.id
        return option
      }),
    )
    if (held.some((b) => b.id === chosen)) gildFrom.value = chosen
  }

  function tip(def: UpgradeDef) {
    const owned = state?.upgrades.includes(def.id) ?? false
    const open = state ? def.unlocked(state) : false
    const need = def.requires ? OCCULT_UPGRADES.find((u) => u.id === def.requires) : undefined
    return {
      icon: def.icon,
      name: def.name,
      cost: owned ? 'Owned' : `🕯️ ${def.cost}`,
      tooDear: !owned && (!open || (state?.occult ?? 0) < def.cost),
      desc: def.desc,
      stats: [
        owned ? 'Kept through every ascension' : 'Occult upgrade',
        ...(!open && need ? [`Needs ${need.name} first`] : []),
      ],
      blurb: def.blurb,
    }
  }

  const nodes = OCCULT_UPGRADES.map((def) => {
    const node = el('button', 'upgrade upgrade--occult', def.icon)
    node.type = 'button'
    node.addEventListener('click', () => handlers.buyUpgrade(def.id))
    tooltip.attach(node, () => tip(def))
    grid.append(node)
    return { def, node }
  })

  return {
    update(next) {
      state = next
      const pending = pendingOccult(next)
      const m = multipliers(next)
      const bonus = next.occult * m.occultPercent

      setText(pointsNode, next.occult.toLocaleString('en-US'))
      setText(bonusNode, `+${bonus.toLocaleString('en-US')}%`)
      setText(pendingNode, `+${pending.toLocaleString('en-US')}`)

      // Goats still needed this run before one more point is on offer.
      const nextLevel = next.occultEarned + pending + 1
      const needed = goatsForOccultLevel(nextLevel) - (next.lifetimeGoats + next.totalGoats)
      setText(nextNode, `${formatGoats(needed)} more goats for the next point`)

      button.disabled = pending <= 0
      setText(tally, pending > 0 ? `+${pending}` : '')
      tally.hidden = pending <= 0

      drawGilds(next)
      gildButton.disabled = gildFrom.options.length === 0 || next.occult < BALANCE.gildMoveCost
      rerollButton.disabled = gildFrom.options.length === 0 || next.occult < BALANCE.gildRerollCost

      for (const { def, node } of nodes) {
        const owned = next.upgrades.includes(def.id)
        const open = def.unlocked(next)
        toggleClass(node, 'upgrade--owned', owned)
        toggleClass(node, 'upgrade--ready', !owned && open && next.occult >= def.cost)
        toggleClass(node, 'upgrade--short', !owned && (!open || next.occult < def.cost))
        node.disabled = owned
      }
    },
  }
}
