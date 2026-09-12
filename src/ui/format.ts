/** Named scales, Cookie Clicker style: "1.235 million goats". */
const SCALE_NAMES: [number, string][] = [
  [1e6, 'million'],
  [1e9, 'billion'],
  [1e12, 'trillion'],
  [1e15, 'quadrillion'],
  [1e18, 'quintillion'],
  [1e21, 'sextillion'],
  [1e24, 'septillion'],
  [1e27, 'octillion'],
  [1e30, 'nonillion'],
  [1e33, 'decillion'],
]

/** Compact suffixes for tight spaces like store prices. */
const SHORT_SUFFIXES = ['', 'K', 'M', 'B', 'T', 'Qa', 'Qi', 'Sx', 'Sp', 'Oc', 'No', 'Dc']

/**
 * A herd this big is counted in demon goats, one of which is worth this many
 * ordinary ones — the point where the named scales run out. The ladder then
 * starts again on top of the new unit, so "1.5 million demon goats" follows
 * "999 decillion goats" without inventing a word nobody can read.
 */
export const DEMON_UNIT = 1e36

/**
 * A demon goat's worth of demon goats, past which nothing is named. Spelled
 * out rather than squared: the product of two doubles misses the round number
 * by an ulp, and the comparison at the boundary goes the wrong way.
 */
const DEMON_CAP = 1e72

/** Whether a count is large enough to be measured in demon goats. */
export function inDemonGoats(n: number): boolean {
  return n >= DEMON_UNIT
}

/**
 * How many demon goats a count is worth, rounded back to the precision the
 * division deserves. Dividing by 1e36 lands 1e39 at 999.9999999999999, and
 * every later decision — carry, floor, which ladder to use — then goes the
 * wrong way by a whole order of magnitude.
 */
function asDemonGoats(n: number): number {
  return Number((n / DEMON_UNIT).toPrecision(12))
}

const SUPERSCRIPT = ['⁰', '¹', '²', '³', '⁴', '⁵', '⁶', '⁷', '⁸', '⁹']

/** Past even demon goats, plain scientific: "1.23×10⁷⁵". */
function scientific(n: number): string {
  const power = Math.floor(Math.log10(n))
  const mantissa = trimZeros((n / 10 ** power).toFixed(2))
  const digits = String(power).replace(/\d/g, (d) => SUPERSCRIPT[Number(d)])
  return `${mantissa}×10${digits}`
}

/** Three significant digits of a value under a thousand: "1.5", "12.3", "123". */
function significant(value: number): string {
  return trimZeros(value.toFixed(value < 10 ? 2 : value < 100 ? 1 : 0))
}

function trimZeros(s: string): string {
  return s.includes('.') ? s.replace(/\.?0+$/, '') : s
}

/** A count of at least a million, on the named ladder: "1.235 million". */
function named(n: number): string {
  let i = SCALE_NAMES.length - 1
  while (i > 0 && n < SCALE_NAMES[i][0]) i--

  let [scale, name] = SCALE_NAMES[i]
  let value = n / scale
  // Rounding can push 999.9995 million up to a full 1000 — carry it instead.
  if (Number(value.toFixed(3)) >= 1000 && i < SCALE_NAMES.length - 1) {
    ;[scale, name] = SCALE_NAMES[i + 1]
    value = n / scale
  }
  return `${trimZeros(value.toFixed(3))} ${name}`
}

/**
 * A count of demon goats, kept to the same six digits the ordinary ladder
 * allows. Fractions are worth keeping while a single demon goat still divides
 * into something readable — half of one is a great many goats — but once there
 * are thousands of them the decimals are noise, and separators never sit
 * beside decimals anywhere else in the game.
 */
function demonHerd(herd: number): string {
  if (herd < 1000) return herd.toLocaleString('en-US', { maximumFractionDigits: 3 })
  const whole = Math.round(herd)
  // A herd that rounds up to a million belongs on the named ladder.
  return whole < 1e6 ? whole.toLocaleString('en-US') : named(herd)
}

/** The headline count: separators below a million, named scales above. */
export function formatGoats(n: number): string {
  if (!Number.isFinite(n)) return 'a lot of'
  if (n < 0) return `-${formatGoats(-n)}`
  if (n >= DEMON_CAP) return scientific(n)
  if (inDemonGoats(n)) return `${demonHerd(asDemonGoats(n))} demon`
  if (n < 1e6) return Math.floor(n).toLocaleString('en-US')
  return named(n)
}

/** Three significant digits with a one- or two-letter suffix: "1.23M". */
export function formatShort(n: number): string {
  if (!Number.isFinite(n)) return '∞'
  if (n < 0) return `-${formatShort(-n)}`
  if (n >= DEMON_CAP) return scientific(n)
  // 'D' for demon goats, so a price cannot be misread as the ordinary kind.
  // Below a thousand of them the fraction is kept, for the same reason the
  // headline keeps it: flooring would drop most of a very large herd.
  if (inDemonGoats(n)) {
    const herd = asDemonGoats(n)
    return `${herd < 1000 ? significant(herd) : formatShort(herd)}D`
  }
  if (n < 1000) return String(Math.floor(n))

  let i = Math.min(Math.floor(Math.log10(n) / 3), SHORT_SUFFIXES.length - 1)
  let value = n / 1000 ** i
  let text = significant(value)
  if (Number(text) >= 1000 && i < SHORT_SUFFIXES.length - 1) {
    i += 1
    value = n / 1000 ** i
    text = trimZeros(value.toFixed(2))
  }
  return `${text}${SHORT_SUFFIXES[i]}`
}

/** Production rates, which need a decimal while the farm is still small. */
export function formatRate(n: number): string {
  if (!Number.isFinite(n)) return 'a lot of'
  if (n === 0) return '0'
  if (n < 1000) return trimZeros(n.toFixed(1))
  return formatGoats(n)
}

/** Durations as up to three units, largest first: "1h 1m 1s". */
export function formatTime(seconds: number): string {
  const total = Math.floor(seconds)
  if (total <= 0) return '0s'

  const parts: string[] = []
  const units: [number, string][] = [
    [86_400, 'd'],
    [3_600, 'h'],
    [60, 'm'],
    [1, 's'],
  ]
  let left = total
  for (const [size, label] of units) {
    const n = Math.floor(left / size)
    left -= n * size
    if (n > 0) parts.push(`${n}${label}`)
  }
  return parts.slice(0, 3).join(' ')
}
