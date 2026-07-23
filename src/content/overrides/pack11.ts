import type { CardDef } from '../../engine/types'

// 第十一卡包 · 先锋突进 / 攻击后(onAttack)。
//
// 新触发时机 onAttack:武将发起一次**普通攻击并存活**后触发(单挑不算)。
// 它奖励「主动出手」,天然和突袭/冲锋咬合——落地即战、战而有报。
// 于是有了一个不靠战吼堆场、而靠反复交战滚雪球的进攻原型:
//   越冲越有牌(budugen / 陷阵先锋)、越战越壮(凌统)、越打越铺(轲比能部)、
//   缠住放血(李儒)。先登陷阵给任意友军现开一次突袭,把这套节奏点着。
//
// 全部落在非预组卡上,sim-balance(只测预组)不受影响。

export const PACK11_CARDS: CardDef[] = [
  {
    id: 'gen-sep-vanguard',
    collectorNo: 9961,
    name: { zh: '陷陣先鋒', en: 'Vanguard of the Breach' },
    type: 'general',
    doctrine: 'separatist',
    dynasty: 'qun',
    rarity: 'epic',
    archetype: 'warrior',
    cost: 5,
    attack: 4,
    health: 5,
    keywords: ['rush'],
    // 耐战的突袭身:落地就能咬一口,此后每次出手都续一张牌——进攻即抽牌的引擎。
    onAttack: { ops: [{ op: 'draw', count: 1 }] },
    text: {
      zh: '突袭。攻击后:抽一張牌。陷陣者先登,亦先取賞。',
      en: 'Rush. After this attacks, draw a card.',
    },
  },
  {
    id: 'strat-sep-firstwall',
    collectorNo: 9962,
    name: { zh: '先登陷陣', en: 'First to the Wall' },
    type: 'stratagem',
    doctrine: 'separatist',
    dynasty: 'qun',
    rarity: 'common',
    archetype: 'warrior',
    cost: 2,
    keywords: [],
    // 把一个刚落地的大个子现开一次突袭 + 加攻——点燃「攻击后」的启动器。
    spell: {
      ops: [
        { op: 'buffStats', attack: 2, health: 0, target: 'chosenFriendlyGeneral' },
        { op: 'grantKeyword', keyword: 'rush', target: 'chosenFriendlyGeneral' },
      ],
    },
    text: {
      zh: '給一個友方武將 +2 攻並獲得突袭。',
      en: 'Give a friendly general +2 Attack and Rush.',
    },
  },
]

export const PACK11_OVERRIDES: Record<string, Partial<CardDef>> = {
  // 割据 · 步度根(3 费 3/3 突袭):鲜卑先锋,越冲越有牌。
  // 突袭落地咬一口就抽一张——脆但换牌差,是这套进攻的斥候。
  budugen: {
    onAttack: { ops: [{ op: 'draw', count: 1 }] },
    text: {
      zh: '突袭。攻击后:抽一張牌。鮮卑輕騎,來去如風。',
      en: 'Rush. After this attacks, draw a card.',
    },
  },
  // 霸道 · 凌統(5 费 5/5 突袭):江表虎臣,越战越勇。
  // 每出一次手 +1/+1——只要压得住场,雪球越滚越大。
  'ling-tong': {
    onAttack: { ops: [{ op: 'buffStats', attack: 1, health: 1, target: 'self' }] },
    text: {
      zh: '突袭。攻击后:獲得 +1/+1。江表虎臣,愈戰愈勇。',
      en: 'Rush. After this attacks, gain +1/+1.',
    },
  },
  // 割据 · 句扶(3 费 3/3 突袭):蜀中宿将,裹挟乡勇滚雪球。
  // 每次出手拉一个 1/1 垫场,越打人越多。
  'gou-fu': {
    onAttack: { ops: [{ op: 'summon', defId: 'token-xiangyong', count: 1 }] },
    text: {
      zh: '突袭。攻击后:召喚一個 1/1 的鄉勇。裹挾流民,愈眾愈盛。',
      en: 'Rush. After this attacks, summon a 1/1 Village Levy.',
    },
  },
  // 中立 · 李儒(3 费 2/5):毒士缠斗,放血不止。
  // 身板厚、能反复出手,每次出手对随机敌将补 1 点——磨盘一样耗死对面小场。
  'li-ru': {
    onAttack: { ops: [{ op: 'damage', amount: 1, target: 'randomEnemyGeneral' }] },
    text: {
      zh: '攻击后:對隨機一名敵方武將造成 1 點傷害。毒士當道,纏鬥放血。',
      en: 'After this attacks, deal 1 damage to a random enemy general.',
    },
  },
}
