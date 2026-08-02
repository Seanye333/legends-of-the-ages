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
  // ---- 第二十二/二十三卡包的新轴接进远征 ----
  // 这三件走的是新维度而不是新数值:军令给一个「这一趟怎么打」的目标,
  // 粮道让那些军需卡真的打得出来。**只发在远征**(见文件头与主公技升阶那条经验)。
  {
    id: 'relic-hufu',
    name: { zh: '虎符', en: 'The Tiger Tally' },
    text: {
      zh: '開局領受軍令【虎符調兵】:本局打出 4 名武將 → 我方全場 +2/+2 並從牌庫召喚 2 名。',
      en: 'Start with the quest [Tiger Tally]: play 4 generals → give your board +2/+2 and summon 2 from your deck.',
    },
    rarity: 'epic',
    modifiers: {
      startQuest: {
        id: 'relic-quest-hufu',
        name: { zh: '虎符調兵', en: 'Tiger Tally' },
        goal: { kind: 'summonGenerals', count: 4 },
        reward: {
          ops: [
            { op: 'buffStats', attack: 2, health: 2, target: 'allFriendlyGenerals' },
            { op: 'recruit', count: 2 },
          ],
        },
      },
    },
  },
  {
    id: 'relic-liangdao',
    name: { zh: '糧道暢通', en: 'The Road Is Open' },
    text: { zh: '每局開局屯糧 6 —— 軍需牌一上來就打得出。', en: 'Start each battle with 6 Supply.' },
    rarity: 'rare',
    modifiers: { startSupply: 6 },
  },
  {
    id: 'relic-aibing',
    name: { zh: '哀兵必勝', en: 'The Grieving Army' },
    text: {
      zh: '每局開局士氣 -3(全場 -1 攻),但主公最大生命 +20。',
      en: 'Start each battle at -3 Morale (your generals get -1 attack), but your hero has +20 maximum health.',
    },
    rarity: 'legendary',
    bonusHp: 20,
    modifiers: { startMorale: -3 },
  },

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
  // ---- 雙將 ----
  //
  // 副将技和主公技**共用**每回合一次的额度(引擎保证),所以这两件宝物加的
  // 不是每回合的输出,而是「这回合该用哪一个」的决策。
  // 白送一次额外主公技那条路我们在减费宝物上试过 —— 一开就再也调不回来:
  // 每回合多一次 2 费的效果,三十回合是 60 点法力凭空多出来。
  {
    id: 'relic-fujiang-mou',
    name: { zh: '副將 · 謀士', en: 'Vice-General: The Strategist' },
    text: {
      zh: '獲得副將技「借籌」(2 費:抽一張牌,糧道 +1)。副將技與主公技每回合只能用其一。',
      en: 'Gain the vice power "Borrowed Counsel" (2 mana: draw a card and gain 1 Supply). Vice and Hero Power share one use per turn.',
    },
    rarity: 'epic',
    modifiers: {
      vicePower: {
        id: 'hp-vice-jiechou',
        name: { zh: '借籌', en: 'Borrowed Counsel' },
        text: { zh: '抽一張牌,糧道 +1。', en: 'Draw a card and gain 1 Supply.' },
        cost: 2,
        script: {
          ops: [
            { op: 'draw', count: 1 },
            { op: 'gainSupply', amount: 1 },
          ],
        },
      },
    },
  },
  {
    id: 'relic-fujiang-xian',
    name: { zh: '副將 · 先鋒', en: 'Vice-General: The Vanguard' },
    text: {
      zh: '獲得副將技「擂鼓」(2 費:士氣 +1,對敵方主公造成 1 點傷害)。副將技與主公技每回合只能用其一。',
      en: 'Gain the vice power "Roll of Drums" (2 mana: gain 1 Morale and deal 1 damage to the enemy hero). Vice and Hero Power share one use per turn.',
    },
    rarity: 'epic',
    modifiers: {
      vicePower: {
        id: 'hp-vice-leigu',
        name: { zh: '擂鼓', en: 'War Drums' },
        text: { zh: '士氣 +1,對敵方主公造成 1 點傷害。', en: 'Gain 1 Morale and deal 1 damage to the enemy hero.' },
        cost: 2,
        script: {
          ops: [
            { op: 'gainMorale', amount: 1 },
            { op: 'damage', amount: 1, target: 'enemyHero' },
          ],
        },
      },
    },
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
    // 副将只留**最后拿到的那一个**:两件副将宝物同时在身上时,
    // 引擎只认 RunModifiers 上的一个字段 —— 与其悄悄丢一个,不如把规则写明白。
    if (m.vicePower) mod.vicePower = m.vicePower
    // 这个累加器是**手写字段清单**:RunModifiers 加了字段而这里没补,
    // 那件宝物就会安安静静地什么都不做(不报错、不崩溃)。
    // 士气/粮道此前就一直漏在外面 —— 只是碰巧没有宝物用它们。
    if (m.startMorale) mod.startMorale = (mod.startMorale ?? 0) + m.startMorale
    if (m.startSupply) mod.startSupply = (mod.startSupply ?? 0) + m.startSupply
    // 军令同副将:只留最后拿到的那一道(一局只能领一道,QUEST_LIMIT=1)
    if (m.startQuest) mod.startQuest = m.startQuest
  }
  if (tokens.length > 0) mod.startTokens = tokens
  return { bonusHp, modifiers: mod }
}
