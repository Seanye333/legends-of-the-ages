// 伏兵:打出后进伏兵区,由**对手的**动作触发才翻开。
//
// 为什么单独一个文件:伏兵是引擎里第一个「一方的动作会跑另一方的脚本」的机制。
// reducer 与 combat 都要在自己的流程中间开一个口子调它,放在任一边都会形成循环依赖。
//
// 三条不变量(都在 pack4.test.ts 里有断言):
//   1. **一次动作最多翻一个伏兵。** 炉石规则,也是防连锁爆栈最简单的办法。
//   2. **伏兵脚本跑完立刻结算死亡。** 否则调用方(比如 performAttack)
//      会拿着一个已经死了的攻击者继续算伤害。
//   3. **伏兵在触发前先离开伏兵区。** 先移除再跑脚本 —— 万一脚本里又触发了
//      同类动作,它不会把自己再翻一次。
import type { CardLibrary, GameEvent, GameState, PlayerIdx, SecretTrigger, TargetRef } from './types'
import { findGeneral, other, processDeaths, runScript } from './resolve'

// 触发 owner 的伏兵。triggerIid 是触发者(攻击者 / 刚入场的敌将),
// 会作为 chosen 传进脚本,于是伏兵脚本里写 chosenEnemyGeneral 就指到它。
// 返回被翻开的伏兵 defId;没有触发则返回 null。
export function fireSecret(
  state: GameState,
  events: GameEvent[],
  lib: CardLibrary,
  owner: PlayerIdx,
  trigger: SecretTrigger,
  triggerIid?: number,
): string | null {
  const p = state.players[owner]
  if (p.secrets.length === 0) return null
  // 先进先出:先埋下的先触发,和玩家的直觉一致
  const idx = p.secrets.findIndex((s) => lib[s.defId]?.secret?.trigger === trigger)
  if (idx < 0) return null

  const secret = p.secrets[idx]
  const def = lib[secret.defId]
  if (!def?.secret) return null
  // 不变量 3:先离场再跑脚本
  p.secrets.splice(idx, 1)
  events.push({ type: 'SecretRevealed', player: owner, iid: secret.iid, defId: secret.defId })

  // 触发者可能在此之前已经死了(例如攻击者被另一个效果带走)
  const chosen: TargetRef | undefined =
    triggerIid !== undefined && findGeneral(state, triggerIid)
      ? { kind: 'general', iid: triggerIid }
      : undefined

  runScript(state, events, lib, def.secret.script, {
    player: owner,
    sourceDefId: secret.defId,
    chosen,
    kind: 'secret',
  })
  // 不变量 2
  processDeaths(state, events, lib)
  return secret.defId
}

// 对手的动作 → 触发对手的对手(也就是伏兵持有者)的伏兵。
// actor 是发起动作的一方。
export function fireEnemySecret(
  state: GameState,
  events: GameEvent[],
  lib: CardLibrary,
  actor: PlayerIdx,
  trigger: SecretTrigger,
  triggerIid?: number,
): string | null {
  return fireSecret(state, events, lib, other(actor), trigger, triggerIid)
}

// 伏兵区里已经埋了同名的一张吗(炉石规则:同名伏兵不能重复埋)
export function hasSecretNamed(state: GameState, player: PlayerIdx, defId: string): boolean {
  return state.players[player].secrets.some((s) => s.defId === defId)
}
