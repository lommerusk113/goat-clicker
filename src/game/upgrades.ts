import { BUILDINGS } from './buildings'
import type { BuildingId, GameState, UpgradeDef } from './types'

/**
 * Units owned of a building before its next upgrade tier appears. All tiers
 * sit below the first milestone at 200 on purpose: tiers that unlock deep into
 * the milestone ladder would reward pushing one cheap building forever.
 */
const TIER_THRESHOLDS = [1, 10, 25, 50, 100]
/** Tier cost as a multiple of the building's base cost, roughly what the units so far cost at 10% growth. */
const TIER_COST_FACTORS = [10, 50, 500, 5_000, 100_000]

/** Five upgrade tiers per building: [name, flavour text]. */
const TIERS: Record<BuildingId, [string, string][]> = {
  post: [
    ['Rougher Bark', 'The good kind of splinter, apparently.'],
    ['Second Post', 'Cuts the queue in half. The queue doubles.'],
    ['Rotating Brush', 'Car wash technology, goat wash pricing.'],
    ['The Perfect Angle', 'Found by accident. Guarded by a very smug goat.'],
    ['Queue Management', 'Take a number. The goats eat the numbers.'],
  ],
  meadow: [
    ['Clover Patches', 'Four leaves, statistically speaking.'],
    ['Rotational Grazing', 'The grass gets a weekend.'],
    ['Sprinkler Ring', 'Half irrigation, half water feature.'],
    ['Eternal Spring', 'The meadow has stopped acknowledging winter.'],
    ['Wildflower Edge', 'Bees moved in. The goats ate the bees\' flowers politely.'],
  ],
  barn: [
    ['Fresh Straw', 'Changed daily. Eaten hourly.'],
    ['Loft Ladder', 'For the goats who insist on the top shelf.'],
    ['Heated Floors', 'Underfloor warmth, overfloor sprawling.'],
    ['Barn Cathedral', 'Vaulted ceilings. Excellent bleat reverb.'],
    ['Second Storey', 'Goats upstairs. Goats downstairs. Goats on the stairs.'],
  ],
  dairy: [
    ['Copper Vats', 'Shinier milk is better milk. Somehow.'],
    ['Cave Ageing', 'Two years in the dark, worth every day.'],
    ['Rind Wax Robots', 'Tireless, precise, faintly smug.'],
    ['Cheese Singularity', 'A wheel so dense it has its own weather.'],
    ['Blue Veins', 'The good mould. Probably the good mould.'],
  ],
  yoga: [
    ['Thicker Mats', 'Absorbs hooves and dignity alike.'],
    ['Sunrise Sessions', 'Nobody is a morning person. The goats are.'],
    ['Celebrity Instructor', 'Was famous once. Is now mostly stood on.'],
    ['Transcendent Downward Goat', 'The pose holds you.'],
    ['Hot Goat Yoga', 'Same goats, warmer room, damper humans.'],
  ],
  ranch: [
    ['Switchback Trails', 'The long way up, taken at a sprint.'],
    ['Cliffside Salt Licks', 'Placed impossibly. Reached anyway.'],
    ['Cable Car', 'The goats ride on the roof.'],
    ['Summit Deed', 'You own the mountain. The goats own you.'],
    ['Alpine Huts', 'Warm, dry, and standing on by morning.'],
  ],
  lab: [
    ['Sharper Pipettes', 'Fewer spills, more goats.'],
    ['Redundant Genomes', 'Two copies of everything, stubbornness included.'],
    ['Batch Incubators', 'Ninety-six kids at a time, all shouting.'],
    ['Recursive Kids', 'Each goat contains a slightly smaller goat.'],
    ['Gene Library', 'Every goat ever, alphabetised by stubbornness.'],
  ],
  portal: [
    ['Stabilised Rim', 'No more goats arriving inside-out.'],
    ['Two-Way Traffic', 'Something is grazing on the other side, too.'],
    ['Wider Aperture', 'Now admits the really enormous ones.'],
    ['Portal Network', 'Every pasture, one hop away.'],
    ['Frequent Flyer Herd', 'Loyalty points redeemable in hay.'],
  ],
  temple: [
    ['Brass Cowbells', 'Tuned to the sacred pitch of complaint.'],
    ['Harmonic Nave', 'One bleat, held for a liturgical hour.'],
    ['Choir of a Thousand', 'Not one note between them. It works.'],
    ['The Long Note', 'Begun generations ago. Not yet finished.'],
    ['Bell Tower', 'Rings at dawn. The goats ring it. Dawn is negotiable.'],
  ],
  cosmos: [
    ['Orbital Fodder', 'Hay, in a slowly decaying orbit.'],
    ['Gravity Wells', 'Keeps the herd from wandering off past Neptune.'],
    ['Nebula Pastures', 'Grazing measured in light-years.'],
    ['Galactic Stampede', 'Visible from other galaxies.'],
    ['Comet Fodder', 'Frozen hay, delivered on a very long orbit.'],
  ],
  circle: [
    ['Beeswax Candles', 'Burn slower. Smell faintly of hay.'],
    ['Chalk of the Old Farm', 'Ground from the first fence post ever chewed.'],
    ['Thirteenth Goat', 'Stands in the middle. Knows why.'],
    ['Closed Circle', 'Nobody remembers opening it.'],
    ['Twenty-Six Candles', 'Twice the light. The same hum, an octave lower.'],
  ],
  void: [
    ['Fence Around Nothing', 'Purely ceremonial. The goats respect the gesture.'],
    ['Echo Feeders', 'The hay comes back louder.'],
    ['Gravity Optional', 'Grazing on the ceiling of the universe.'],
    ['Deeper Pasture', 'The grass goes all the way down.'],
    ['Nothing, Fenced Twice', 'Belt and braces, around an absence.'],
  ],
  elder: [
    ['Offerings of Clover', 'It accepts. It does not thank.'],
    ['The Long Memory', 'It remembers every gate you ever left open.'],
    ['Horns of the First Dawn', 'Older than the mountains they were measured against.'],
    ['It Blinks', 'Once a century. You were looking.'],
    ['Old Grudges Settled', 'It forgave the first fence. It has not forgotten it.'],
  ],
}

function buildingUpgrades(): UpgradeDef[] {
  const out: UpgradeDef[] = []
  for (const b of BUILDINGS) {
    TIERS[b.id].forEach(([name, blurb], i) => {
      const need = TIER_THRESHOLDS[i]
      out.push({
        id: `${b.id}-t${i + 1}`,
        name,
        icon: b.icon,
        // A getter, so a retuned base cost (the balance simulator does this) carries through.
        get cost() {
          return Math.ceil(b.baseCost * TIER_COST_FACTORS[i])
        },
        desc: `${b.name} production doubled.`,
        blurb,
        kind: 'building',
        building: b.id,
        tier: i + 1,
        effect: { type: 'buildingMult', building: b.id, factor: 2 },
        unlocked: (s) => s.buildings[b.id] >= need,
      })
    })
  }
  return out
}

const CLICK_UPGRADES: UpgradeDef[] = [
  {
    id: 'click-handshake',
    name: 'Firm Handshake',
    icon: '🤝',
    cost: 100,
    desc: 'Each pet gathers 1 extra goat.',
    blurb: 'Goats respect confidence. Goats respect very little else.',
    kind: 'click',
    effect: { type: 'clickFlat', amount: 1 },
    unlocked: (s) => s.clicks >= 15,
  },
  {
    id: 'click-scritch',
    name: 'Scritch Behind the Ears',
    icon: '💅',
    cost: 750,
    desc: 'Petting is 25% more effective.',
    blurb: 'The one spot they cannot reach themselves.',
    kind: 'click',
    effect: { type: 'clickMult', factor: 1.25 },
    unlocked: (s) => s.clicks >= 50,
  },
  {
    id: 'click-hoof',
    name: 'Hoof Trimmer',
    icon: '✂️',
    cost: 15_000,
    desc: 'Petting is 25% more effective.',
    blurb: 'A tidy hoof is a productive hoof.',
    kind: 'click',
    effect: { type: 'clickMult', factor: 1.25 },
    unlocked: (s) => s.clicks >= 200,
  },
  {
    id: 'click-salt',
    name: 'Salt Lick',
    icon: '🧂',
    cost: 500_000,
    desc: 'Petting is 25% more effective.',
    blurb: 'They will queue for it. They will not queue politely.',
    kind: 'click',
    effect: { type: 'clickMult', factor: 1.25 },
    unlocked: (s) => s.clicks >= 500,
  },
  {
    id: 'click-beard',
    name: 'Prize-Winning Beard',
    icon: '🥇',
    cost: 50_000_000,
    desc: 'Petting is 25% more effective.',
    blurb: 'Yours, not theirs. They were unimpressed.',
    kind: 'click',
    effect: { type: 'clickMult', factor: 1.25 },
    unlocked: (s) => s.clicks >= 2_000,
  },
  {
    id: 'click-whisperer',
    name: 'Goat Whisperer',
    icon: '🗣️',
    cost: 1_000_000,
    desc: 'Petting gathers an extra 0.5% of your goats per second.',
    blurb: 'You do not whisper to the goats. You whisper about them.',
    kind: 'click',
    effect: { type: 'clickFromCps', percent: 0.5 },
    unlocked: (s) => s.totalGoats >= 500_000,
  },
  {
    id: 'click-telepathy',
    name: 'Herd Telepathy',
    icon: '🔮',
    cost: 200_000_000,
    desc: 'Petting gathers an extra 1% of your goats per second.',
    blurb: 'Mostly you receive their opinions about the gate.',
    kind: 'click',
    effect: { type: 'clickFromCps', percent: 1 },
    unlocked: (s) => s.upgrades.includes('click-whisperer'),
  },
  {
    id: 'click-ancients',
    name: 'Bleat of the Ancients',
    icon: '📜',
    cost: 20_000_000_000,
    desc: 'Petting gathers an extra 2% of your goats per second.',
    blurb: 'The first goat said it. Every goat since has repeated it.',
    kind: 'click',
    effect: { type: 'clickFromCps', percent: 2 },
    unlocked: (s) => s.upgrades.includes('click-telepathy'),
  },
]

const GOLDEN_UPGRADES: UpgradeDef[] = [
  {
    id: 'golden-clover',
    name: 'Lucky Clover',
    icon: '🍀',
    cost: 777_777,
    desc: 'Golden goats wander in 50% more often.',
    blurb: 'Found it in a field. Ate it immediately. Worked anyway.',
    kind: 'golden',
    effect: { type: 'goldenFreq', factor: 1.5 },
    unlocked: (s) => s.goldenClicks >= 1,
  },
  {
    id: 'golden-bell',
    name: 'Golden Bell',
    icon: '🔔',
    cost: 77_777_777,
    desc: 'Golden goat rewards are 30% stronger.',
    blurb: 'Rings in a key that means good news.',
    kind: 'golden',
    effect: { type: 'goldenPower', factor: 1.3 },
    unlocked: (s) => s.goldenClicks >= 7,
  },
  {
    id: 'golden-prints',
    name: 'Gilded Hoofprints',
    icon: '✨',
    cost: 7_777_777_777,
    desc: 'Golden goats stay twice as long.',
    blurb: 'A trail of them, leading somewhere expensive.',
    kind: 'golden',
    effect: { type: 'goldenLife', factor: 2 },
    unlocked: (s) => s.goldenClicks >= 17,
  },
  {
    id: 'golden-midas',
    name: 'Midas Herd',
    icon: '👑',
    cost: 777_777_777_777,
    desc: 'Golden goat rewards are twice as strong.',
    blurb: 'Everything they chew turns to gold. They keep chewing.',
    kind: 'golden',
    effect: { type: 'goldenPower', factor: 2 },
    unlocked: (s) => s.goldenClicks >= 27,
  },
]

const GLOBAL_UPGRADES: UpgradeDef[] = [
  {
    id: 'global-farmhands',
    name: 'Farmhand Kids',
    icon: '🐑',
    cost: 9_000_000,
    desc: 'All production +1% per achievement earned.',
    blurb: 'They mean well. One of them is a sheep.',
    kind: 'global',
    effect: { type: 'globalPerAchievement', percent: 1 },
    unlocked: (s) => s.achievements.length >= 5,
  },
  {
    id: 'global-dog',
    name: 'Herding Dog',
    icon: '🐕',
    cost: 900_000_000,
    desc: 'All production +2% per achievement earned.',
    blurb: 'Knows the job. Deeply tired of the job.',
    kind: 'global',
    effect: { type: 'globalPerAchievement', percent: 2 },
    unlocked: (s) => s.achievements.length >= 12,
  },
  {
    id: 'global-choir',
    name: 'Alpine Choir',
    icon: '🎶',
    cost: 90_000_000_000,
    desc: 'All production +3% per achievement earned.',
    blurb: 'Yodelling, except the goats take the high part.',
    kind: 'global',
    effect: { type: 'globalPerAchievement', percent: 3 },
    unlocked: (s) => s.achievements.length >= 20,
  },
]

/**
 * Bought with occult points instead of goats, and kept through ascension.
 * `requires` names the upgrade that has to be owned first, so they form a
 * short tree rather than a flat shop.
 */
function occult(
  def: Omit<UpgradeDef, 'kind' | 'unlocked'>,
): UpgradeDef {
  return {
    ...def,
    kind: 'occult',
    unlocked: (s) => !def.requires || s.upgrades.includes(def.requires),
  }
}

export const OCCULT_UPGRADES: UpgradeDef[] = [
  occult({
    id: 'occult-candle',
    name: 'Tallow Candle',
    icon: '🕯️',
    cost: 1,
    desc: 'All production +50%.',
    blurb: 'Rendered from a goat that volunteered. Allegedly.',
    effect: { type: 'globalMult', factor: 1.5 },
  }),
  occult({
    id: 'occult-ashes',
    name: 'Ashes of the Old Farm',
    icon: '⚱️',
    cost: 3,
    requires: 'occult-candle',
    desc: 'Start every ascension with 10,000 goats.',
    blurb: 'Scattered over the new pasture. The grass comes up already chewed.',
    effect: { type: 'startGoats', amount: 10_000 },
  }),
  occult({
    id: 'occult-sigil',
    name: 'Hoofprint Sigil',
    icon: '✴️',
    cost: 2,
    requires: 'occult-candle',
    desc: 'Petting is three times as effective.',
    blurb: 'Drawn in the mud by a goat that knew exactly what it was doing.',
    effect: { type: 'clickMult', factor: 3 },
  }),
  occult({
    id: 'occult-grimoire',
    name: 'Grimoire of Bleats',
    icon: '📕',
    cost: 3,
    requires: 'occult-candle',
    desc: 'Each unspent occult point grants an extra 3% production, on top of the usual 10%.',
    blurb: 'Every page says the same word. The meaning changes with the reader.',
    effect: { type: 'occultPercent', percent: 3 },
  }),
  occult({
    id: 'occult-lantern',
    name: 'Lantern in the Fog',
    icon: '🏮',
    cost: 3,
    requires: 'occult-candle',
    desc: 'Golden goats stay 50% longer.',
    blurb: 'They are drawn to the light. So is everything else.',
    effect: { type: 'goldenLife', factor: 1.5 },
  }),
  occult({
    id: 'occult-hourglass',
    name: 'Bottomless Hourglass',
    icon: '⏳',
    cost: 5,
    requires: 'occult-ashes',
    desc: 'Time away pays at full rate instead of half.',
    blurb: 'The sand runs out. Then it keeps running.',
    effect: { type: 'offlineRate', factor: 2 },
  }),
  occult({
    id: 'occult-bell',
    name: 'Black Bell',
    icon: '🪬',
    cost: 6,
    requires: 'occult-lantern',
    desc: 'Golden goats wander in 30% more often.',
    blurb: 'Rings once, somewhere behind you.',
    effect: { type: 'goldenFreq', factor: 1.3 },
  }),
  occult({
    id: 'occult-moon',
    name: 'Lunar Calendar',
    icon: '🌙',
    cost: 8,
    requires: 'occult-hourglass',
    desc: 'Time away counts for up to twelve hours instead of three.',
    blurb: 'Every phase is marked as a good night for grazing.',
    effect: { type: 'offlineCap', factor: 4 },
  }),
  occult({
    id: 'occult-eye',
    name: 'The Watching Eye',
    icon: '👁️',
    cost: 8,
    requires: 'occult-grimoire',
    desc: 'Each unspent occult point grants an extra 5% production.',
    blurb: 'It does not blink. It does not need to.',
    effect: { type: 'occultPercent', percent: 5 },
  }),
  occult({
    id: 'occult-crown',
    name: 'Horned Crown',
    icon: '👑',
    cost: 12,
    requires: 'occult-sigil',
    desc: 'Petting is three times as effective.',
    blurb: 'Heavy. Pointy. Yours now.',
    effect: { type: 'clickMult', factor: 3 },
  }),
  occult({
    id: 'occult-covenant',
    name: 'Covenant of the Herd',
    icon: '📜',
    cost: 12,
    requires: 'occult-eye',
    desc: 'All production tripled.',
    blurb: 'Signed in hoofprints. Binding in every pasture.',
    effect: { type: 'globalMult', factor: 3 },
  }),
  occult({
    id: 'occult-eclipse',
    name: 'Eclipse',
    icon: '🌑',
    cost: 15,
    requires: 'occult-covenant',
    desc: 'Each unspent occult point grants an extra 10% production.',
    blurb: 'The sun stepped aside. The herd did not notice.',
    effect: { type: 'occultPercent', percent: 10 },
  }),
]

export const UPGRADES: UpgradeDef[] = [
  ...buildingUpgrades(),
  ...CLICK_UPGRADES,
  ...GOLDEN_UPGRADES,
  ...GLOBAL_UPGRADES,
  ...OCCULT_UPGRADES,
]

export const UPGRADE_BY_ID = new Map<string, UpgradeDef>(UPGRADES.map((u) => [u.id, u]))

/** Goat-priced upgrades the player can see but has not bought, cheapest first. */
export function availableUpgrades(state: GameState): UpgradeDef[] {
  return UPGRADES.filter(
    (u) => u.kind !== 'occult' && !state.upgrades.includes(u.id) && u.unlocked(state),
  ).sort((a, b) => a.cost - b.cost)
}
