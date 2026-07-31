import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { BOSSES } from '../content/campaign'
import { useCollection } from './collectionStore'
import { useAchievements } from './achievementStore'
import { safeStorage } from './safeStorage'

// 群雄連斬(Boss Rush)—— 十六关一口气连打,**血量继承**。
//
// 【为什么值得单独做一个模式】
// 冒险那十六关是分开打的:每关都从满血开始,打完可以慢慢组牌再打下一关。
// 那是「学会每个对手」的模式。而这十六个对手放在一起、中间不回血,
// 问的是完全不同的问题:**你的卡组能不能在不补给的情况下连续赢十六次**。
// 同一批内容,第二种消费方式,零新美术零新卡。
//
// 【与登楼的区别】
// 登楼是无尽的、敌人由层数算出来、每三层给兵书补强;连斩是**有终点的**、
// 敌人是十六个具名历史人物、中途什么都不给。前者是耐力,后者是纯粹的卡组检定。
//
// 【血量规则】
// 打赢一关,血量原样带进下一关(护甲不带 —— 护甲是一局之内的资源)。
// 每关之间回 5 血:一点都不回的话,前三关的正常交换就足以让第十关无法开始,
// 那不是难度,那是算术。5 这个数字是「一次主公技的量」,刚好让苟血有意义。
const HEAL_BETWEEN = 5

interface BossRushState {
  stage: number // 当前要打第几关(0-based)
  hp: number | null // 继承下来的血量;null = 没有进行中的连斩
  active: boolean
  best: number // 历史最远打到第几关(1-based,0 = 没通过任何一关)
  cleared: boolean // 是否完整通关过一次
  begin(startHp: number): void
  // 返回本次结算结果;win 且还有下一关时把血量结转
  settle(win: boolean, hpLeft: number): { finished: boolean; merit: number } | null
  abandon(): void
  reset(): void
}

export const useBossRush = create<BossRushState>()(
  persist(
    (set, get) => ({
      stage: 0,
      hp: null,
      active: false,
      best: 0,
      cleared: false,

      begin(startHp) {
        set({ active: true, hp: get().hp ?? startHp })
      },

      settle(win, hpLeft) {
        if (!get().active) return null
        const stage = get().stage
        set({ active: false })
        if (!win) {
          // 倒在第几关就记到第几关(倒下那关不算通过),然后整趟重来
          set({ stage: 0, hp: null, best: Math.max(get().best, stage) })
          useAchievements.getState().bump('bossRushBest', stage)
          return null
        }
        const nextStage = stage + 1
        const finished = nextStage >= BOSSES.length
        set({ best: Math.max(get().best, nextStage) })
        useAchievements.getState().bump('bossRushBest', nextStage) // MAX 统计
        if (finished) {
          // 通关奖励只发一次(和冒险首通同一条原则:否则连斩变成刷功勋的农场)
          const first = !get().cleared
          set({ stage: 0, hp: null, cleared: true })
          if (first) {
            useCollection.setState({ merit: useCollection.getState().merit + 800 })
            return { finished: true, merit: 800 }
          }
          return { finished: true, merit: 0 }
        }
        set({ stage: nextStage, hp: Math.max(1, hpLeft) + HEAL_BETWEEN })
        return { finished: false, merit: 0 }
      },

      abandon() {
        set({ active: false, stage: 0, hp: null })
      },

      reset() {
        set({ stage: 0, hp: null, active: false, best: 0, cleared: false })
      },
    }),
    { name: 'qiangu-bossrush', storage: safeStorage },
  ),
)

export const BOSS_RUSH_HEAL = HEAL_BETWEEN
