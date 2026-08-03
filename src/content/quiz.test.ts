import { describe, expect, it } from 'vitest'
import { QUIZ_POOL, makeQuestion, personLabel } from './quiz'
import { CARDS_BY_ID } from './cards'
import { LORE, TRAIT_NAMES } from './generated/lore.gen'
import { ALL_RIVALS, rivalPair } from './relations'

describe('历史小测验', () => {
  it('题库来自有列传的签名卡,数量可观', () => {
    expect(QUIZ_POOL.length).toBeGreaterThan(20)
  })
  it('同一种子出同一道题(可复现)', () => {
    expect(makeQuestion(4242)).toEqual(makeQuestion(4242))
  })
  it('每题四个不重复选项,且正确答案在其中', () => {
    for (let seed = 1; seed <= 40; seed++) {
      const q = makeQuestion(seed * 977)
      expect(q, `seed ${seed}`).not.toBeNull()
      expect(q!.options).toHaveLength(4)
      expect(new Set(q!.options).size).toBe(4)
      expect(q!.options).toContain(q!.answer)
    }
  })
  it('人名题的题干把答案本人的名字挡掉,不白送', () => {
    for (let seed = 1; seed <= 60; seed++) {
      const q = makeQuestion(seed * 131)!
      if (q.kind !== 'whoIsIt') continue
      const name = CARDS_BY_ID[q.subjectId].name.zh
      expect(q.prompt.zh.includes(name), `seed ${seed}`).toBe(false)
    }
  })
  it('personLabel 返回真实卡名', () => {
    expect(personLabel(QUIZ_POOL[0]).zh).toBe(CARDS_BY_ID[QUIZ_POOL[0]].name.zh)
  })
})

// ---- 关系题(第三种题型)----
describe('宿敌题', () => {
  it('出得来,而且答案确实是那个人的宿敌', () => {
    const rivals = new Set(
      ALL_RIVALS.flatMap((r) => {
        const [a, b] = rivalPair(r)
        return [`${a}|${b}`, `${b}|${a}`]
      }),
    )
    let seen = 0
    for (let seed = 1; seed < 400 && seen < 8; seed++) {
      const q = makeQuestion(seed)
      if (q?.kind !== 'whoIsRival') continue
      seen++
      expect(rivals.has(`${q.subjectId}|${q.answer}`), `${q.subjectId} vs ${q.answer}`).toBe(true)
    }
    expect(seen).toBeGreaterThan(0)
  })

  // 干扰项从同一时代块挑 —— 随便挑的话「隔了八百年那个」一眼就排除了
  it('四个选项互不相同,且含正确答案', () => {
    for (let seed = 1; seed < 200; seed++) {
      const q = makeQuestion(seed)
      if (q?.kind !== 'whoIsRival') continue
      expect(new Set(q.options).size).toBe(q.options.length)
      expect(q.options).toContain(q.answer)
    }
  })
})

// ---------------------------------------------------------------- 新三类题型

describe('档案题(表字 / 籍贯 / 性格)', () => {
  // 这三类依赖档案字段,而档案覆盖率只有 50–85% —— 出不了题时必须**换一道**,
  // 不能给空题,也不能无限递归换下去(池子极端时会栈溢出)。
  it('两千个种子里,每一道都合法:四个不重复选项且答案在其中', () => {
    let made = 0
    for (let seed = 1; seed <= 2000; seed++) {
      const q = makeQuestion(seed)
      if (!q) continue
      made++
      expect(q.options).toHaveLength(4)
      expect(new Set(q.options).size, `种子 ${seed} 的选项有重复`).toBe(4)
      expect(q.options).toContain(q.answer)
      expect(q.prompt.zh.trim()).not.toBe('')
    }
    // 绝大多数种子都该出得来题
    expect(made).toBeGreaterThan(1900)
  })

  it('六种题型都出得来 —— 新加的三类不能只是死代码', () => {
    const kinds = new Set<string>()
    for (let seed = 1; seed <= 3000; seed++) {
      const q = makeQuestion(seed)
      if (q) kinds.add(q.kind)
    }
    for (const k of ['whoIsIt', 'whichDynasty', 'whoIsRival', 'whoseCourtesy', 'whereFrom', 'whoseTrait']) {
      expect(kinds.has(k), `${k} 一道都没出来`).toBe(true)
    }
  })

  it('性格题的干扰项都不带被问到的那条特质 —— 否则会有两个正确答案', () => {
    // 题干显示的是特质译名,所以反查出问的是哪条 id,再逐个干扰项验。
    const idOf = new Map(Object.entries(TRAIT_NAMES).map(([id, n]) => [n.zh, id]))
    let checked = 0
    for (let seed = 1; seed <= 3000; seed++) {
      const q = makeQuestion(seed)
      if (q?.kind !== 'whoseTrait') continue
      const asked = idOf.get(q.prompt.zh)
      expect(asked, `种子 ${seed}:题干「${q.prompt.zh}」反查不到特质 id`).toBeTruthy()
      checked++
      for (const opt of q.options) {
        if (opt === q.answer) continue
        expect(
          (LORE[opt]?.traits ?? []).includes(asked!),
          `种子 ${seed}:干扰项 ${opt} 也带着「${q.prompt.zh}」`,
        ).toBe(false)
      }
    }
    expect(checked, '一道性格题都没出来').toBeGreaterThan(0)
  })
})
