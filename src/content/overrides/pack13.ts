import type { CardDef } from '../../engine/types'

// 第十三卡包 · 激怒(Enrage)。
//
// 新机制 enrage:一个**持续状态** —— 只要身上带伤就 +N 攻,治疗回满则收回。
// 和「受创触发」不同,它能反复开关、不是一次性;于是「主动挨一刀」第一次成了收益,
// 越痛越猛。天生和守护咬合:守护逼着敌人来打它,挨了打反而更狠(卧薪尝胆)。
//
// 淬火礪刃是点火器:自己捅友军一刀 + 抽牌,把激怒怪主动激活。放在隐宗
// (不是任何冒险 Boss 的主义),避免贪心 AI 在关底战里对自己人乱捅、把关卡送软。
//
// enrage 是派生字段(refreshInstance 里按 damage 现算),不记附魔;沉默会连它一并抹掉。
// 落在非预组卡上,sim-balance 不动;但激怒身进了霸道/割据 Boss 池,加完重跑 sim-campaign。

export const PACK13_CARDS: CardDef[] = [
  {
    id: 'gen-heg-berserker',
    collectorNo: 9991,
    name: { zh: '困獸', en: 'Cornered Beast' },
    type: 'general',
    doctrine: 'hegemonic',
    dynasty: 'qun',
    rarity: 'epic',
    archetype: 'warrior',
    cost: 4,
    attack: 3,
    health: 6,
    keywords: [],
    enrage: 3,
    // 3/6 的软柿子,一旦被点到就是 6/6 的猛兽 —— 你要么一口吃掉,要么别碰它。
    text: {
      zh: '激怒:受伤时 +3 攻。困獸猶鬥,傷之愈烈。',
      en: 'Enrage: +3 Attack while damaged. A cornered beast fights hardest.',
    },
  },
  {
    id: 'strat-rec-whet',
    collectorNo: 9992,
    name: { zh: '淬火礪刃', en: 'Temper the Blade' },
    type: 'stratagem',
    doctrine: 'reclusion',
    dynasty: 'qun',
    rarity: 'common',
    archetype: 'strategist',
    cost: 1,
    keywords: [],
    // 激怒的点火器:自己捅一刀把激怒怪激活,顺手抽张牌补上。
    spell: {
      ops: [
        { op: 'damage', amount: 1, target: 'chosenFriendlyGeneral' },
        { op: 'draw', count: 1 },
      ],
    },
    text: {
      zh: '對一個友方武將造成 1 點傷害,抽一張牌。',
      en: 'Deal 1 damage to a friendly general, then draw a card.',
    },
  },
]

export const PACK13_OVERRIDES: Record<string, Partial<CardDef>> = {
  // 割据 · 勾踐(8 费 7/7 守护):卧薪尝胆,越挫越勇 —— 激怒的图腾。
  // 守护逼敌人来砍,一挨打就是守在身前的 10 攻猛兽。
  'hist-goujian': {
    keywords: ['guard'],
    enrage: 3,
    text: {
      zh: '守護。激怒:受伤时 +3 攻。臥薪嘗膽,越挫越勇。',
      en: 'Guard. Enrage: +3 Attack while damaged. He who sleeps on brushwood only grows fiercer.',
    },
  },
  // 割据 · 安禄山(6 费 7/6):被点着就暴走的胖子,受伤即 9 攻。
  'hist-an-lushan': {
    enrage: 2,
    text: {
      zh: '激怒:受伤时 +2 攻。漁陽鼙鼓,一動則勢不可回。',
      en: 'Enrage: +2 Attack while damaged.',
    },
  },
}
