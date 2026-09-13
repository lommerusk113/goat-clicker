# Goat Clicker

An idle game about accumulating an unreasonable number of goats. Pet the goat,
buy buildings, buy upgrades, come back later to a much larger herd.

## Running it

```bash
npm install
npm run dev      # play at the URL it prints
npm test         # game-logic tests
npm run build    # typecheck + production bundle into dist/
```

No framework and no runtime dependencies — Vite, TypeScript and Vitest are the
only packages, and all of them are dev-only.

## How the game works

- **Petting** gathers one goat, plus whatever the petting upgrades add. Later
  upgrades make each pet worth a percentage of your per-second production.
- **Buildings** produce goats on their own. Each unit costs 10% more than the
  last, from the Scratching Post at 15 goats up to the Elder Goat at 2.5
  quadrillion. The Scratching Post also adds a little to every pet, so early
  clicking and early buildings feed each other; that bonus grows with the Post's
  tiers and gilds but not its milestones. Clicking is a small boost, not a
  strategy: a simulated player petting five times a second for 24 hours ends
  about 10% ahead of one who barely pets, and a hybrid buyer beats a click-only
  one. Each building costs about 2.4 times more per goat-per-second than the
  one before. The last three are priced far beyond one run's production; the
  occult bonus from a few ascensions puts them in reach.
- **Milestones** kick in at 200 of a building: its output quadruples there and
  every 25 after, and every thousandth is worth ten times instead. A ×4 for
  ×10.8 in price means each block is a worse deal than the last, so pushing an
  old building deep is a choice, not a default; gilds are what make one shine.
  `VITE_SIM=1 npx vitest run src/game/sim.test.ts` prints what a greedy buyer
  owns over time, for checking that balance after changes.
- **Renown** pays the whole herd 0.25% more, compounding, for every milestone
  crossed anywhere. Without it the cheap lines are decorative forever: buying
  by payback holds all thirteen within a couple of hundred units of each
  other, so they cross every milestone together and the ladder cancels out of
  the comparison — a line ends up producing its share of what you can spend on
  it, and the Scratching Post's share is a millionth of the Elder Goat's. Since
  milestones only exist past 200 owned, which no building reaches before all
  thirteen are unlocked and deep, nothing about the early game changes. At
  Elder Goat 300 a block on an old line pays 62 times what a block on the Elder
  Goat pays, while the tier directly below is left at parity.
- **Gilds** are handed out on a random building you owned that run: the first
  at five occult points ever earned, then one each time that total grows by
  half (5, 7.5, 11, 17, 25, 38, 57 …), so ascending for single points earns
  no extra gilds and the count stays around the log of your points, about
  seventeen by three thousand. Each gild doubles that building's output for
  good, and they stack additively, so the late game is about piling them onto
  one building. From the Ascend tab a gild can be rerolled onto a random other
  building for one occult point, or placed exactly for twenty.
- **Upgrades** come in five families: five tiers per building at 1, 10, 25, 50
  and 100 owned (each doubling that building's output, and its click bonus if
  it has one), petting upgrades, golden-goat upgrades, herd-wide upgrades that
  scale with how many achievements you have earned. Occult points do not buy
  upgrades; they level relics.
- **Ascending** sells the farm for occult points: goats, buildings and ordinary
  upgrades go, achievements and relics stay. Points are four and a half times
  the sixth root of every goat you have ever herded in units of ten billion:
  six at 100 billion, nine at a trillion, 30 at a quadrillion, 96 at 1e18,
  450 at 1e22. A root rather than a log, because the log made every point take a
  third longer than the last and the game stalled at around two hundred
  hours. The sixth root rather than Cookie Clicker's cube because the bonus
  here is 15% per point and a run's output grows like a high power of that
  bonus once milestones kick in: on the fourth root a relic-spending player
  ran away in the simulator at seventy hours, and the sixth is the first root
  at which every build stays finite. Each unspent point adds 15% to all
  production, so spending points on relics or gild moves is a real trade;
  it was 10%, raised to shorten the flat stretch after the first ascension
  (cheaper buildings did the same job but sent the idle spender into
  exponential growth, so the bonus is the knob). Simulated over 400 hours, a
  player who spends only on production ascends first at 10h, reaches the
  Elder Goat at 90h and earns 1,078 points, 623 of them in the first two
  hundred hours and 455 in the second; one who never spends earns 488.
  Points still slow down late, but polynomially: at 400h a point takes about
  twenty minutes, against twenty-eight hours on the old curve.
- **Relics** are the occult tree: seven of them, levelled without limit rather
  than bought once. Level L costs `costStep × 2^L` points, rounded up, so
  levels arrive at the log of what a relic has swallowed. That shape is the
  whole design: points are a root of lifetime goats and a run's output grows
  like the occult bonus to the 2.4, so a compounding relic has to hand out
  levels as the log of points or the game runs away. Geometric pricing makes
  a relic's whole effect a modest power of points earned (the Candle is
  `points^0.32`), while every unspent point still pays its flat 15%, so the
  last levels of any ladder are a real trade.

  A relic's worth per point runs as `ln(factor)/ln(costRatio)`, and two relics
  that multiply the same income have to come out level on that measure or the
  better one wins by a margin that grows with every point earned. The Hourglass
  costs 3.5× a level rather than 2× for exactly that reason: at ×1.5 a level
  it would otherwise leave the Candle behind, and idle would stop being a
  choice. Relics that move only a slice of income — the Sigil, on petting
  alone — are deliberately allowed a better raw rate.
- **Idle** means no pet for two minutes, as in Clicker Heroes, not the tab being
  closed. The Bottomless Hourglass multiplies all production while the herd is
  left alone, and nothing else does, so leaving the game running is a build
  rather than a consolation. An idle herd shrugs off five stray pets before
  the sixth resets the clock, so a slip of the finger costs nothing. Every pet
  is priced as if the herd were busy, so a pet never collects the bonus. Time away is idle by
  definition, which is how the relic also improves what the tab earns while
  closed. Simulated over 400 hours against the same spending policy, the idle
  build earns 1,518 points to the petting build's 1,078: ahead, because the
  Hourglass is one more ladder to spread across, but not by enough to make
  petting a mistake.
- **Golden goats** wander in every two and a half to seven and a half
  minutes, the first after five, and stay for forty seconds, so checking in
  now and then is enough to catch some. Catching one usually pays a lump sum
  (55%), or starts a Frenzy (×7 production and petting for a minute, 40%), or
  rarely a Petting Frenzy (×777 per pet for thirteen seconds, 5%). The two
  frenzies stack, but neither is ever drawn while it is already running: its
  share goes to whatever is left, so no goat is caught for nothing. That only
  bites once the Lantern is levelled, which shortens the wait and lengthens the
  frenzy at the same time until they overlap — at four levels better than a
  third of the goats caught were repeats of a frenzy already going, and
  refreshing it looked to the player like catching a goat that did nothing. They used to come half as often with a 77-second Frenzy;
  the rate was doubled and the Frenzy shortened so that a player who catches
  them all earns about half again as much as one who ignores them while an
  idler gains around 15%: attention is meant to pay. The odds matter too:
  simulated at this spawn rate with a 15% Petting Frenzy, golden goats paid
  out four times the whole economy in the first hour.
- **Achievements** are awarded the moment their condition is met, and feed the
  herd-wide upgrades. Every building has badges at 50, 100, 200, 300, 400 and
  500 owned. Because three upgrades pay a percentage per achievement, one that
  cannot be earned is lost production rather than a missing badge, so the
  thresholds are counted off the tables they refer to where they can be: the
  last upgrade badge asks for `UPGRADES.length`, having twice outlived a number
  written down by hand.
- **Saving** happens every ten seconds, when the tab is hidden, and on close.
  Time away pays out at half rate, capped at three hours, at whatever idle
  multiplier the Hourglass is granting. The Settings tab has save codes for moving a game between
  browsers.
- **Cloud sync** is optional and needs no account. Turning it on in Settings
  mints a random sync code; entering that code on another device links it to
  the same herd. The save is pushed every ten minutes, when the tab hides, and
  on an ascension, and pulled on load and whenever the tab comes back into
  view. Writes are metered (see below), so no two are sent within five minutes
  of each other unless the player asked for one outright — linking a code,
  selling the farm, ascending.

  Each device remembers which cloud save it last saw; a push is refused when
  another device has saved since, and the pusher considers that save instead.
  It only adopts one that has got at least as far: neither occult points earned
  nor goats ever counted can fall while a herd is played, so a save behind on
  either is an older copy of the same herd — typically this device's own, from
  a push whose acknowledgement never arrived — and adopting it would undo
  whatever happened since, an ascension most visibly. An older copy is marked
  seen and then written over by the next push. A save that started on a
  different day is a different herd rather than an older copy, so selling the
  farm still reaches every device, and linking to a code always joins that
  herd. The code is the only key, so treat it like a password.

## Hosting and cloud sync

The site is a static Vite build hosted on Cloudflare Pages. Cloud sync is a
Pages Function in `functions/api/save/[token].ts` that stores one save blob per
sync code in a KV namespace bound as `SAVES`. One-time setup:

```bash
npx wrangler kv namespace create SAVES   # prints an id
```

Paste the id into `wrangler.toml`, or bind it in the dashboard under the Pages
project's Settings → Bindings. Without the binding the site still works; the
sync buttons just report a failed connection.

The KV free tier allows 1,000 writes a day across every player, which is what
sets the push cadence above: a tab open all day costs a few dozen writes rather
than the several hundred a one-minute push would. Reads are capped far higher,
at 100,000 a day, so pulling is cheap by comparison. To run the function
locally:

```bash
npm run build && npx wrangler pages dev dist
```

## Layout of the code

```
src/
  game/          no DOM in here; all of it is unit tested
    types.ts        shared shapes
    buildings.ts    the thirteen production lines
    upgrades.ts     every goat-bought upgrade, including generated building tiers
    relics.ts       the seven occult relics, their prices and their effects
    achievements.ts every achievement and its condition
    economy.ts      costs, production, per-click, aggregate stats
    state.ts        the game state and the moves you can make on it, ascension included
    save.ts         encode, decode, migrate, time-away earnings
    golden.ts       golden goat timing and rewards
    loop.ts         the tick/render split
  ui/            no game rules in here
    format.ts       number and duration formatting
    store.ts        buildings and upgrades
    panels.ts       achievements and stats
    ascend.ts       occult points, the ascend button, relics and gilds
    render.ts       the pasture, and wiring for everything else
    tooltip.ts, particles.ts, toast.ts, dom.ts
  sync.ts        cloud save client: sync codes, pull, push
  main.ts        loads the save, runs the loop, connects game to interface
functions/
  api/save/[token].ts   the cloud save endpoint (Cloudflare Pages Function)
  style.css
```

The split that matters: **`game/` never touches the DOM and `ui/` never
changes game state.** The interface asks the game to do something and gets
back a number; everything it draws comes from `GameState` plus the derived
`Stats`.

### The one non-obvious decision

The economy runs on a `setInterval` measured against the wall clock, while
drawing runs on `requestAnimationFrame`. Browsers pause animation frames for
tabs that are not visible, so an idle game driven purely by frames stops
earning the moment you switch tabs. Timers keep firing (throttled, but they
fire), and because each tick asks the clock how long it has actually been, a
throttled tab earns exactly the same as a focused one.
