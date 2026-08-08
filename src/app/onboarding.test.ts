import { describe, expect, it } from 'vitest'
import { nextOnboardStep, onboardingSteps, onboardingVisible } from './onboarding'
import type { OnboardInput } from './onboarding'

// 新兵之路的判定层。
//
// 【这里唯一容易写错的地方:判据是**状态**,不是顺序】
// 写成「上一步做完才算下一步」很自然,而且大部分用例照样绿 ——
// 只有「先自己组了一副牌、还没打过一局」那种人会撞上:
// 他明明已经组过牌了,清单却说他没有。
// 这条路是**指路**不是**关卡**,所以每一步各判各的。
const ZERO: OnboardInput = {
  tutorialDone: false,
  matchesPlayed: 0,
  lessonsDone: 0,
  customDecks: 0,
}

describe('新兵之路', () => {
  it('全新档:四步都没做,清单显示,下一步是教学', () => {
    expect(onboardingSteps(ZERO).every((s) => !s.done)).toBe(true)
    expect(onboardingVisible(ZERO)).toBe(true)
    expect(nextOnboardStep(ZERO)?.id).toBe('tutorial')
  })

  it('**乱序完成照样认** —— 判据是状态不是顺序', () => {
    // 一个人先跳过教学、直接组了一副牌:那一步就该是打勾的
    const s = onboardingSteps({ ...ZERO, customDecks: 2 })
    expect(s.find((x) => x.id === 'deck')!.done).toBe(true)
    expect(s.find((x) => x.id === 'tutorial')!.done).toBe(false)
    // 下一步仍然从最前面那个没做的开始
    expect(nextOnboardStep({ ...ZERO, customDecks: 2 })?.id).toBe('tutorial')
  })

  it('四步全做完就收起来 —— 永远挂着的清单是噪音,而且占的是首屏最贵那块地', () => {
    const done: OnboardInput = {
      tutorialDone: true,
      matchesPlayed: 1,
      lessonsDone: 1,
      customDecks: 1,
    }
    expect(onboardingVisible(done)).toBe(false)
    expect(nextOnboardStep(done)).toBeUndefined()
  })

  it('差一步就还在 —— 每一步都得真的能把它关掉', () => {
    const base: OnboardInput = {
      tutorialDone: true,
      matchesPlayed: 1,
      lessonsDone: 1,
      customDecks: 1,
    }
    for (const k of Object.keys(base) as (keyof OnboardInput)[]) {
      const one = { ...base, [k]: typeof base[k] === 'boolean' ? false : 0 }
      expect(onboardingVisible(one), `${k} 关不掉这条路`).toBe(true)
    }
  })

  it('四步都有中英双语的名字与提示 —— 少一句就是一行空白', () => {
    for (const s of onboardingSteps(ZERO)) {
      expect(s.name.zh.length, s.id).toBeGreaterThan(2)
      expect(s.name.en.length, s.id).toBeGreaterThan(4)
      expect(s.hint.zh.length, s.id).toBeGreaterThan(4)
      expect(s.hint.en.length, s.id).toBeGreaterThan(6)
    }
  })

  it('步骤 id 不重复,顺序固定 —— 首屏的东西不该每次渲染换个排法', () => {
    const ids = onboardingSteps(ZERO).map((s) => s.id)
    expect(new Set(ids).size).toBe(ids.length)
    expect(ids).toEqual(['tutorial', 'match', 'drill', 'deck'])
  })
})
