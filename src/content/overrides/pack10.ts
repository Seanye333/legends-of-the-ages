import type { CardDef } from '../../engine/types'

// 第十卡包 · 献祭 / 铺场爆发。
//
// 用 damagePer(缩放伤害)开「铺得越宽,一击越狠」的爆发终结;
// 用「消灭友军换价值」(destroy 友军 + payoff,不需要新 opcode)开献祭流 ——
// 手里养着强亡语的武将,主动献掉换牌差/铺场,越死越赚,和第八卡包的复生成闭环。

export const PACK10_CARDS: CardDef[] = [
  {
    id: 'strat-sep-warcry',
    collectorNo: 9951,
    name: { zh: '揭竿百萬', en: 'A Million Rise' },
    type: 'stratagem',
    doctrine: 'separatist',
    dynasty: 'qun',
    rarity: 'epic',
    archetype: 'warrior',
    cost: 4,
    keywords: [],
    // 人海爆发终结:铺满一片乡勇,一记打脸 = 你的武将数。
    spell: { ops: [{ op: 'damagePer', per: { kind: 'friendlyGenerals' }, amount: 1, target: 'enemyHero' }] },
    text: {
      zh: '對敵方主公造成傷害,等於你的武將數量。',
      en: 'Deal damage to the enemy hero equal to the number of generals you control.',
    },
  },
  {
    id: 'strat-fame-sacrifice',
    collectorNo: 9952,
    name: { zh: '棄卒保車', en: 'Sacrifice the Pawn' },
    type: 'stratagem',
    doctrine: 'fame',
    dynasty: 'qun',
    rarity: 'common',
    archetype: 'strategist',
    cost: 2,
    keywords: [],
    // 献祭的启动器:消灭一个友军换两张牌。配合强亡语武将,是「主动送死」的价值引擎。
    spell: {
      ops: [
        { op: 'destroy', target: 'chosenFriendlyGeneral' },
        { op: 'draw', count: 2 },
      ],
    },
    text: {
      zh: '消滅一個友方武將,抽兩張牌。',
      en: 'Destroy a friendly general, then draw two cards.',
    },
  },
]

export const PACK10_OVERRIDES: Record<string, Partial<CardDef>> = {
  // 割据 · 杜預(6 费 4/6):亡语召唤两个 1/1 乡勇 —— 献祭它有赚,自然死也有赚。
  // 「杜武库」学富五车,身后仍有遗泽。
  'du-yu': {
    deathrattle: { ops: [{ op: 'summon', defId: 'token-xiangyong', count: 2 }] },
    text: {
      zh: '亡語:召喚兩個 1/1 的鄉勇。杜武庫身後,猶有遺澤。',
      en: 'Deathrattle: summon two 1/1 Village Levies.',
    },
  },
  // 割据 · 洪秀全(6 费 4/7 epic):人海爆发的锚 —— 战吼对敌方主公造成伤害 = 你的武将数。
  // 金田起义,万众揭竿。
  'hist-hong-xiuquan': {
    battlecry: { ops: [{ op: 'damagePer', per: { kind: 'friendlyGenerals' }, amount: 1, target: 'enemyHero' }] },
    text: {
      zh: '戰吼:對敵方主公造成傷害,等於你的武將數量。金田一呼,萬眾景從。',
      en: 'Battlecry: deal damage to the enemy hero equal to the number of generals you control.',
    },
  },
  // 名利 · 甘茂(7 费 6/7 epic):献祭流的大脑 —— 战吼消灭一个友军,抽三张牌。
  // 息壤之盟,算无遗策。
  'hist-gan-mao': {
    battlecry: {
      ops: [
        { op: 'destroy', target: 'chosenFriendlyGeneral' },
        { op: 'draw', count: 3 },
      ],
    },
    text: {
      zh: '戰吼:消滅一個友方武將,抽三張牌。息壤之盟,不負於秦。',
      en: 'Battlecry: destroy a friendly general, then draw three cards.',
    },
  },
}
