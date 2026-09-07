import { el } from './dom'

const TOAST_LIFETIME_MS = 5_200

export interface ToastContent {
  icon: string
  /** Small label above the name: "Achievement", "Golden goat". */
  kind: string
  name: string
  desc: string
}

export interface Toasts {
  show(content: ToastContent): void
}

export function createToasts(layer: HTMLElement): Toasts {
  return {
    show({ icon, kind, name, desc }) {
      const node = el('div', 'toast')
      node.append(el('span', 'toast__icon', icon))

      const body = el('div')
      body.append(el('p', 'toast__kind', kind))
      body.append(el('p', 'toast__name', name))
      body.append(el('p', 'toast__desc', desc))
      node.append(body)

      layer.append(node)
      setTimeout(() => node.remove(), TOAST_LIFETIME_MS)
    },
  }
}
