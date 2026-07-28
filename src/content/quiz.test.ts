import { describe, expect, it } from 'vitest'
import { QUIZ_POOL, makeQuestion, personLabel } from './quiz'
import { CARDS_BY_ID } from './cards'
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
