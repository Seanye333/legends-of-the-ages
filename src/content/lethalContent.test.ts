import { describe, expect, it } from 'vitest'
import { LETHAL_PUZZLES, LETHAL_PUZZLES_BY_ID, puzzleGameConfig } from './lethalPuzzles'
import { CARDS_BY_ID } from './cards'
import { LESSONS } from './lessons'
import { CODEX } from '../ui/codex'
import { HEROES_BY_ID } from './overrides/heroes'
import { createGame } from '../engine/init'
import { applyCommand } from '../engine/reducer'
import { solveLethal, trivialFaceLethal } from '../ai/lethalSolver'

// 内容闸门:谜题正确性完全靠这里守。CI 里它是「上架题都可解且非平凡」的断言。
describe('斩杀谜题内容自检', () => {
  it('至少 10 道,三档难度都有', () => {
    expect(LETHAL_PUZZLES.length).toBeGreaterThanOrEqual(10)
    for (const d of [1, 2, 3] as const) {
      expect(LETHAL_PUZZLES.some((p) => p.difficulty === d)).toBe(true)
    }
  })

  it('id 唯一', () => {
    const ids = LETHAL_PUZZLES.map((p) => p.id)
    expect(new Set(ids).size).toBe(ids.length)
    expect(Object.keys(LETHAL_PUZZLES_BY_ID).length).toBe(ids.length)
  })

  it('引用的英雄都存在', () => {
    for (const p of LETHAL_PUZZLES) {
      for (const h of p.heroes) expect(HEROES_BY_ID[h], `${p.id}: 英雄 ${h}`).toBeDefined()
    }
  })

  // 谜题的敌方血量是**手写常数**,而斩杀线上每一件东西(卡牌身材、锦囊伤害、
  // 主公技)都可能因为平衡改动而变一点 —— 变了这题就直接无解。
  //
  // 光报「无解」的代价很实在:2026-08-04 朱熹主公技从 2 伤降到 1 伤,
  // lp-threeway 当场失效,而要知道该改成几,得人肉把斩杀线重算一遍
  // (樂進 5 攻 + 圍魏救趙 3 点 + 主公技,法力 5 = 3+2 刚好用尽)。
  // 所以失败时顺手往下搜一遍:告诉维护者**血量改成几就对了**,
  // 顺带说清它在那个血量下还算不算「非平凡」。搜索只在失败路径上跑,不影响正常耗时。
  const suggestHp = (p: (typeof LETHAL_PUZZLES)[number], me: 0 | 1) => {
    const foe = (1 - me) as 0 | 1
    const cur = p.scenario.players[foe].heroHp
    for (let hp = cur - 1; hp >= 1; hp--) {
      const players = p.scenario.players.map((pl, i) => (i === foe ? { ...pl, heroHp: hp } : pl))
      const probe = { ...p, scenario: { ...p.scenario, players } } as typeof p
      let st
      try {
        st = createGame(puzzleGameConfig(probe), CARDS_BY_ID)
      } catch {
        return null
      }
      if (solveLethal(st, me, CARDS_BY_ID)) {
        return { hp, trivial: trivialFaceLethal(st, me) }
      }
    }
    return null
  }

  // 每题:能构造(不含未知卡/超限)→ phase 从 main → 非平凡 → 有解 → 解法回放真赢
  for (const p of LETHAL_PUZZLES) {
    it(`${p.id}「${p.title.zh}」有解且非平凡`, () => {
      const s = createGame(puzzleGameConfig(p), CARDS_BY_ID) // 未知 defId / 超限会在此抛错
      expect(s.phase).toBe('main')
      const me = p.scenario.activePlayer

      // 非平凡:不能只把现成场面砸脸就赢
      expect(trivialFaceLethal(s, me), `${p.id} 不该是「直接挥脸即赢」的假谜题`).toBe(false)

      // 有解
      const res = solveLethal(s, me, CARDS_BY_ID)
      if (!res) {
        const foe = (1 - me) as 0 | 1
        const hint = suggestHp(p, me)
        const cur = p.scenario.players[foe].heroHp
        throw new Error(
          `${p.id} 应存在斩杀解(敌方 heroHp=${cur})。` +
            (hint
              ? `\n  斩杀线现在只够打到 ${hint.hp} —— 把 heroHp 改成 ${hint.hp} 即可` +
                (hint.trivial
                  ? `,\n  但注意那个血量下它会变成「直接挥脸即赢」的平凡题,得另想办法(加血、减资源、换卡)。`
                  : `(那个血量下仍然非平凡)。`) +
                `\n  别去改卡来迁就谜题 —— 谜题跟着卡走,不是反过来。`
              : `\n  往下搜到 1 血都无解 —— 不是血量的问题,是斩杀线本身断了(某张卡或效果变了)。`),
        )
      }

      // 解法回放:真的把对手打死
      let cur = s
      for (const cmd of res!.line) {
        const r = applyCommand(cur, me, cmd, CARDS_BY_ID)
        expect(r.ok, `${p.id} 解法命令走不通: ${JSON.stringify(cmd)}`).toBe(true)
        if (r.ok) cur = r.state
      }
      expect(cur.phase).toBe('ended')
      expect(cur.winner).toBe(me)
    })
  }
})

// ---- 講堂實練 ----
//
// 实练和谜题共用一条管线,所以也共用同一道闸门:必须有解、且不能是「全体打脸就赢」。
// 多一条它自己的:每一课必须挂在讲堂真实存在的词条上,否则那一课永远没人点得到。
describe('讲堂实练', () => {
  it('每一课都有解,且不是平凡打脸', () => {
    for (const lesson of LESSONS) {
      const s = createGame(puzzleGameConfig(lesson), CARDS_BY_ID)
      expect(trivialFaceLethal(s, 0), `${lesson.id} 是平凡解`).toBe(false)
      const res = solveLethal(s, 0, CARDS_BY_ID)
      expect(res, `${lesson.id} 无解`).not.toBeNull()
    }
  })

  it('挂的词条真实存在 —— 否则那一课永远没人点得到', () => {
    const ids = new Set(CODEX.flatMap((s) => s.entries.map((e) => e.id)))
    for (const lesson of LESSONS) {
      expect(ids.has(lesson.mechanic), `${lesson.id} → ${lesson.mechanic}`).toBe(true)
    }
  })

  it('id 唯一,且不与手搓谜题撞车', () => {
    const ids = LESSONS.map((l) => l.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const id of ids) expect(id.startsWith('lesson-')).toBe(true)
  })
})
