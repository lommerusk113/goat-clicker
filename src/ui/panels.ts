import { ACHIEVEMENTS } from '../game/achievements'
import { BALANCE } from '../game/balance'
import { pendingOccult } from '../game/state'
import { UPGRADES } from '../game/upgrades'
import type { AchievementDef, GameState, Stats } from '../game/types'
import { byId, el, setText, toggleClass } from './dom'
import { formatGoats, formatRate, formatShort, formatTime } from './format'
import type { Tooltip } from './tooltip'

export interface Panels {
  update(state: GameState, stats: Stats): void
}

interface Badge {
  def: AchievementDef
  node: HTMLElement
}

export function createPanels(tooltip: Tooltip): Panels {
  const badgeGrid = byId('badge-grid')
  const tallyNode = byId('achievement-tally')
  const statsList = byId('stats-list')

  let state: GameState | null = null

  const badges: Badge[] = ACHIEVEMENTS.map((def) => {
    const node = el('div', 'badge', def.icon)
    tooltip.attach(node, () => ({
      icon: def.icon,
      name: def.name,
      desc: def.desc,
      stats: [state?.achievements.includes(def.id) ? 'Earned' : 'Not yet earned'],
    }))
    badgeGrid.append(node)
    return { def, node }
  })

  function row(key: string, value: string): [HTMLElement, HTMLElement] {
    return [el('dt', 'stats__key', key), el('dd', 'stats__value', value)]
  }

  function section(title: string): HTMLElement {
    return el('p', 'stats__head', title)
  }

  function drawStats(s: GameState, stats: Stats) {
    const byHand = s.totalGoats > 0 ? (s.goatsFromClicks / s.totalGoats) * 100 : 0

    statsList.replaceChildren(
      section('Herd'),
      ...row('Goats in the herd', formatGoats(s.goats)),
      ...row('Herded all-time', formatGoats(s.totalGoats)),
      ...row('Per second', formatRate(stats.gps)),
      ...row('Per pet', formatRate(stats.perClick)),

      section('Petting'),
      ...row('Pets', s.clicks.toLocaleString('en-US')),
      ...row('Gathered by hand', formatGoats(s.goatsFromClicks)),
      ...row('Share by hand', `${byHand.toFixed(1)}%`),

      section('Idle'),
      ...row(
        'Herd left alone',
        stats.idleIn > 0 ? `in ${formatTime(Math.ceil(stats.idleIn))}` : 'yes, right now',
      ),
      ...row('Idle bonus', stats.idleMult > 1 ? `×${stats.idleMult.toFixed(2)}` : 'none yet'),
      ...(stats.idleIn > 0 ? [] : row('Stray pets before it counts', `${BALANCE.idleGracePets - s.idlePets}`)),

      section('Farm'),
      ...row('Buildings owned', stats.buildingsOwned.toLocaleString('en-US')),
      ...row('Upgrades bought', `${s.upgrades.length} of ${UPGRADES.length}`),
      ...row('Herd-wide bonus', `×${stats.globalMult.toFixed(2)}`),
      ...row(
        'Renown',
        stats.renown > 0
          ? `${stats.renown} milestone${stats.renown === 1 ? '' : 's'}, ×${stats.renownMult.toFixed(2)}`
          : 'none yet',
      ),

      section('Luck'),
      ...row('Golden goats caught', s.goldenClicks.toLocaleString('en-US')),

      section('Ascension'),
      ...row('Ascensions', s.ascensions.toLocaleString('en-US')),
      ...row('Occult points', formatShort(s.occult)),
      ...row('Occult earned, all told', formatShort(s.occultEarned)),
      ...row('Waiting to be claimed', formatShort(pendingOccult(s))),
      ...row('Herded in past lives', formatGoats(s.lifetimeGoats)),

      section('Time'),
      ...row('Playing for', formatTime(s.playTime)),
      ...row('Started', new Date(s.startedAt).toLocaleDateString()),
    )
  }

  return {
    update(nextState, stats) {
      state = nextState

      for (const badge of badges) {
        const earned = nextState.achievements.includes(badge.def.id)
        toggleClass(badge.node, 'badge--earned', earned)
        toggleClass(badge.node, 'badge--locked', !earned)
      }
      setText(tallyNode, `${nextState.achievements.length}/${ACHIEVEMENTS.length}`)

      drawStats(nextState, stats)
    },
  }
}
