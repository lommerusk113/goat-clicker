/**
 * Every tuning knob in one place. The game reads these at call time, so the
 * balance simulator can sweep them; nothing else should write to them.
 */
export const BALANCE = {
  /**
   * Each unit of a building costs this much more than the last. This is the
   * pacing knob: with ×4 milestones every 25 units, production is a power of
   * wealth with exponent ln4/ln(growth^25). At 7% that is 0.82 and a run's
   * output grows like time^5.5, which burns through content in hours. At 10%
   * it is 0.58 and time^2.4, which lasts weeks. 9% was tried to speed up the
   * flat stretch after the first ascension and sent the idle relic-spender into
   * exponential growth (17,000 points by 400h) even with milestones spaced to
   * match; the occult bonus per point is the safe knob for that, not this one.
   */
  costGrowth: 1.1,
  /** From this many owned, every `milestoneStep` units multiplies output by `milestoneMult`... */
  milestoneStart: 200,
  milestoneStep: 25,
  milestoneMult: 4,
  /** ...except every `milestoneBig`-th, worth `milestoneBigMult` instead. */
  milestoneBig: 1000,
  milestoneBigMult: 10,
  /**
   * Herd-wide output each milestone crossed anywhere grants, in percent,
   * compounding. Without it a cheap line is permanently decorative: payback
   * play holds every building within a couple of hundred units of the others,
   * so all thirteen cross every milestone together and the ladder cancels out
   * of the comparison, leaving a line's share of output equal to its share of
   * what you can spend — a millionth of the top building's. Compounding
   * rather than additive because an additive bonus is worth 1/n of output by
   * the nth milestone and stops changing anyone's mind; this way a milestone
   * is worth the same slice forever. At 0.25% a block on an old line pays 62
   * times what the top building's block pays at Elder Goat 300, which is
   * enough to make it the buy without disturbing the tier below. Milestone
   * counts grow like the log of wealth, so this is a log factor on output:
   * measured in the simulator it moves the pacing exponent 0.585 to 0.597,
   * clear of the 0.643 that sent the idle build into runaway.
   */
  renownPercent: 0.25,
  /** Extra output per gild, as a fraction. Gilds add up rather than compound. */
  gildBonus: 1,
  /** Lifetime goats that count as one occult unit. */
  occultUnit: 1e10,
  /**
   * Occult points are `occultScale` times the `occultRoot`-th root of lifetime
   * goats in occult units. A root rather than a log, so the count keeps
   * climbing instead of each point needing half again as many goats as the
   * last. Sixth, not Cookie Clicker's cube: the bonus is additive per point
   * and a run's output grows like a high power of the bonus once milestones
   * kick in, so a relic-spending player on the fourth root ran away in the
   * simulator at seventy hours (and the idle build overflowed to Infinity).
   * The sixth is the first root at which every build stays finite; the price
   * is that points still slow down late, polynomially rather than
   * geometrically. Scale 4.5 tracks the old log curve within a point up to
   * 1e14 and pulls ahead from there: six points at 100 billion, nine at a
   * trillion, 30 at a quadrillion, then 96 at 1e18 and 450 at 1e22.
   */
  occultRoot: 6,
  occultScale: 4.5,
  /**
   * Production bonus each unspent occult point grants, in percent. Spending a
   * point on a relic level or a gild move gives this up, so every purchase
   * has to beat it.
   */
  occultBasePercent: 15,
  /** Occult points to throw one gild onto a random other building. */
  gildRerollCost: 1,
  /** Occult points to place one gild exactly where you want it. */
  gildMoveCost: 20,
  /**
   * The first gild comes at this many occult points ever earned, and another
   * each time that total grows by `gildGrowth`. Points are a root of goats and
   * would hand out hundreds of gilds per five; thresholds that grow keep the
   * count at the log of points, about seventeen by three thousand.
   */
  gildFirstOccult: 5,
  gildGrowth: 1.5,
  /**
   * Seconds without a pet before the herd counts as idle. Two minutes, as in
   * Clicker Heroes: long enough that a clicker never drifts into it by accident,
   * short enough that putting the tab down pays before you have forgotten it.
   */
  idleSeconds: 120,
  /** Pets an idle herd shrugs off before it counts as disturbed, so a stray click does not cost the bonus. */
  idleGracePets: 5,
  /** Seconds before the first golden goat of a run. */
  goldenFirstDelay: 300,
  /**
   * Seconds between golden goats, before upgrades: Cookie Clicker's window.
   * Simulated at 150-400s with a 15% Petting Frenzy, goldens paid four times
   * the whole economy in the first hour. At these numbers and a 5% Petting
   * Frenzy they pay about 15% to a player who catches a quarter of them, and
   * roughly half again as much income to one who catches them all: attention
   * is meant to be rewarded. The Frenzy is 60s rather than 77s so doubling the
   * rate did not double the idle payout along with it.
   */
  goldenMinDelay: 150,
  goldenMaxDelay: 450,
  /** Seconds a golden goat stays on screen, before upgrades. Long, so idling is fine. */
  goldenLifetime: 40,
  /** Odds of each golden goat outcome; whatever is left over is Lucky. */
  goldenFrenzyChance: 0.4,
  goldenClickFrenzyChance: 0.05,
  goldenClickFrenzyMult: 777,
}

export type Balance = typeof BALANCE
