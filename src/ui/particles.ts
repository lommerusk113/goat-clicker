import { el } from './dom'

const POP_LIFETIME_MS = 1_200

export interface Particles {
  /** Floats a label up from a point on screen. */
  pop(x: number, y: number, text: string, gold?: boolean): void
}

export function createParticles(layer: HTMLElement): Particles {
  return {
    pop(x, y, text, gold = false) {
      const node = el('span', gold ? 'pop pop--gold' : 'pop', text)
      node.style.left = `${x}px`
      node.style.top = `${y}px`
      layer.append(node)
      setTimeout(() => node.remove(), POP_LIFETIME_MS)
    },
  }
}
