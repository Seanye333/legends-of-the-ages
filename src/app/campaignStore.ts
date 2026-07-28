import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { BOSSES, bossTrial } from '../content/campaign'
import { useCollection } from './collectionStore'
import { useAchievements } from './achievementStore'

// 冒险模式进度。只记两件事:打通了哪几关、当前正在挑战哪一关。
// 关卡按顺序解锁 —— 通了第 N 关才能打第 N+1 关。
//
// 奖励**只发一次**(首通),重打不给。否则最简单的第一关会变成刷奖励的农场,
// 而它的难度是按「新手第一关」定的。

interface CampaignState {
  cleared: string[] // 已通关的 boss id
  trialsCleared: string[] // 已通过试炼的 boss id(试炼要先通关才解锁)
  active: string | null // 正在挑战的 boss id(对局结算时用它认关卡)
  activeTrial: boolean // 本局是不是试炼(换胜负条件的第二种打法)
  unlockedCount(): number
  isUnlocked(bossId: string): boolean
  isTrialUnlocked(bossId: string): boolean
  begin(bossId: string, trial?: boolean): boolean
  settle(win: boolean): { merit: number; packs: number } | null
  abandon(): void
  reset(): void
}

export const useCampaign = create<CampaignState>()(
  persist(
    (set, get) => ({
      cleared: [],
      trialsCleared: [],
      active: null,
      activeTrial: false,

      // 已解锁的关卡数 = 已通关数 + 1(下一关),上限为总关数
      unlockedCount() {
        return Math.min(BOSSES.length, get().cleared.length + 1)
      },

      isUnlocked(bossId) {
        const idx = BOSSES.findIndex((b) => b.id === bossId)
        return idx >= 0 && idx < get().unlockedCount()
      },

      // 试炼是**首通之后**的第二种打法 —— 先按常规赢一次,才拿得到换胜负条件的那一版
      isTrialUnlocked(bossId) {
        return get().cleared.includes(bossId) && Boolean(bossTrial(bossId))
      },

      begin(bossId, trial = false) {
        if (trial ? !get().isTrialUnlocked(bossId) : !get().isUnlocked(bossId)) return false
        set({ active: bossId, activeTrial: trial })
        return true
      },

      // 返回本次发放的奖励;没有则返回 null(输了、或这一关早就通过了)
      settle(win) {
        const { active, activeTrial, cleared, trialsCleared } = get()
        if (!active) return null
        set({ active: null, activeTrial: false })
        if (!win) return null
        const boss = BOSSES.find((b) => b.id === active)
        if (!boss) return null
        // 试炼走自己那条账:只给功勋、不给卡包(卡包产出会冲击「一局一包」的基线),
        // 也不再 bump campaignCleared —— 那条成就数的是关卡数,不是打法数。
        if (activeTrial) {
          const trial = bossTrial(active)
          if (!trial) return null
          if (trialsCleared.includes(active)) return null
          set({ trialsCleared: [...trialsCleared, active] })
          useAchievements.getState().bump('trialsCleared')
          useCollection.setState({
            merit: useCollection.getState().merit + trial.rewardMerit,
          })
          return { merit: trial.rewardMerit, packs: 0 }
        }
        if (cleared.includes(active)) return null // 重打不再发奖
        set({ cleared: [...cleared, active] })
        useAchievements.getState().bump('campaignCleared')
        useCollection.getState().grantPacks(boss.rewardPacks)
        useCollection.setState({
          merit: useCollection.getState().merit + boss.rewardMerit,
        })
        return { merit: boss.rewardMerit, packs: boss.rewardPacks }
      },

      abandon() {
        set({ active: null, activeTrial: false })
      },

      reset() {
        set({ cleared: [], trialsCleared: [], active: null, activeTrial: false })
      },
    }),
    { name: 'qiangu-campaign' },
  ),
)
