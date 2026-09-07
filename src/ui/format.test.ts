import { describe, expect, test } from 'vitest'
import { formatGoats, formatRate, formatShort, formatTime } from './format'

describe('formatGoats', () => {
  test('shows small counts as whole numbers with separators', () => {
    expect(formatGoats(0)).toBe('0')
    expect(formatGoats(7)).toBe('7')
    expect(formatGoats(1_234)).toBe('1,234')
    expect(formatGoats(999_999)).toBe('999,999')
  })

  test('floors fractional counts', () => {
    expect(formatGoats(12.9)).toBe('12')
  })

  test('names large scales', () => {
    expect(formatGoats(1_000_000)).toBe('1 million')
    expect(formatGoats(1_234_567)).toBe('1.235 million')
    expect(formatGoats(2_500_000_000)).toBe('2.5 billion')
    expect(formatGoats(9.87e15)).toBe('9.87 quadrillion')
  })
})

describe('formatShort', () => {
  test('keeps three significant digits', () => {
    expect(formatShort(999)).toBe('999')
    expect(formatShort(1_500)).toBe('1.5K')
    expect(formatShort(12_345)).toBe('12.3K')
    expect(formatShort(123_456)).toBe('123K')
    expect(formatShort(1_234_567)).toBe('1.23M')
  })

  test('carries to the next suffix instead of printing 1000 of the last', () => {
    expect(formatShort(999_999)).toBe('1M')
  })
})

describe('formatRate', () => {
  test('keeps one decimal for slow herds', () => {
    expect(formatRate(0)).toBe('0')
    expect(formatRate(0.1)).toBe('0.1')
    expect(formatRate(47.5)).toBe('47.5')
    expect(formatRate(1)).toBe('1')
  })

  test('switches to named scales when large', () => {
    expect(formatRate(2_000_000)).toBe('2 million')
  })
})

describe('formatTime', () => {
  test('omits empty units', () => {
    expect(formatTime(0)).toBe('0s')
    expect(formatTime(45)).toBe('45s')
    expect(formatTime(61)).toBe('1m 1s')
  })

  test('shows at most three units, largest first', () => {
    expect(formatTime(3_661)).toBe('1h 1m 1s')
    expect(formatTime(90_061)).toBe('1d 1h 1m')
  })
})
