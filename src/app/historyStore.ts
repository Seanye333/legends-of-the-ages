import { create } from 'zustand'
import { persist } from 'zustand/middleware'
// 【只引轻量索引,不引 historyBattles】
// 这个 store 从名局数据里只取三样:id 存不存在、发多少奖、有没有逆位/分歧点。
// 而它是**首屏就要加载的**(标题页要显示「名局重现 5/18」),
// 引重的那一份等于把 35.4KB 的战役定义(牌组/修正/态势文案)也拖进首屏主包。
// 索引与真数据由 historyIndex.test.ts 逐场逐字段对拍,走样当场红。
import { HISTORY_INDEX } from '../content/historyIndex'
import { useCollection } from './collectionStore'
import { useAchievements } from './achievementStore'
import { safeStorage } from './safeStorage'

// 历史名战进度。与 campaign 不同,这些是**可自由重打的设定局**,不做线性解锁 ——
// 想打哪场打哪场。只记两件事:通了哪几场、当前正在打哪一场(结算时认关)。
//
// 奖励**只发一次**(首通),重打不给 —— 否则最软的一场会变成刷奖励的农场。
// 持久化沿用 campaign 的做法(zustand persist + 本地 key),不接云端同步;
// 若日后要同步,与 campaign 一并处理更一致。

interface HistoryState {
  cleared: string[] // 已通关的战役 id
  // 逆位挑战(用历史上输的那一方打赢)通过的战役 id。
  // 与正位分开记 —— 它是第二种打法,不是同一场的重打(和关底试炼同一个口径)。
  reversed: string[]
  // 史实分歧点(「如果东风没来」)通过的战役 id。
  // 与正位、逆位各记各的:三者是同一场仗的三种问法,不是同一件事的重复。
  // **可选持久字段** —— 老存档没有它,读作一个都没通。
  diverged?: string[]
  active: string | null // 正在挑战的战役 id
  activeReverse: boolean
  activeDiverge?: boolean
  isCleared(battleId: string): boolean
  isReverseUnlocked(battleId: string): boolean
  // 分歧点要**先把史实那一版打赢**才解锁 —— 「如果没有东风」这句话
  // 只有在你已经靠东风赢过一次之后才有意思。
  isDivergeUnlocked(battleId: string): boolean
  begin(battleId: string, reverse?: boolean, diverge?: boolean): boolean
  settle(win: boolean): { merit: number; packs: number } | null
  abandon(): void
  reset(): void
}

export const useHistory = create<HistoryState>()(
  persist(
    (set, get) => ({
      cleared: [],
      reversed: [],
      diverged: [],
      active: null,
      activeReverse: false,
      activeDiverge: false,

      isCleared(battleId) {
        return get().cleared.includes(battleId)
      },

      // 逆位要先正位通关才解锁 —— 先把这一仗按史实打赢一次,再来问「反过来呢」
      isReverseUnlocked(battleId) {
        return get().cleared.includes(battleId) && HISTORY_INDEX[battleId]?.reverse !== undefined
      },

      isDivergeUnlocked(battleId) {
        return get().cleared.includes(battleId) && HISTORY_INDEX[battleId]?.diverge !== undefined
      },

      begin(battleId, reverse = false, diverge = false) {
        if (!HISTORY_INDEX[battleId]) return false
        if (reverse && !get().isReverseUnlocked(battleId)) return false
        if (diverge && !get().isDivergeUnlocked(battleId)) return false
        set({ active: battleId, activeReverse: reverse, activeDiverge: diverge })
        return true
      },

      // 返回本次发放的奖励;没有则返回 null(输了、或这场早就通过了)
      settle(win) {
        const { active, activeReverse, activeDiverge, cleared, reversed } = get()
        if (!active) return null
        set({ active: null, activeReverse: false, activeDiverge: false })
        if (!win) return null
        const battle = HISTORY_INDEX[active]
        if (!battle) return null
        // 逆位走自己那条账:只给功勋不给卡包(与关底试炼同一条原则 ——
        // 卡包产出会冲击「一局一包」的基线),也不 bump historyCleared:
        // 那条成就数的是战役数,不是打法数。
        if (activeReverse) {
          const rev = battle.reverse
          if (rev === undefined || reversed.includes(active)) return null
          set({ reversed: [...reversed, active] })
          useCollection.setState({
            merit: useCollection.getState().merit + rev,
          })
          return { merit: rev, packs: 0 }
        }
        // 分歧点同样走「只给功勋」那条账,理由与逆位一字不差
        if (activeDiverge) {
          const div = battle.diverge
          const done = get().diverged ?? []
          if (div === undefined || done.includes(active)) return null
          set({ diverged: [...done, active] })
          useCollection.setState({
            merit: useCollection.getState().merit + div,
          })
          return { merit: div, packs: 0 }
        }
        if (cleared.includes(active)) return null // 重打不再发奖
        set({ cleared: [...cleared, active] })
        useAchievements.getState().bump('historyCleared')
        useCollection.getState().grantPacks(battle.packs)
        useCollection.setState({
          merit: useCollection.getState().merit + battle.merit,
        })
        return { merit: battle.merit, packs: battle.packs }
      },

      abandon() {
        set({ active: null, activeReverse: false, activeDiverge: false })
      },

      reset() {
        set({
          cleared: [],
          reversed: [],
          diverged: [],
          active: null,
          activeReverse: false,
          activeDiverge: false,
        })
      },
    }),
    { name: 'qiangu-history', storage: safeStorage },
  ),
)
