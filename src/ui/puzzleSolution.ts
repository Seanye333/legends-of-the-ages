// 把斩杀求解器给出的命令序列翻成人话,供「展示解法」列出步骤。
// 逐条应用以推进模拟,好在每一步用当时的场上状态解析 iid → 名字。
import type { CardLibrary, Command, GameState, PlayerIdx, TargetRef } from '../engine/types'
import { applyCommand } from '../engine/reducer'
import type { LocalizedText } from '../engine/types'

type Pick = (t: LocalizedText) => string
type T = (zh: string, en: string) => string

function unitName(state: GameState, iid: number, lib: CardLibrary, pick: Pick): string {
  for (const p of state.players) {
    const u = p.board.find((c) => c.iid === iid)
    if (u) return pick(lib[u.defId]?.name ?? { zh: u.defId, en: u.defId })
  }
  return '?'
}

function targetText(
  ref: TargetRef | undefined,
  state: GameState,
  me: PlayerIdx,
  lib: CardLibrary,
  pick: Pick,
  t: T,
): string {
  if (!ref) return ''
  if (ref.kind === 'hero') {
    return ref.player === me ? t(' → 己方主公', ' → your hero') : t(' → 敌方主公', ' → enemy hero')
  }
  return ` → 「${unitName(state, ref.iid, lib, pick)}」`
}

function describeOne(
  cmd: Command,
  state: GameState,
  me: PlayerIdx,
  lib: CardLibrary,
  pick: Pick,
  t: T,
): string {
  switch (cmd.type) {
    case 'PlayCard': {
      const c = state.players[me].hand.find((h) => h.iid === cmd.iid)
      const name = c ? pick(lib[c.defId]?.name ?? { zh: c.defId, en: c.defId }) : '?'
      return t('出', 'Play ') + `「${name}」` + targetText(cmd.target, state, me, lib, pick, t)
    }
    case 'Attack':
      return (
        `「${unitName(state, cmd.attackerIid, lib, pick)}」` +
        t(' 攻击', ' attacks') +
        targetText(cmd.target, state, me, lib, pick, t)
      )
    case 'UseHeroPower': {
      const hp = state.players[me].heroPower
      const name = hp ? pick(hp.name) : t('主公技', 'hero power')
      return t('主公技', 'Hero power') + `「${name}」` + targetText(cmd.target, state, me, lib, pick, t)
    }
    case 'ResolveChoice':
      return t(`发现:选第 ${cmd.index + 1} 项`, `Discover: pick #${cmd.index + 1}`)
    default:
      return cmd.type
  }
}

export function describeSolution(
  state: GameState,
  me: PlayerIdx,
  line: Command[],
  lib: CardLibrary,
  pick: Pick,
  t: T,
): string[] {
  const steps: string[] = []
  let s = state
  for (const cmd of line) {
    steps.push(describeOne(cmd, s, me, lib, pick, t))
    const r = applyCommand(s, me, cmd, lib)
    if (!r.ok) break
    s = r.state
  }
  return steps
}
