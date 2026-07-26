import { describe, expect, it } from 'vitest'
import { QUIZ_POOL, makeQuestion, personLabel } from './quiz'
import { CARDS_BY_ID } from './cards'

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
