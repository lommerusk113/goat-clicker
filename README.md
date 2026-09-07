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
- **Buildings** produce goats on their own. Each unit costs 15% more than the
  last, from the Goat Pen at 15 goats up to the Cosmic Herd at 75 billion.
- **Upgrades** come in four families: four tiers per building (each doubling
  that building's output), petting upgrades, golden-goat upgrades, and
  herd-wide upgrades that scale with how many achievements you have earned.
- **Golden goats** wander across the screen every minute or three. Catching one
  pays a lump sum, or starts a Frenzy (×7 production) or a Petting Frenzy
  (×777 per pet).
- **Achievements** are awarded the moment their condition is met, and feed the
  herd-wide upgrades.
- **Saving** happens every ten seconds, when the tab is hidden, and on close.
  Time away pays out at half rate, capped at three hours. The Settings tab has
  save codes for moving a game between browsers.

## Layout of the code

```
src/
  game/          no DOM in here; all of it is unit tested
    types.ts        shared shapes
    buildings.ts    the ten production lines
    upgrades.ts     every upgrade, including generated building tiers
    achievements.ts every achievement and its condition
    economy.ts      costs, production, per-click, aggregate stats
    state.ts        the game state and the moves you can make on it
    save.ts         encode, decode, migrate, offline earnings
    golden.ts       golden goat timing and rewards
    loop.ts         the tick/render split
  ui/            no game rules in here
    format.ts       number and duration formatting
    store.ts        buildings and upgrades
    panels.ts       achievements and stats
    render.ts       the pasture, and wiring for everything else
    tooltip.ts, particles.ts, toast.ts, dom.ts
  main.ts        loads the save, runs the loop, connects game to interface
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
