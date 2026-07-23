import type { LocalizedText, RunModifiers } from '../engine/types'

// 远征宝物。单人 roguelike 每通一关三选一,累积一整趟 —— 关间的成长曲线全在这里。
//
// 每个宝物映射到一组 RunModifiers(+ 可选血量加成)。刻意做成结构化修正而不是
// 任意脚本:纯、可测、可复现。强度分三档(rare/epic/legendary),抽取时按稀有度加权。
export interface RelicDef {
  id: string
  name: LocalizedText
  text: LocalizedText
  rarity: 'rare' | 'epic' | 'legendary'
  bonusHp?: number // 加到主公最大/当前血量
  modifiers?: RunModifiers // 开局修正
}

export const RELICS: RelicDef[] = [
  // ---- 血线 ----
  {
    id: 'relic-jinpai',
    name: { zh: '免死金牌', en: 'Golden Writ of Pardon' },
    text: { zh: '主公最大生命 +8。', en: 'Your hero has +8 maximum health.' },
    rarity: 'rare',
    bonusHp: 8,
  },
  {
    id: 'relic-tuncang',
    name: { zh: '屯糧固本', en: 'Full Granaries' },
    text: { zh: '主公最大生命 +14。', en: 'Your hero has +14 maximum health.' },
    rarity: 'epic',
    bonusHp: 14,
  },
  {
    id: 'relic-tiebi',
    name: { zh: '銅牆鐵壁', en: 'Wall of Bronze and Iron' },
    text: { zh: '主公最大生命 +5,每局开局获得 5 点护甲。', en: '+5 maximum health, and start each battle with 5 Armor.' },
    rarity: 'epic',
    bonusHp: 5,
    modifiers: { startArmor: 5 },
  },
  // ---- 护甲 / 开局节奏 ----
  {
    id: 'relic-liangcao',
    name: { zh: '糧草充足', en: 'Ample Supply' },
    text: { zh: '每局开局获得 6 点护甲。', en: 'Start each battle with 6 Armor.' },
    rarity: 'rare',
    modifiers: { startArmor: 6 },
  },
  {
    id: 'relic-qinbing',
    name: { zh: '親兵護衛', en: 'Household Guard' },
    text: { zh: '每局开局在场上召唤两个 1/1 的乡勇。', en: 'Start each battle with two 1/1 Village Levies.' },
    rarity: 'rare',
    modifiers: { startTokens: ['token-xiangyong', 'token-xiangyong'] },
  },
  {
    id: 'relic-chuanxi',
    name: { zh: '傳檄天下', en: 'Call to Arms' },
    text: { zh: '每局开局在场上召唤三个 1/1 的乡勇。', en: 'Start each battle with three 1/1 Village Levies.' },
    rarity: 'epic',
    modifiers: { startTokens: ['token-xiangyong', 'token-xiangyong', 'token-xiangyong'] },
  },
  {
    id: 'relic-jiangwei',
    name: { zh: '大纛旌旗', en: 'The Great Standard' },
    text: { zh: '每局开局在场上召唤一个 0/4 的江东水寨(守护)。', en: 'Start each battle with a 0/4 Jiangdong Stockade (Guard).' },
    rarity: 'rare',
    modifiers: { startTokens: ['token-shui-zhai'] },
  },
  // ---- 起手 / 牌差 ----
  {
    id: 'relic-bingfu',
    name: { zh: '虎符調兵', en: 'The Tiger Tally' },
    text: { zh: '每局起手多抽一张牌。', en: 'Draw an extra card in your opening hand each battle.' },
    rarity: 'rare',
    modifiers: { bonusHandSize: 1 },
  },
  {
    id: 'relic-shenji',
    name: { zh: '神機妙算', en: 'Uncanny Foresight' },
    text: { zh: '每局起手多抽两张牌,但主公最大生命 -4。', en: 'Draw two extra cards each battle, but -4 maximum health.' },
    rarity: 'epic',
    bonusHp: -4,
    modifiers: { bonusHandSize: 2 },
  },
  {
    id: 'relic-junshi',
    name: { zh: '軍師錦囊', en: "Strategist's Satchel" },
    text: { zh: '每局起手手牌费用 -1。', en: 'Cards in your opening hand cost 1 less each battle.' },
    rarity: 'epic',
    modifiers: { handCostDelta: -1 },
  },
  // ---- 主公技 / 传说 ----
  {
    id: 'relic-yuxi',
    name: { zh: '傳國玉璽', en: 'The Imperial Seal' },
    text: { zh: '主公技费用 -1(整趟远征)。', en: 'Your Hero Power costs 1 less for the rest of the run.' },
    rarity: 'epic',
    modifiers: { heroPowerCostDelta: -1 },
  },
  {
    id: 'relic-tianming',
    name: { zh: '天命所歸', en: 'The Mandate of Heaven' },
    text: {
      zh: '主公最大生命 +8,主公技费用 -1,每局开局 3 点护甲。',
      en: '+8 maximum health, Hero Power costs 1 less, and start each battle with 3 Armor.',
    },
    rarity: 'legendary',
    bonusHp: 8,
    modifiers: { heroPowerCostDelta: -1, startArmor: 3 },
  },
  {
    id: 'relic-chuqi',
    name: { zh: '出其不意', en: 'Strike Unlooked-For' },
    text: {
      zh: '每局开局 5 点护甲,起手手牌费用 -1。',
      en: 'Start each battle with 5 Armor, and opening-hand cards cost 1 less.',
    },
    rarity: 'legendary',
    modifiers: { startArmor: 5, handCostDelta: -1 },
  },
  // ---- 精锐开局:用第二章的铁骑/禁军衍生物,给远征更硬的起手场面 ----
  {
    id: 'relic-tunjia',
    name: { zh: '屯甲練兵', en: 'Drilled and Armored' },
    text: { zh: '每局开局 4 点护甲,并召唤一个 2/2 的铁骑。', en: 'Start each battle with 4 Armor and a 2/2 Ironclad Cavalry.' },
    rarity: 'rare',
    modifiers: { startArmor: 4, startTokens: ['token-tie-qi'] },
  },
  {
    id: 'relic-tieqi',
    name: { zh: '鐵騎營', en: 'Cavalry Camp' },
    text: { zh: '每局开局召唤两个 2/2 的铁骑。', en: 'Start each battle with two 2/2 Ironclad Cavalry.' },
    rarity: 'epic',
    modifiers: { startTokens: ['token-tie-qi', 'token-tie-qi'] },
  },
  {
    id: 'relic-qishi',
    name: { zh: '奇士歸心', en: 'Talents Rally to You' },
    text: { zh: '每局起手多抽一张牌,且手牌费用 -1。', en: 'Draw an extra opening card each battle, and opening-hand cards cost 1 less.' },
    rarity: 'epic',
    modifiers: { bonusHandSize: 1, handCostDelta: -1 },
  },
  {
    id: 'relic-jinjun',
    name: { zh: '禁軍護駕', en: 'The Imperial Guard' },
    text: {
      zh: '主公最大生命 +5,每局开局召唤一个 3/3 的禁军。',
      en: '+5 maximum health, and start each battle with a 3/3 Imperial Guard.',
    },
    rarity: 'legendary',
    bonusHp: 5,
    modifiers: { startTokens: ['token-jin-jun'] },
  },
  {
    id: 'relic-zhongzhicheng',
    name: { zh: '眾志成城', en: 'A Wall of Wills' },
    text: {
      zh: '主公最大生命 +10,每局开局 4 点护甲、起手多抽一张。',
      en: '+10 maximum health, and start each battle with 4 Armor and an extra opening card.',
    },
    rarity: 'legendary',
    bonusHp: 10,
    modifiers: { startArmor: 4, bonusHandSize: 1 },
  },
]

export const RELICS_BY_ID: Record<string, RelicDef> = Object.fromEntries(RELICS.map((r) => [r.id, r]))

// 把一趟远征收集的宝物合并成开局配置。护甲/多抽/减费等按累加,
// 衍生物拼接(不超过场面上限由引擎兜)。
export function combineRelics(relicIds: string[]): {
  bonusHp: number
  modifiers: RunModifiers
} {
  let bonusHp = 0
  const mod: RunModifiers = {}
  const tokens: string[] = []
  for (const id of relicIds) {
    const r = RELICS_BY_ID[id]
    if (!r) continue
    bonusHp += r.bonusHp ?? 0
    const m = r.modifiers
    if (!m) continue
    if (m.startArmor) mod.startArmor = (mod.startArmor ?? 0) + m.startArmor
    if (m.bonusHandSize) mod.bonusHandSize = (mod.bonusHandSize ?? 0) + m.bonusHandSize
    if (m.handCostDelta) mod.handCostDelta = (mod.handCostDelta ?? 0) + m.handCostDelta
    if (m.heroPowerCostDelta) mod.heroPowerCostDelta = (mod.heroPowerCostDelta ?? 0) + m.heroPowerCostDelta
    if (m.startTokens) tokens.push(...m.startTokens)
  }
  if (tokens.length > 0) mod.startTokens = tokens
  return { bonusHp, modifiers: mod }
}
