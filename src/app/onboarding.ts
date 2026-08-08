import type { LocalizedText } from '../engine/types'

// 新兵之路 —— 把前三十分钟串成一条线。
//
// 【缺的从来不是内容,是顺序】
// 教学对局、兵法讲堂、讲堂实练、六套预组、构筑器 —— 全都做好了,
// 而且各自都不差。问题是它们**互相不知道对方存在**:
// 教学打完之后没有任何东西说下一步该干嘛,于是新玩家回到标题页,
// 面对三十多个入口自己猜。猜错的那些人就不会有第二天。
//
// 【为什么是四步,而且到此为止】
// 这条路只负责把人送到「你已经能自己玩了」那个点:
//   打一局 → 知道规则 → 做一道题 → 组一副自己的牌
// 最后一步是分界线 —— 组过一次牌的人就有了自己的东西,
// 之后要往哪走该由他自己决定,而不是再被一条清单推着走。
//
// 【为什么不做成强制引导】
// 每一步都只是**指路**,可以跳过、可以乱序完成(判据是状态不是顺序)。
// 强制引导会把「我在玩」变成「我在完成任务」,而这个游戏的第一屏
// 本来就已经太像一张任务清单了。
//
// 判定层写成纯函数是为了能测:每一步的完成条件都来自别处的持久化状态,
// 而那些状态在测试里没法方便地造出来。
export type OnboardStepId = 'tutorial' | 'match' | 'drill' | 'deck'

export interface OnboardInput {
  tutorialDone: boolean
  matchesPlayed: number
  lessonsDone: number
  customDecks: number
}

export interface OnboardStep {
  id: OnboardStepId
  name: LocalizedText
  hint: LocalizedText
  done: boolean
}

export function onboardingSteps(s: OnboardInput): OnboardStep[] {
  return [
    {
      id: 'tutorial',
      name: { zh: '走一遍教学对局', en: 'Take the guided match' },
      hint: { zh: '六步,教你怎么出牌、怎么打人', en: 'Six steps: play a card, swing, end a turn' },
      done: s.tutorialDone,
    },
    {
      id: 'match',
      name: { zh: '用预组打一局', en: 'Play a match with a preconstructed deck' },
      hint: { zh: '六套预组各有各的打法,先随便挑一套', en: 'Six ready-made decks, each plays differently' },
      done: s.matchesPlayed >= 1,
    },
    {
      id: 'drill',
      name: { zh: '讲堂实练做一道', en: 'Solve one drill in the Codex' },
      hint: { zh: '规则读一遍记不住,做一道就记住了', en: 'Reading the rules is not learning them' },
      done: s.lessonsDone >= 1,
    },
    {
      id: 'deck',
      name: { zh: '组一副自己的牌', en: 'Build a deck of your own' },
      hint: { zh: '按羁绊 / 家族 / 兵种一键起手,不用从零搭', en: 'Seed it from a bond, a house or a troop type' },
      done: s.customDecks >= 1,
    },
  ]
}

/**
 * 这条路还该不该显示。
 *
 * **四步全做完就收起来** —— 一条永远挂在首屏的清单会从「路标」退化成「噪音」,
 * 而且它占的正是首屏最贵的那块地方。
 */
export function onboardingVisible(s: OnboardInput): boolean {
  return onboardingSteps(s).some((x) => !x.done)
}

/** 下一步是哪一步(第一个未完成的)。全做完返回 undefined。 */
export function nextOnboardStep(s: OnboardInput): OnboardStep | undefined {
  return onboardingSteps(s).find((x) => !x.done)
}
