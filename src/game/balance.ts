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
   * it is 0.58 and time^2.4, which lasts weeks.
   */
  costGrowth: 1.1,
  /** From this many owned, every `milestoneStep` units multiplies output by `milestoneMult`... */
  milestoneStart: 200,
  milestoneStep: 25,
  milestoneMult: 4,
  /** ...except every `milestoneBig`-th, worth `milestoneBigMult` instead. */
  milestoneBig: 1000,
  milestoneBigMult: 10,
  /** Extra output per gild, as a fraction. Gilds add up rather than compound. */
  gildBonus: 1,
  /** Lifetime goats at which the occult scale starts counting. */
  occultUnit: 1e10,
  /** Occult points per tenfold increase in lifetime goats. Scarce: each one is worth a lot. */
  occultPerDecade: 5,
  /**
   * Production bonus each unspent occult point grants, in percent. Spending a
   * point on a relic level or a gild move gives this up, so every purchase
   * has to beat it.
   */
  occultBasePercent: 10,
  /** Occult points to throw one gild onto a random other building. */
  gildRerollCost: 1,
  /** Occult points to place one gild exactly where you want it. */
  gildMoveCost: 20,
  /** A gild is handed out for every this many occult points ever earned, so ascending often earns no extra gilds. */
  gildPerOccult: 5,
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
   * the whole economy in the first hour; at these numbers they pay about 7%.
   */
  goldenMinDelay: 300,
  goldenMaxDelay: 900,
  /** Seconds a golden goat stays on screen, before upgrades. Long, so idling is fine. */
  goldenLifetime: 40,
  /** Odds of each golden goat outcome; whatever is left over is Lucky. */
  goldenFrenzyChance: 0.4,
  goldenClickFrenzyChance: 0.05,
  goldenClickFrenzyMult: 777,
}

export type Balance = typeof BALANCE
