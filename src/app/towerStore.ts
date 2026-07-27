import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { towerFloor } from '../content/tower'
import { offerBooks, shouldOfferBook } from '../content/warBooks'
import { useCollection } from './collectionStore'
import { useAchievements } from './achievementStore'

// 无尽爬塔进度:当前挑战到第几层、历史最高层。
//
// 奖励只在**刷新最高层**时发 —— 否则重打第 1 层就是无限功勋泵。
// 输了不清零最高层(那是荣誉),但当前层回到 1 重爬(这是爬塔的规矩)。
interface TowerState {
  floor: number // 当前要打的层
  best: number // 历史最高**通过**层
  active: boolean // 是否有一局正在打
  // 兵书:这一趟爬塔已经拿到的(摔下来清空 —— 那是爬塔的规矩,和层数一起归零)
  books: string[]
  offered: string[] | null // 待选的三本;非空时爬塔页停在选书界面
  rngState: number
  begin(): void
  settle(win: boolean): { merit: number; floor: number; newBest: boolean } | null
  pickBook(id: string): void
  abandon(): void
  reset(): void
}

export const useTower = create<TowerState>()(
  persist(
    (set, get) => ({
      floor: 1,
      best: 0,
      active: false,
      books: [],
      offered: null,
      rngState: 0x5eed,

      begin() {
        set({ active: true })
      },

      settle(win) {
        if (!get().active) return null
        const cleared = get().floor
        set({ active: false })
        if (!win) {
          // 摔下来从头爬:层数与兵书一起归零,最高层保留(那是荣誉)
          set({ floor: 1, books: [], offered: null })
          return null
        }
        // 每通三层给一次三选一 —— 登楼此前是「敌人越来越强,你原地不动」,
        // 爬到十几层就变成纯粹的卡组质量检定,本局内一个决策都没有。
        if (shouldOfferBook(cleared)) {
          const roll = offerBooks(get().rngState, get().books)
          set({ offered: roll.ids, rngState: roll.next })
        }
        const newBest = cleared > get().best
        if (newBest) {
          const merit = towerFloor(cleared).rewardMerit
          set({ best: cleared })
          useAchievements.getState().bump('towerBest', cleared) // towerBest 在 MAX_STATS 里,取最大
          useCollection.setState({ merit: useCollection.getState().merit + merit })
          set({ floor: cleared + 1 })
          return { merit, floor: cleared, newBest: true }
        }
        set({ floor: cleared + 1 })
        return { merit: 0, floor: cleared, newBest: false }
      },

      pickBook(id) {
        const { offered, books } = get()
        if (!offered?.includes(id)) return
        set({ books: [...books, id], offered: null })
      },

      abandon() {
        set({ active: false })
      },

      reset() {
        set({ floor: 1, best: 0, active: false, books: [], offered: null, rngState: 0x5eed })
      },
    }),
    { name: 'qiangu-tower' },
  ),
)
