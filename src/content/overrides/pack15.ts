import type { CardDef } from '../../engine/types'

// 第十五卡包 · 法术流 / 施法触发(onSpellCast)。
//
// 新触发时机 onSpellCast:我方**每打出一个锦囊后**,自己在场带此机制的武将各触发一次
// (只吃自己的锦囊,不吃对手的)。这是法术流一直缺的那块 payoff —— 从前 spellDamage
// 只让锦囊更疼,却没有「多打锦囊本身有奖励」的引擎,于是围绕锦囊堆牌没有回报。
//
// 三张搭一套自足的小生态:通神(越施法越大的浮龙)、纵火(每施法点一下随机敌人)、
// 惊雷(1 费廉价伤害当燃料)。名利本就是谋士主义,法术流落这儿最顺。
//
// onSpellCast 身进了名利 Boss 池(张角),但 Boss 卡组以武将为主、锦囊寥寥,基本触发不了;
// 加完仍重跑 sim-campaign 确认曲线没动。

export const PACK15_CARDS: CardDef[] = [
  {
    id: 'gen-fame-wyrm',
    collectorNo: 9995,
    name: { zh: '通神', en: 'Channeler' },
    type: 'general',
    doctrine: 'fame',
    dynasty: 'qun',
    rarity: 'rare',
    archetype: 'strategist',
    cost: 2,
    attack: 1,
    health: 3,
    keywords: [],
    // 法力浮龙式:每打一个锦囊 +1 攻。留得住就越滚越大,是法术流的核心威胁。
    onSpellCast: { ops: [{ op: 'buffStats', attack: 1, health: 0, target: 'self' }] },
    text: {
      zh: '每當你打出一個錦囊,獲得 +1 攻。通神者,言出而法隨。',
      en: 'After you cast a stratagem, gain +1 Attack.',
    },
  },
  {
    id: 'gen-fame-pyro',
    collectorNo: 9996,
    name: { zh: '縱火', en: 'Pyromancer' },
    type: 'general',
    doctrine: 'fame',
    dynasty: 'qun',
    rarity: 'epic',
    archetype: 'strategist',
    cost: 3,
    attack: 2,
    health: 4,
    keywords: [],
    // 炎术士式:每打一个锦囊,点一下随机敌将。配廉价锦囊能一回合清一片小场。
    onSpellCast: { ops: [{ op: 'damage', amount: 1, target: 'randomEnemyGeneral' }] },
    text: {
      zh: '每當你打出一個錦囊,對隨機一名敵方武將造成 1 點傷害。',
      en: 'After you cast a stratagem, deal 1 damage to a random enemy general.',
    },
  },
  {
    id: 'strat-fame-bolt',
    collectorNo: 9997,
    name: { zh: '驚雷', en: 'Thunderclap' },
    type: 'stratagem',
    doctrine: 'fame',
    dynasty: 'qun',
    rarity: 'common',
    archetype: 'strategist',
    cost: 1,
    keywords: [],
    // 廉价燃料:1 费 2 伤,既是解场也是喂给通神/纵火的施法次数。
    spell: { ops: [{ op: 'damage', amount: 2, target: 'chosenAny' }] },
    text: {
      zh: '造成 2 點傷害。',
      en: 'Deal 2 damage.',
    },
  },
]

export const PACK15_OVERRIDES: Record<string, Partial<CardDef>> = {}
