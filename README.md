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
- **Gilds** are handed out one for every five occult points ever earned, on a
  random building you owned that run, so ascending for single points earns no
  extra gilds. Each gild doubles that building's output for good, and they
  stack additively, so the late game is about piling them onto one building.
  From the Ascend tab a gild can be rerolled onto a random other building for
  one occult point, or placed exactly for twenty.
- **Upgrades** come in five families: five tiers per building at 1, 10, 25, 50
  and 100 owned (each doubling that building's output, and its click bonus if
  it has one), petting upgrades, golden-goat upgrades, herd-wide upgrades that
  scale with how many achievements you have earned, and occult upgrades bought
  with occult points.
- **Ascending** sells the farm for occult points: goats, buildings and ordinary
  upgrades go, achievements and occult upgrades stay. Points grow with the
  logarithm of every goat you have ever herded past ten billion, five per
  tenfold: five at 100 billion, ten at a trillion, twenty-five at a
  quadrillion. Each unspent point adds 10% to all production, so spending
  points on occult upgrades or gild moves is a real trade. Simulated over 400
  hours, a player who spends only on production upgrades reaches the Elder Goat
  at 105h, one who never spends at 167h, and one who also buys petting upgrades
  and rerolls gilds freely at 224h. The log is deliberate: milestones make a
  run's output grow like a high power of that bonus, and a cube-root scale on
  top of it runs away. Occult upgrades form a small tree that also covers
  starting goats, golden-goat timing, and offline earnings.
- **Golden goats** wander in every five to fifteen minutes, the first after
  five, and stay for forty seconds, so checking in now and then is enough to
  catch them. Catching one usually pays a lump sum (55%), or starts a Frenzy
  (×7 production and petting, 40%), or rarely a Petting Frenzy (×777 per pet,
  5%). The two frenzies stack. The
  rarity matters: simulated at the old two-to-seven-minute spawn with a 15%
  Petting Frenzy, golden goats paid out four times the whole economy in the
  first hour.
- **Achievements** are awarded the moment their condition is met, and feed the
  herd-wide upgrades. Every building has badges at 50, 100, 200, 300, 400 and
  500 owned.
- **Saving** happens every ten seconds, when the tab is hidden, and on close.
  Time away pays out at half rate, capped at three hours, until occult upgrades
  raise both. The Settings tab has save codes for moving a game between
  browsers.
- **Cloud sync** is optional and needs no account. Turning it on in Settings
  mints a random sync code; entering that code on another device links it to
  the same herd. The save is pushed once a minute and when the tab hides, and
  pulled on load. Whichever device saved last wins, and a stale device is never
  allowed to overwrite a newer cloud save. The code is the only key, so treat it
  like a password.

## Hosting and cloud sync

The site is a static Vite build hosted on Cloudflare Pages. Cloud sync is a
Pages Function in `functions/api/save/[token].ts` that stores one save blob per
sync code in a KV namespace bound as `SAVES`. One-time setup:

```bash
npx wrangler kv namespace create SAVES   # prints an id
```

Paste the id into `wrangler.toml`, or bind it in the dashboard under the Pages
project's Settings → Bindings. Without the binding the site still works; the
sync buttons just report a failed connection. To run the function locally:

```bash
npm run build && npx wrangler pages dev dist
```

## Layout of the code

```
src/
  game/          no DOM in here; all of it is unit tested
    types.ts        shared shapes
    buildings.ts    the thirteen production lines
    upgrades.ts     every upgrade, including generated building tiers
    achievements.ts every achievement and its condition
    economy.ts      costs, production, per-click, aggregate stats
    state.ts        the game state and the moves you can make on it, ascension included
    save.ts         encode, decode, migrate, offline earnings
    golden.ts       golden goat timing and rewards
    loop.ts         the tick/render split
  ui/            no game rules in here
    format.ts       number and duration formatting
    store.ts        buildings and upgrades
    panels.ts       achievements and stats
    ascend.ts       occult points, the ascend button, occult upgrades
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
