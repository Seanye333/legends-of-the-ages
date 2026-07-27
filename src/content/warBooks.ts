import type { LocalizedText, RunModifiers } from '../engine/types'

// 兵書 —— 爬塔的成长线。
//
// 【为什么是爬塔,不是构筑】
// 一开始想做成「构筑时选两条被动」。但主公技升阶那一轮刚证明过一件事:
// **任何给玩家侧加常驻强度的设计,都会把 sim-balance 的矩阵打歪**,
// 而要让它进天梯就得走一整轮和当初主公技同级别的调校(见 heroes.ts 那段实测)。
//
// 登楼没有这个问题:它是无尽爬塔,难度由层数自己算出来,没有平衡闸门,
// 而且它**恰恰缺一条成长线** —— 现在的登楼是「敌人越来越强,你原地不动」,
// 爬到十几层就变成纯粹的卡组质量检定,没有任何本局内的决策。
// 兵书补的正是这个:每通三层选一本,一趟爬塔因此有了自己的构筑过程。
//
// 【为什么复用 RunModifiers 而不是新做一套】
// 远征宝物、乱斗规则、关卡态势已经全部走 RunModifiers 了 ——
// 它就是「开局修正」这件事的既有词汇。兵书是第四个消费者,零引擎改动。
//
// 【定价】
// 每三层一本,爬到 30 层能拿十本。所以单本必须**克制**:
// 一本 = 大约半张卡的价值。堆起来才可观 —— 这是爬塔该有的曲线。
export interface WarBook {
  id: string
  name: LocalizedText
  text: LocalizedText
  modifiers: RunModifiers
  bonusHp?: number
}

export const WAR_BOOKS: WarBook[] = [
  {
    id: 'wb-sunzi',
    name: { zh: '孫子兵法', en: 'The Art of War' },
    text: { zh: '起手多抽一張牌。', en: 'Draw one extra opening card.' },
    modifiers: { bonusHandSize: 1 },
  },
  {
    id: 'wb-liutao',
    name: { zh: '六韜', en: 'Six Secret Teachings' },
    text: { zh: '起手手牌費用 -1。', en: 'Cards in your opening hand cost 1 less.' },
    modifiers: { handCostDelta: -1 },
  },
  {
    id: 'wb-simafa',
    name: { zh: '司馬法', en: 'The Methods of the Sima' },
    text: { zh: '開局獲得 5 點護甲。', en: 'Start with 5 Armor.' },
    modifiers: { startArmor: 5 },
  },
  {
    id: 'wb-weiliaozi',
    name: { zh: '尉繚子', en: 'The Wei Liaozi' },
    text: { zh: '主公技便宜 1 點。', en: 'Your Hero Power costs 1 less.' },
    modifiers: { heroPowerCostDelta: -1 },
  },
  {
    id: 'wb-wuzi',
    name: { zh: '吳子', en: 'The Wuzi' },
    text: { zh: '開局帶一個 2/2 的鐵騎。', en: 'Start with a 2/2 Ironclad Cavalry.' },
    modifiers: { startTokens: ['token-tie-qi'] },
  },
  {
    id: 'wb-huangshi',
    name: { zh: '黃石公三略', en: 'Three Strategies of Huang Shigong' },
    text: { zh: '主公血量 +5。', en: 'Your hero has +5 health.' },
    modifiers: {},
    bonusHp: 5,
  },
  {
    id: 'wb-liji',
    name: { zh: '李衛公問對', en: 'Questions and Replies' },
    text: { zh: '開局帶一個 3/3 的禁軍。', en: 'Start with a 3/3 Imperial Guard.' },
    modifiers: { startTokens: ['token-jin-jun'] },
  },
  {
    id: 'wb-jiangyuan',
    name: { zh: '將苑', en: 'The Garden of Generals' },
    text: { zh: '開局帶兩個 1/3 守護的丹陽兵。', en: 'Start with two 1/3 Guard Danyang Levies.' },
    modifiers: { startTokens: ['token-danyang-bing', 'token-danyang-bing'] },
  },
]

export const WAR_BOOKS_BY_ID: Record<string, WarBook> = Object.fromEntries(
  WAR_BOOKS.map((b) => [b.id, b]),
)

// 每三层给一次选择。第 1 层不给 —— 开局先干净地打一场。
export const FLOORS_PER_BOOK = 3

export function shouldOfferBook(clearedFloor: number): boolean {
  return clearedFloor > 0 && clearedFloor % FLOORS_PER_BOOK === 0
}

// 三选一。走确定性 rng(与远征宝物同一条原则:不用 Math.random,
// 同一个种子在任何机器上给出同一组候选)。已经拿到的不再出现。
export function offerBooks(rngState: number, owned: string[]): { ids: string[]; next: number } {
  const pool = WAR_BOOKS.filter((b) => !owned.includes(b.id))
  const ids: string[] = []
  let s = rngState >>> 0
  const rest = pool.slice()
  for (let i = 0; i < 3 && rest.length > 0; i++) {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0
    const k = s % rest.length
    ids.push(rest.splice(k, 1)[0].id)
  }
  return { ids, next: s }
}

// 把一整套兵书合成开局修正。和远征的 combineRelics 是同一个形状。
export function combineBooks(ids: string[]): { bonusHp: number; modifiers: RunModifiers } {
  let bonusHp = 0
  const modifiers: RunModifiers = {}
  for (const id of ids) {
    const b = WAR_BOOKS_BY_ID[id]
    if (!b) continue
    bonusHp += b.bonusHp ?? 0
    const m = b.modifiers
    if (m.startArmor) modifiers.startArmor = (modifiers.startArmor ?? 0) + m.startArmor
    if (m.bonusHandSize) modifiers.bonusHandSize = (modifiers.bonusHandSize ?? 0) + m.bonusHandSize
    if (m.handCostDelta) modifiers.handCostDelta = (modifiers.handCostDelta ?? 0) + m.handCostDelta
    if (m.heroPowerCostDelta) {
      modifiers.heroPowerCostDelta = (modifiers.heroPowerCostDelta ?? 0) + m.heroPowerCostDelta
    }
    if (m.startTokens) {
      modifiers.startTokens = [...(modifiers.startTokens ?? []), ...m.startTokens]
    }
  }
  return { bonusHp, modifiers }
}
