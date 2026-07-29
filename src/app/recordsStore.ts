import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { MatchStats } from './matchStats'

// 個人紀錄 —— 本地排行榜。
//
// 【它和「書房」不是一回事】
// 书房回答「我做过什么」:通了几关、打了几局、收了几张。那是**累计量**。
// 纪录回答「我最好的一次是什么」:最快的一场、最狠的一场、最长的一串。
// 累计量只会涨,所以它没有紧张感;纪录会被打破,所以每一局都可能有事发生。
//
// 【为什么是本地而不是联网】
// leaderboard.ts 那个是每日胜场的全球榜,要联网、要昵称、要服务端。
// 这一份一个字节都不出设备:它比的是**你和你自己**。
// 单机玩家占绝大多数,而全球榜对他们是一片灰。
//
// 【为什么这几项而不是别的】
// 挑的全是**已经在 MatchStats 里、但打完就被扔掉**的数字。
// 不为记录去引擎里加字段 —— 那会让「记一笔战绩」变成一次协议变更。
// 每一项都配一句「这是什么局面」,否则一列数字读不出故事:
//   · 速勝 —— 回合数越少越好,唯一一项**越小越好**的
//   · 屠場 —— 单局斩敌数,铺场对拼的极限
//   · 破陣 —— 单局总伤害
//   · 面傷 —— 单局打脸伤害,快攻的天花板
//   · 陣容 —— 单局最大同时在场数
//   · 連勝 —— 跨局的那一项(由 streak 传进来)
export type RecordKey =
  | 'fastestWin'
  | 'mostSlain'
  | 'mostDamage'
  | 'mostFaceDamage'
  | 'peakBoard'
  | 'longestStreak'

export interface RecordEntry {
  value: number
  // 达成日期(YYYY-MM-DD)。纪录没有日期就只是一个数字 ——
  // 「去年夏天那一场」才是玩家真正记得的东西。
  date: string
}

// 越小越好的项。只有速勝一项,但写成集合而不是 if:
// 以后加「最少花费」「最少抽牌」这类项时不用再回来改比较逻辑。
const LOWER_IS_BETTER: ReadonlySet<RecordKey> = new Set<RecordKey>(['fastestWin'])

export function isBetter(key: RecordKey, next: number, prev: number | undefined): boolean {
  if (prev === undefined) return true
  return LOWER_IS_BETTER.has(key) ? next < prev : next > prev
}

interface RecordsState {
  best: Partial<Record<RecordKey, RecordEntry>>
  // 返回**这一局刷新了哪几项** —— 结算画面要立刻说「破纪录了」,
  // 事后再去 diff 两个快照既麻烦又容易错一拍。
  submit(stats: MatchStats, win: boolean, today: string): RecordKey[]
  submitStreak(streak: number, today: string): boolean
  reset(): void
}

export const useRecords = create<RecordsState>()(
  persist(
    (set, get) => ({
      best: {},

      submit(stats, win, today) {
        const candidates: [RecordKey, number][] = [
          // 速勝只在**赢了**的时候算 —— 输得快不是纪录
          ...(win && stats.turns > 0 ? ([['fastestWin', stats.turns]] as [RecordKey, number][]) : []),
          ['mostSlain', stats.enemyGeneralsSlain],
          ['mostDamage', stats.damageDealt],
          ['mostFaceDamage', stats.damageToFace],
          ['peakBoard', stats.peakBoard],
        ]
        const best = { ...get().best }
        const broken: RecordKey[] = []
        for (const [key, value] of candidates) {
          if (value <= 0) continue // 0 不算纪录,否则第一局会把每一项都「破」一遍
          if (!isBetter(key, value, best[key]?.value)) continue
          best[key] = { value, date: today }
          broken.push(key)
        }
        if (broken.length > 0) set({ best })
        return broken
      },

      submitStreak(streak, today) {
        if (streak <= 0) return false
        const best = get().best
        if (!isBetter('longestStreak', streak, best.longestStreak?.value)) return false
        set({ best: { ...best, longestStreak: { value: streak, date: today } } })
        return true
      },

      reset() {
        set({ best: {} })
      },
    }),
    { name: 'qiangu-records' },
  ),
)
