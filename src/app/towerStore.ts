import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { towerFloor } from '../content/tower'
import { useCollection } from './collectionStore'

// 无尽爬塔进度:当前挑战到第几层、历史最高层。
//
// 奖励只在**刷新最高层**时发 —— 否则重打第 1 层就是无限功勋泵。
// 输了不清零最高层(那是荣誉),但当前层回到 1 重爬(这是爬塔的规矩)。
interface TowerState {
  floor: number // 当前要打的层
  best: number // 历史最高**通过**层
  active: boolean // 是否有一局正在打
  begin(): void
  settle(win: boolean): { merit: number; floor: number; newBest: boolean } | null
  abandon(): void
  reset(): void
}

export const useTower = create<TowerState>()(
  persist(
    (set, get) => ({
      floor: 1,
      best: 0,
      active: false,

      begin() {
        set({ active: true })
      },

      settle(win) {
        if (!get().active) return null
        const cleared = get().floor
        set({ active: false })
        if (!win) {
          set({ floor: 1 }) // 摔下来从头爬,最高层保留
          return null
        }
        const newBest = cleared > get().best
        if (newBest) {
          const merit = towerFloor(cleared).rewardMerit
          set({ best: cleared })
          useCollection.setState({ merit: useCollection.getState().merit + merit })
          set({ floor: cleared + 1 })
          return { merit, floor: cleared, newBest: true }
        }
        set({ floor: cleared + 1 })
        return { merit: 0, floor: cleared, newBest: false }
      },

      abandon() {
        set({ active: false })
      },

      reset() {
        set({ floor: 1, best: 0, active: false })
      },
    }),
    { name: 'qiangu-tower' },
  ),
)
