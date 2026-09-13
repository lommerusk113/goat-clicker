import { BALANCE } from '../game/balance'
import { BUILDINGS, BUILDING_IDS } from '../game/buildings'
import { goatsForNextOccult, pendingOccult } from '../game/state'
import { RELICS, relicAffordable, relicBulkCost } from '../game/relics'
import { multipliers } from '../game/economy'
import type { BuildingId, GameState, RelicDef, RelicId } from '../game/types'
import { byId, el, setText, toggleClass } from './dom'
import { formatGoats, formatShort } from './format'
import type { Tooltip } from './tooltip'

export interface AscendHandlers {
  buyRelic(id: RelicId, count: number | 'max'): void
  ascend(): void
  moveGild(from: BuildingId, to: BuildingId): void
  rerollGild(from: BuildingId): void
}

export interface AscendPanel {
  update(state: GameState): void
}

interface RelicRow {
  def: RelicDef
  root: HTMLButtonElement
  level: HTMLElement
  effect: HTMLElement
  cost: HTMLElement
}

/** The Ascend tab: occult points, the ascend button, the relics and the gilds. */
export function createAscend(tooltip: Tooltip, handlers: AscendHandlers): AscendPanel {
  const pointsNode = byId('occult-points')
  const bonusNode = byId('occult-bonus')
  const pendingNode = byId('occult-pending')
  const nextNode = byId('occult-next')
  const button = byId<HTMLButtonElement>('btn-ascend')
  const relicList = byId('relic-list')
  const tally = byId('ascend-tally')
  const gildList = byId('gild-list')
  const gildFrom = byId<HTMLSelectElement>('gild-from')
  const gildTo = byId<HTMLSelectElement>('gild-to')
  const gildButton = byId<HTMLButtonElement>('btn-gild-move')
  const rerollButton = byId<HTMLButtonElement>('btn-gild-reroll')

  let state: GameState | null = null
  /** How many levels the ×1 / ×10 / Max switch is set to. */
  let amount: number | 'max' = 1

  button.addEventListener('click', handlers.ascend)
  gildButton.addEventListener('click', () =>
    handlers.moveGild(gildFrom.value as BuildingId, gildTo.value as BuildingId),
  )
  rerollButton.addEventListener('click', () => handlers.rerollGild(gildFrom.value as BuildingId))
  setText(gildButton, `Move here (🕯️ ${BALANCE.gildMoveCost})`)
  setText(rerollButton, `Reroll (🕯️ ${BALANCE.gildRerollCost})`)

  const amountButtons = [...byId('relic-amount').querySelectorAll<HTMLButtonElement>('.amount__btn')]
  for (const node of amountButtons) {
    node.addEventListener('click', () => {
      const value = node.dataset.amount ?? '1'
      amount = value === 'max' ? 'max' : Number(value)
      for (const other of amountButtons) {
        other.classList.toggle('amount__btn--active', other === node)
      }
    })
  }

  for (const b of BUILDINGS) {
    const option = el('option', undefined, `${b.icon} ${b.name}`)
    option.value = b.id
    gildTo.append(option)
  }

  /** Levels the switch would buy of this relic, and what they cost together. */
  function order(def: RelicDef, s: GameState): { levels: number; price: number } {
    const level = s.occultLevels[def.id] ?? 0
    const levels = amount === 'max' ? relicAffordable(def, level, s.occult) : amount
    return { levels, price: relicBulkCost(def, level, Math.max(1, levels)) }
  }

  function relicTip(def: RelicDef) {
    if (!state) return { icon: def.icon, name: def.name, desc: def.desc }
    const level = state.occultLevels[def.id] ?? 0
    const { levels, price } = order(def, state)
    return {
      icon: def.icon,
      name: def.name,
      cost: `🕯️ ${formatShort(price)}${levels > 1 ? ` for ${levels} levels` : ''}`,
      tooDear: state.occult < price,
      desc: def.desc,
      stats: [
        level > 0 ? `Level ${level}: ${def.summary(level)}` : 'Not yet summoned',
        `Kept through every ascension`,
      ],
      blurb: def.blurb,
    }
  }

  const relicRows: RelicRow[] = RELICS.map((def) => {
    const root = el('button', 'relic')
    root.type = 'button'

    const icon = el('span', 'relic__icon', def.icon)
    const body = el('span', 'relic__body')
    const name = el('span', 'relic__name', def.name)
    const effect = el('span', 'relic__effect')
    body.append(name, effect)
    const level = el('span', 'relic__level')
    const cost = el('span', 'relic__cost')

    root.append(icon, body, cost, level)
    root.addEventListener('click', () => handlers.buyRelic(def.id, amount))
    tooltip.attach(root, () => relicTip(def))
    relicList.append(root)

    return { def, root, level, effect, cost }
  })

  /** Which buildings hold gilds, so the list and the source picker only rebuild when that changes. */
  let gildSignature = ''

  function drawGilds(s: GameState, gildBonus: number) {
    const signature = `${gildBonus}|${BUILDING_IDS.map((id) => s.gilds[id]).join('|')}`
    if (signature === gildSignature) return
    gildSignature = signature

    const held = BUILDINGS.filter((b) => s.gilds[b.id] > 0)
    gildList.replaceChildren(
      ...held.map((b) =>
        el('span', 'gild', `${b.icon} ${b.name} ×${s.gilds[b.id]} (+${s.gilds[b.id] * gildBonus * 100}%)`),
      ),
    )
    if (held.length === 0) gildList.append(el('span', 'ascend__key', 'No gilds yet. The first comes at five occult points earned, then one each time that total grows by half.'))

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

  return {
    update(next) {
      state = next
      const pending = pendingOccult(next)
      const m = multipliers(next)
      const bonus = next.occult * m.occultPercent

      // Points are counted in the same short hand as the relic prices they buy,
      // so a total and a cost can be read against each other at a glance.
      setText(pointsNode, formatShort(next.occult))
      setText(bonusNode, `+${formatShort(bonus)}%`)
      setText(pendingNode, pending > 0 ? `+${formatShort(pending)}` : '0')

      setText(nextNode, `${formatGoats(goatsForNextOccult(next))} more goats for the next point`)

      button.disabled = pending <= 0
      setText(tally, pending > 0 ? `+${formatShort(pending)}` : '')
      tally.hidden = pending <= 0

      for (const row of relicRows) {
        const level = next.occultLevels[row.def.id] ?? 0
        const { levels, price } = order(row.def, next)
        const affordable = levels > 0 && next.occult >= price

        setText(row.level, level > 0 ? `Lv ${level}` : '')
        setText(row.effect, level > 0 ? row.def.summary(level) : row.def.desc)
        setText(row.cost, `🕯️ ${formatShort(price)}${levels > 1 ? ` ×${levels}` : ''}`)
        toggleClass(row.root, 'relic--ready', affordable)
        toggleClass(row.root, 'relic--short', !affordable)
      }

      drawGilds(next, m.gildBonus)
      gildButton.disabled = gildFrom.options.length === 0 || next.occult < BALANCE.gildMoveCost
      rerollButton.disabled = gildFrom.options.length === 0 || next.occult < BALANCE.gildRerollCost
    },
  }
}
