import { create } from 'zustand'
import { persist } from 'zustand/middleware'
// 【只引轻量索引,不引 campaign】
// 这个 store 只问四件事:一共几关、这一关排第几、通关发多少、有没有试炼。
// 主公技脚本、开场白、牌组曲线一个字段都没碰,而它是首屏就要加载的 ——
// 引重的那一份等于把 61.8KB 的关底定义拖进主包(首屏里最大的一块内容数据)。
// 索引与真数据由 campaignIndex.test.ts 逐关对拍,走样当场红。
import { CAMPAIGN_BOSS_COUNT, CAMPAIGN_BOSS_IDS, CAMPAIGN_INDEX } from '../content/campaignIndex'
import { useCollection } from './collectionStore'
import { useAchievements } from './achievementStore'
import { safeStorage } from './safeStorage'

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
  // 傳承轮次。0 = 初阵。**可选持久字段**:老存档没有它 → undefined → 读作 0,
  // 首轮的一切(难度曲线、奖励、闸门)一个数都不变。
  cycle?: number
  unlockedCount(): number
  isUnlocked(bossId: string): boolean
  isTrialUnlocked(bossId: string): boolean
  begin(bossId: string, trial?: boolean): boolean
  settle(win: boolean): { merit: number; packs: number } | null
  // 全部通关后才成立:重置关卡、轮次 +1。试炼进度**保留** ——
  // 试炼是「这一关的第二种打法」,不是进度,清掉等于罚玩家再打一遍已经会的东西。
  canAscend(): boolean
  ascend(): boolean
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
      cycle: 0,

      // 已解锁的关卡数 = 已通关数 + 1(下一关),上限为总关数
      unlockedCount() {
        return Math.min(CAMPAIGN_BOSS_COUNT, get().cleared.length + 1)
      },

      isUnlocked(bossId) {
        const idx = CAMPAIGN_BOSS_IDS.indexOf(bossId)
        return idx >= 0 && idx < get().unlockedCount()
      },

      // 试炼是**首通之后**的第二种打法 —— 先按常规赢一次,才拿得到换胜负条件的那一版
      isTrialUnlocked(bossId) {
        return get().cleared.includes(bossId) && CAMPAIGN_INDEX[bossId]?.trial !== undefined
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
        const boss = CAMPAIGN_INDEX[active]
        if (!boss) return null
        // 试炼走自己那条账:只给功勋、不给卡包(卡包产出会冲击「一局一包」的基线),
        // 也不再 bump campaignCleared —— 那条成就数的是关卡数,不是打法数。
        if (activeTrial) {
          const trial = boss.trial
          if (trial === undefined) return null
          if (trialsCleared.includes(active)) return null
          set({ trialsCleared: [...trialsCleared, active] })
          useAchievements.getState().bump('trialsCleared')
          useCollection.setState({
            merit: useCollection.getState().merit + trial,
          })
          return { merit: trial, packs: 0 }
        }
        if (cleared.includes(active)) return null // 重打不再发奖
        set({ cleared: [...cleared, active] })
        useAchievements.getState().bump('campaignCleared')
        // 傳承轮次的关卡更难,奖励跟着涨 —— 但**只涨功勋不涨卡包**。
        // 卡包产出会直接冲击「一局一包」的基线(经济表在 ARCHITECTURE 里),
        // 而功勋是可以按难度给的:它买的是合成,不是开箱。
        const cycle = get().cycle ?? 0
        const merit = Math.round(boss.merit * (1 + 0.5 * cycle))
        useCollection.getState().grantPacks(boss.packs)
        useCollection.setState({
          merit: useCollection.getState().merit + merit,
        })
        return { merit, packs: boss.packs }
      },

      canAscend() {
        return get().cleared.length >= CAMPAIGN_BOSS_COUNT
      },

      ascend() {
        if (!get().canAscend()) return false
        set({ cleared: [], active: null, activeTrial: false, cycle: (get().cycle ?? 0) + 1 })
        return true
      },

      abandon() {
        set({ active: null, activeTrial: false })
      },

      reset() {
        set({ cleared: [], trialsCleared: [], active: null, activeTrial: false, cycle: 0 })
      },
    }),
    { name: 'qiangu-campaign', storage: safeStorage },
  ),
)
