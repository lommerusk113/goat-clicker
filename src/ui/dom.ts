export function byId<T extends HTMLElement = HTMLElement>(id: string): T {
  const found = document.getElementById(id)
  if (!found) throw new Error(`Missing element #${id}`)
  return found as T
}

export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag)
  if (className) node.className = className
  if (text !== undefined) node.textContent = text
  return node
}

/** Sets textContent only when it changed, to keep the DOM quiet. */
export function setText(node: HTMLElement, text: string): void {
  if (node.textContent !== text) node.textContent = text
}

export function toggleClass(node: HTMLElement, className: string, on: boolean): void {
  node.classList.toggle(className, on)
}
