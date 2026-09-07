/** How often the herd is paid, in milliseconds. */
export const TICK_MS = 200

/**
 * Longest single step the herd is paid for, in seconds. Steps are measured
 * against the wall clock rather than counted frames, so a throttled background
 * tab still earns the right amount; this only caps pathological jumps such as
 * the machine waking from sleep.
 */
export const MAX_STEP = 300

/** Seconds between two timestamps, never negative and never absurd. */
export function stepDelta(prevMs: number, nowMs: number): number {
  return Math.min(Math.max(nowMs - prevMs, 0) / 1000, MAX_STEP)
}

export interface LoopCallbacks {
  /** Advances the game. Called on a timer, so it keeps running in the background. */
  tick(dt: number): void
  /** Redraws. Called per animation frame, so it pauses when nothing is visible. */
  render(): void
}

/**
 * Splits the game into a timer-driven simulation and a frame-driven redraw.
 * Browsers pause animation frames for hidden tabs but keep timers going, which
 * is exactly the split an idle game needs.
 */
export function startLoop({ tick, render }: LoopCallbacks): () => void {
  let last = Date.now()
  let running = true
  let frame = 0

  const step = () => {
    const now = Date.now()
    const dt = stepDelta(last, now)
    last = now
    if (dt > 0) tick(dt)
  }

  const timer = setInterval(step, TICK_MS)

  const paint = () => {
    if (!running) return
    render()
    frame = requestAnimationFrame(paint)
  }
  frame = requestAnimationFrame(paint)

  return () => {
    running = false
    clearInterval(timer)
    cancelAnimationFrame(frame)
  }
}
