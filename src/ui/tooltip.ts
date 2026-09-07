import { el } from './dom'

export interface TipContent {
  icon: string
  name: string
  /** Price line. Omit for things that are not for sale. */
  cost?: string
  /** True when the price is out of reach, which colours it red. */
  tooDear?: boolean
  desc: string
  /** Extra numbers, one line per entry. */
  stats?: string[]
  blurb?: string
}

const MARGIN = 12

export interface Tooltip {
  /** Shows this content whenever the target is hovered or focused. */
  attach(target: HTMLElement, content: () => TipContent): void
  hide(): void
}

export function createTooltip(node: HTMLElement): Tooltip {
  let current: HTMLElement | null = null

  function draw(content: TipContent) {
    node.replaceChildren()

    const head = el('div', 'tip__head')
    head.append(el('span', 'tip__icon', content.icon))
    const heading = el('div')
    heading.append(el('p', 'tip__name', content.name))
    if (content.cost !== undefined) {
      heading.append(
        el('p', content.tooDear ? 'tip__cost tip__cost--short' : 'tip__cost', content.cost),
      )
    }
    head.append(heading)
    node.append(head)

    node.append(el('p', 'tip__desc', content.desc))

    if (content.stats?.length) {
      const stats = el('div', 'tip__stats')
      for (const line of content.stats) stats.append(el('p', undefined, line))
      node.append(stats)
    }

    if (content.blurb) node.append(el('p', 'tip__blurb', content.blurb))
  }

  function place(target: HTMLElement) {
    const anchor = target.getBoundingClientRect()
    const tip = node.getBoundingClientRect()

    // Prefer the side with room; the store sits at the right edge, so its rows
    // get their tooltip on the left.
    const left =
      anchor.left > tip.width + MARGIN * 2
        ? anchor.left - tip.width - MARGIN
        : Math.min(anchor.right + MARGIN, window.innerWidth - tip.width - MARGIN)

    const top = Math.max(
      MARGIN,
      Math.min(
        anchor.top + anchor.height / 2 - tip.height / 2,
        window.innerHeight - tip.height - MARGIN,
      ),
    )

    node.style.left = `${Math.max(MARGIN, left)}px`
    node.style.top = `${top}px`
  }

  function hide() {
    current = null
    node.hidden = true
  }

  return {
    attach(target, content) {
      const show = () => {
        current = target
        draw(content())
        node.hidden = false
        place(target)
      }
      const leave = () => {
        if (current === target) hide()
      }

      target.addEventListener('pointerenter', show)
      target.addEventListener('focus', show)
      target.addEventListener('pointerleave', leave)
      target.addEventListener('blur', leave)
      // Prices move while you hover, so redraw on click-through too.
      target.addEventListener('click', () => {
        if (current === target) show()
      })
    },
    hide,
  }
}
