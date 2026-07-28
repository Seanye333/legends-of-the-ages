import type { LocalizedText } from '../engine/types'

// 軍銜 —— 把所有模式的产出汇进一条线。
//
// 【为什么需要】
// 标题页有二十几个入口,每个都发自己的功勋、自己的进度、自己的最高纪录 ——
// 而没有任何一样东西能回答「我在这个游戏里走到哪儿了」。
// 打了三百局的人和刚装上的人,在界面上除了收藏数之外看不出区别。
//
// 【为什么用「累计战功」而不是天梯分】
// 天梯分只有联机局才动,而这个游戏绝大部分内容是单人的 —— 用它当主线
// 等于告诉玩家「你打的那些都不算数」。战功把每一种胜利都折进来,
// 权重按**这一局有多难**给,而不是按模式受不受欢迎:
//   随便打/演武 1 · 天梯 3 · 竞技场 3 · 冒险关底 5 · 试炼 5 ·
//   名局 5 · 远征关 6 · 登楼层 6 · 连斩关 8
//
// 【为什么衔级只有十级】
// 军衔要能被记住、被说出口(「我是偏将军了」),二三十级会退化成一条进度条上的数字。
// 十级、名称取历代武职、跨度做成前松后紧:前四级是「几个小时」,最高一级是「几百局」。
export interface Rank {
  merit: number // 达到这一衔所需累计战功
  name: LocalizedText
}

export const RANKS: Rank[] = [
  { merit: 0, name: { zh: '白身', en: 'Commoner' } },
  { merit: 20, name: { zh: '什長', en: 'Squad Leader' } },
  { merit: 60, name: { zh: '屯將', en: 'Company Officer' } },
  { merit: 140, name: { zh: '校尉', en: 'Colonel' } },
  { merit: 280, name: { zh: '都尉', en: 'Commandant' } },
  { merit: 500, name: { zh: '中郎將', en: 'General of the Household' } },
  { merit: 800, name: { zh: '偏將軍', en: 'Lieutenant General' } },
  { merit: 1300, name: { zh: '鎮軍將軍', en: 'General Who Guards the Army' } },
  { merit: 2000, name: { zh: '大將軍', en: 'Grand General' } },
  { merit: 3200, name: { zh: '天下兵馬大元帥', en: 'Grand Marshal of the Realm' } },
]

// 各来源的战功权重。改这张表会**追溯性地**改变所有人的军衔 ——
// 因为战功是从既有统计现算的,不是一个累加出来的存档字段。
// 这是有意的:它意味着军衔永远和玩家真实做过的事一致,不会因为漏记而失真。
export interface MeritSources {
  casualWins: number
  ladderWins: number
  arenaWins: number
  campaignCleared: number
  trialsCleared: number
  historyCleared: number
  expeditionDepth: number
  towerBest: number
  bossRushBest: number
}

const WEIGHTS: Record<keyof MeritSources, number> = {
  casualWins: 1,
  ladderWins: 3,
  arenaWins: 3,
  campaignCleared: 5,
  trialsCleared: 5,
  historyCleared: 5,
  expeditionDepth: 6,
  towerBest: 6,
  bossRushBest: 8,
}

export function warMerit(s: Partial<MeritSources>): number {
  let total = 0
  for (const key of Object.keys(WEIGHTS) as (keyof MeritSources)[]) {
    total += (s[key] ?? 0) * WEIGHTS[key]
  }
  return total
}

export function rankOf(merit: number): { rank: Rank; index: number; next?: Rank } {
  let index = 0
  for (let i = 0; i < RANKS.length; i++) {
    if (merit >= RANKS[i].merit) index = i
  }
  return { rank: RANKS[index], index, next: RANKS[index + 1] }
}

// 到下一衔还差多少(已是最高衔时返回 null)
export function toNextRank(merit: number): { need: number; ratio: number } | null {
  const { rank, next } = rankOf(merit)
  if (!next) return null
  const span = next.merit - rank.merit
  return { need: next.merit - merit, ratio: span > 0 ? (merit - rank.merit) / span : 1 }
}
