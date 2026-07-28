import type { BattleObjective, LocalizedText, RunModifiers } from '../engine/types'

// 远征关卡修饰符:第 2 关起每关一个「战场态势」,给 roguelike 加变数与风险。
// 多数是**给 Boss 加强**(逐关变难的一部分),难度高的配 bonusRelic 作补偿(多得一件宝物)。
// 第 1 关刻意没有修饰符 —— 开局先给个干净的一盘。
//
// boss:施加给 Boss 座位的开局修正。bossHpBonus:额外加到 Boss 血量。
// both:双方都吃(混乱型)。bonusRelic:通关本关多给一件宝物。
// objective / player:换胜负条件的那一类态势。远征此前每一关都是「谁先把对方打死」,
// 十六关下来节奏完全一样;换掉赢法比换数值更能把一趟 run 撑起来。
// player 是**只加在玩家侧**的修正(护送目标要摆在我方场上,不能混进 boss/both)。
export interface ExpeditionModifier {
  id: string
  name: LocalizedText
  text: LocalizedText
  weight: number
  boss?: RunModifiers
  bossHpBonus?: number
  both?: RunModifiers
  player?: RunModifiers
  objective?: BattleObjective
  bonusRelic?: boolean
}

export const EXPEDITION_MODIFIERS: ExpeditionModifier[] = [
  {
    id: 'mod-elite',
    name: { zh: '兵精糧足', en: 'Well-Provisioned' },
    text: { zh: '敌军起手多抽一张牌。', en: 'The enemy draws an extra opening card.' },
    weight: 5,
    boss: { bonusHandSize: 1 },
  },
  {
    id: 'mod-rampart',
    name: { zh: '深溝高壘', en: 'Deep Moat, High Walls' },
    text: { zh: '敌方主公开局获得 8 点护甲。', en: 'The enemy hero starts with 8 Armor.' },
    weight: 5,
    boss: { startArmor: 8 },
  },
  {
    id: 'mod-terrain',
    name: { zh: '山河險固', en: 'Fastness of Mountains' },
    text: { zh: '敌军开局带两个 1/3 守护的丹阳兵。', en: 'The enemy starts with two 1/3 Guard Danyang Levies.' },
    weight: 4,
    boss: { startTokens: ['token-danyang-bing', 'token-danyang-bing'] },
  },
  {
    id: 'mod-fortitude',
    name: { zh: '名將坐鎮', en: 'A Great General Holds' },
    text: { zh: '敌方主公血量 +8。通关多得一件宝物。', en: 'The enemy hero has +8 health. Clear it for an extra relic.' },
    weight: 3,
    bossHpBonus: 8,
    bonusRelic: true,
  },
  {
    id: 'mod-swift',
    name: { zh: '疾風迅雷', en: 'Swift as Wind' },
    text: { zh: '双方主公技费用 -1。', en: 'Both Hero Powers cost 1 less.' },
    weight: 3,
    both: { heroPowerCostDelta: -1 },
  },
  {
    id: 'mod-melee',
    name: { zh: '短兵相接', en: 'Close Quarters' },
    text: { zh: '双方起手多抽一张牌。', en: 'Both players draw an extra opening card.' },
    weight: 3,
    both: { bonusHandSize: 1 },
  },
  {
    id: 'mod-siege',
    name: { zh: '強敵環伺', en: 'Beset on All Sides' },
    text: {
      zh: '敌军起手多抽一张,主公开局 5 护甲。通关多得一件宝物。',
      en: 'The enemy draws an extra card and starts with 5 Armor. Clear it for an extra relic.',
    },
    weight: 2,
    boss: { bonusHandSize: 1, startArmor: 5 },
    bonusRelic: true,
  },
  {
    id: 'mod-ironwall',
    name: { zh: '鐵騎壓陣', en: 'Cavalry Vanguard' },
    text: { zh: '敌军开局带一个 2/2 铁骑和一个 3/3 禁军。', en: 'The enemy starts with a 2/2 Ironclad Cavalry and a 3/3 Imperial Guard.' },
    weight: 3,
    boss: { startTokens: ['token-tie-qi', 'token-jin-jun'] },
  },
  {
    id: 'mod-warhorn',
    name: { zh: '擂鼓助威', en: 'War Drums' },
    text: { zh: '双方开局各带两个 1/1 的乡勇。', en: 'Both sides start with two 1/1 Village Levies.' },
    weight: 3,
    both: { startTokens: ['token-xiangyong', 'token-xiangyong'] },
  },
  {
    id: 'mod-grandarmy',
    name: { zh: '傾國之戰', en: 'The Whole Realm at War' },
    text: {
      zh: '敌方主公血量 +12,开局 6 护甲。通关多得一件宝物。',
      en: 'The enemy hero has +12 health and starts with 6 Armor. Clear it for an extra relic.',
    },
    weight: 2,
    bossHpBonus: 12,
    boss: { startArmor: 6 },
    bonusRelic: true,
  },

  // ---- 换胜负条件的一类(权重刻意压低:偶尔遇上才新鲜,每关都换就成负担了)----
  // 都配 bonusRelic:目标类关卡的失败方式更多(粮车被 AOE 扫掉、守不满回合数),
  // 风险高一档,回报也该高一档。
  {
    id: 'mod-hold',
    name: { zh: '堅守待援', en: 'Hold Until Relief' },
    text: {
      zh: '换个赢法:撑过 12 回合即胜,不必斩敌主公。敌军血量 +10。通关多得一件宝物。',
      en: 'A different win: survive 12 turns. The enemy has +10 health. Clear it for an extra relic.',
    },
    weight: 3,
    bossHpBonus: 10,
    objective: { kind: 'survive', turns: 12 },
    bonusRelic: true,
  },
  {
    id: 'mod-behead',
    name: { zh: '斬將奪旗', en: 'Take the Standard' },
    text: {
      zh: '换个赢法:敌阵中有一员主将(5/10 守护),斩了他就赢。通关多得一件宝物。',
      en: 'A different win: a 5/10 Guard commander leads the enemy line. Cut him down. Extra relic on clear.',
    },
    weight: 3,
    boss: { startTokens: ['token-di-zhu-jiang'] },
    objective: {
      kind: 'assassinate',
      targetSide: 1,
      targetDefId: 'token-di-zhu-jiang',
      targetName: { zh: '敵軍主將', en: 'Enemy Commander' },
    },
    bonusRelic: true,
  },
  {
    id: 'mod-convoy',
    name: { zh: '押運糧草', en: 'Escort the Convoy' },
    text: {
      zh: '你带一辆 0/8 粮车,车毁即负 —— 照常斩敌主公才算赢。通关多得一件宝物。',
      en: 'You escort a 0/8 grain cart. Lose it and the run ends. Extra relic on clear.',
    },
    weight: 3,
    player: { startTokens: ['token-liang-che'] },
    objective: {
      kind: 'protect',
      targetSide: 0,
      targetDefId: 'token-liang-che',
      targetName: { zh: '糧車', en: 'Grain Cart' },
    },
    bonusRelic: true,
  },
]

export const MODIFIERS_BY_ID: Record<string, ExpeditionModifier> = Object.fromEntries(
  EXPEDITION_MODIFIERS.map((m) => [m.id, m]),
)

// 抽**两条路**让玩家选。
//
// 远征此前是「系统给你一个态势,接受它」—— 关间唯一的决策是选宝物与选牌,
// 路本身没有分叉。而 roguelike 的核心恰恰是**路线选择**:
// 「这一关我要不要为了多一件宝物去啃硬的那条」。
// 两条候选足够产生这个决策,又不需要一整张节点图的 UI ——
// 手机上点一张节点图既难点准也读不出「这条路通向哪」。
export function rollTwoModifiers(rngState: number): { ids: string[]; next: number } {
  const a = rollModifier(rngState)
  let b = rollModifier(a.next)
  // 抽到同一条就再抽一次(最多两次,避免权重极端时死循环)
  if (b.id === a.id) b = rollModifier(b.next)
  return { ids: b.id === a.id ? [a.id] : [a.id, b.id], next: b.next }
}

// 按权重从 rngState 抽一个修饰符,返回选中 id 与推进后的 rng。
export function rollModifier(rngState: number): { id: string; next: number } {
  let s = rngState >>> 0
  s = (Math.imul(s, 1664525) + 1013904223) >>> 0
  const totalW = EXPEDITION_MODIFIERS.reduce((n, m) => n + m.weight, 0)
  let roll = (s / 0x100000000) * totalW
  for (const m of EXPEDITION_MODIFIERS) {
    roll -= m.weight
    if (roll <= 0) return { id: m.id, next: s }
  }
  return { id: EXPEDITION_MODIFIERS[0].id, next: s }
}
