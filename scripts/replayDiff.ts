// 确定性对拍的判定层 —— 纯函数,不跑对局(运行器在 scripts/replay-diff.ts)。
//
// 【这道闸门看起来「没有判断」,其实有两处】
// 它的结论是「两次跑出来的东西逐位相等」,听上去没有阈值、没有分支,
// 所以一直排在抽出来的最后。真去读的时候发现有两处判断,而且都能静默失效:
//
//   1. **指纹取哪些字段**。`fingerprint` 现在是整份 `JSON.stringify(state)`,
//      于是它天然覆盖所有字段。但这件事**没有任何东西守着** ——
//      谁哪天嫌它慢,改成只取 `{turn, players, phase}`,对拍照样全绿,
//      而 `rng` 分叉、`nextIid` 分叉、新加的字段分叉全都查不出来。
//      指纹漏一个字段 = 这道闸门在那个维度上瞎了,**而且没有任何征兆**。
//      所以下面那份测试是**变异测试**:逐个字段改动一位,断言指纹一定跟着变。
//
//   2. **多少条命令才算「真的对拍过」**。一局对局怎么也该有几十条命令;
//      开局就断的那种录不到几条,它「通过」了但什么都没验。
//      这条门槛是个真数字(10),得能验它两个方向。
//
// 【为什么指纹必须包含 rng】
// 它是后续一切随机的来源。两个局面别处全同但 rng 不同,下一步就会分叉 ——
// 而那时候错的是**上一步**,现场早没了。
import type { GameState } from '../src/engine/types'

/**
 * 规范化的状态指纹。
 *
 * `JSON.stringify` 对同一个对象结构会产出同样的键顺序(引擎里所有状态都由
 * 同一批工厂函数造出来),所以直接拿它当指纹是安全的;真出问题时
 * 我们要的也正是「哪个字段不一样」,而字符串 diff 最容易读。
 *
 * **不要把它改成只取某几个字段。** 见文件头:那样做闸门会静默变瞎,
 * 而 replayDiff.test.ts 的变异测试就是拦这一手的。
 */
export function fingerprint(s: GameState): string {
  return JSON.stringify(s)
}

/** 两个指纹第一次分叉的位置,连同前后文 —— 分叉查的就是「哪个字段」。 */
export function firstDiff(a: string, b: string): string {
  const n = Math.min(a.length, b.length)
  let i = 0
  while (i < n && a[i] === b[i]) i++
  const from = Math.max(0, i - 60)
  return `偏移 ${i}\n  录制: …${a.slice(from, i + 80)}\n  重放: …${b.slice(from, i + 80)}`
}

/**
 * 一局至少要录到这么多条命令,才算「真的被对拍过」。
 * 一局正常对局有几十到上百条;低于这个数说明开局就断了。
 */
export const MIN_COMMANDS = 10

/**
 * 这一局的录制够不够格当样本。
 * 返回 null 表示合格,否则返回该写进失败清单的说明。
 *
 * **不合格要算失败,不能算通过** —— 一局没验到东西的对拍混进「通过」里,
 * 会让总数看起来很健康,而实际覆盖是空的。
 */
export function judgeRecord(commandCount: number): string | null {
  if (commandCount >= MIN_COMMANDS) return null
  return `只录到 ${commandCount} 条命令就结束了 —— 这一局没有真正被对拍`
}

export type FailKind = 'replay' | 'frame' | 'json' | 'record' | 'events'

export interface Fail {
  seed: number
  kind: FailKind
  detail: string
}

/** 按类别数一遍失败,报告用。 */
export function tally(fails: Fail[]): Record<FailKind, number> {
  const out: Record<FailKind, number> = { replay: 0, frame: 0, json: 0, record: 0, events: 0 }
  for (const f of fails) out[f.kind]++
  return out
}
