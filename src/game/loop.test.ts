import { describe, expect, test } from 'vitest'
import { MAX_STEP, stepDelta } from './loop'

describe('stepDelta', () => {
  test('converts elapsed milliseconds to seconds', () => {
    expect(stepDelta(1_000, 1_500)).toBeCloseTo(0.5)
  })

  test('pays a full minute when a background tab is throttled to one tick', () => {
    expect(stepDelta(0, 60_000)).toBe(60)
  })

  test('caps a pathological jump, such as the machine waking from sleep', () => {
    expect(stepDelta(0, 10_000_000)).toBe(MAX_STEP)
  })

  test('never runs the clock backwards', () => {
    expect(stepDelta(5_000, 1_000)).toBe(0)
  })
})
