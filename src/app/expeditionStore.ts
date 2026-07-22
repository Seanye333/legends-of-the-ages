import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { BOSSES } from '../content/campaign'
import { RELICS, type RelicDef } from '../content/relics'
import { useCollection } from './collectionStore'
import { useAchievements } from './achievementStore'

// 远征(单人 roguelike):选一副牌,连打 8 关(复用关底 Boss),每通一关三选一宝物。
// 输一场 = 本趟结束,记录走到第几关。通关全部 = 大奖 + 记入最深进度。
//
// 和冒险模式的区别:冒险是线性解锁 + 首通发奖的「打卡」;远征是一次性的、
// 带成长曲线(宝物累积)的 roguelike run,重开一把每次宝物都不同。
//
// HP 每关满血(不跨关继承)——挑战来自 Boss 逐关变强 + 你靠宝物滚雪球,
// 而不是血线管理。这样单局仍是完整的一盘,不需要「残血硬撑」那套。

// 抽取权重:越稀有越少见
const RARITY_WEIGHT: Record<RelicDef['rarity'], number> = { rare: 6, epic: 3, legendary: 1 }

export interface ExpeditionRun {
  heroId: string
  deck: string[]
  stage: number // 0-based:当前要打(或刚打完)的 Boss 序号
  relics: string[] // 已收集的宝物 id
  offered: string[] | null // 通关后亮出的三选一(等玩家挑);null = 不在选宝物
  rngState: number // 宝物随机的种子推进(可复现)
}

interface ExpeditionState {
  run: ExpeditionRun | null
  bestDepth: number // 历史最深:通到第几关(0–8)
  totalRuns: number
  start(heroId: string, deck: string[]): void
  settle(win: boolean): void // 一场打完
  pickRelic(id: string): void
  abandon(): void
}

// 确定性抽取:从 rngState 推出 3 个不重复、按稀有度加权的宝物(排除已拥有)
function offerRelics(owned: string[], rngState: number): { offered: string[]; next: number } {
  const pool = RELICS.filter((r) => !owned.includes(r.id))
  let s = rngState >>> 0
  const rand = () => {
    // 简单 LCG,足够给宝物加点随机;整趟可复现
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0
    return s / 0x100000000
  }
  const picks: string[] = []
  const remaining = [...pool]
  while (picks.length < 3 && remaining.length > 0) {
    const totalW = remaining.reduce((n, r) => n + RARITY_WEIGHT[r.rarity], 0)
    let roll = rand() * totalW
    let idx = 0
    for (let i = 0; i < remaining.length; i++) {
      roll -= RARITY_WEIGHT[remaining[i].rarity]
      if (roll <= 0) {
        idx = i
        break
      }
    }
    picks.push(remaining[idx].id)
    remaining.splice(idx, 1)
  }
  return { offered: picks, next: s }
}

export const useExpedition = create<ExpeditionState>()(
  persist(
    (set, get) => ({
      run: null,
      bestDepth: 0,
      totalRuns: 0,

      start(heroId, deck) {
        set({
          run: {
            heroId,
            deck,
            stage: 0,
            relics: [],
            offered: null,
            rngState: (Math.floor(Math.random() * 0x7fffffff) || 1) >>> 0,
          },
          totalRuns: get().totalRuns + 1,
        })
      },

      settle(win) {
        const run = get().run
        if (!run || run.offered) return // 正在选宝物时不处理
        if (!win) {
          // 败:本趟结束,记录深度
          set({ run: null, bestDepth: Math.max(get().bestDepth, run.stage) })
          return
        }
        const clearedStage = run.stage
        useAchievements.getState().bump('expeditionWins')
        if (clearedStage >= BOSSES.length - 1) {
          // 通关全部:大奖 + 满进度
          useCollection.getState().grantPacks(3)
          useCollection.setState({ merit: useCollection.getState().merit + 300 })
          set({ run: null, bestDepth: BOSSES.length })
          return
        }
        // 通一关:亮出三选一宝物
        const { offered, next } = offerRelics(run.relics, run.rngState)
        set({
          run: { ...run, offered, rngState: next },
          bestDepth: Math.max(get().bestDepth, clearedStage + 1),
        })
      },

      pickRelic(id) {
        const run = get().run
        if (!run || !run.offered || !run.offered.includes(id)) return
        set({
          run: { ...run, relics: [...run.relics, id], offered: null, stage: run.stage + 1 },
        })
      },

      abandon() {
        const run = get().run
        if (run) set({ bestDepth: Math.max(get().bestDepth, run.stage) })
        set({ run: null })
      },
    }),
    { name: 'qiangu-expedition' },
  ),
)
