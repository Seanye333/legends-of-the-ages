import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { BOSSES } from '../content/campaign'
import { RELICS, type RelicDef } from '../content/relics'
import { MODIFIERS_BY_ID, rollTwoModifiers } from '../content/expeditionModifiers'
import { offerCards } from '../content/expeditionDraft'
import { HEROES_BY_ID } from '../content/overrides/heroes'
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
  // 选完宝物后亮出的三选一**卡牌**(加进卡组);null = 不在选牌。
  // 可选字段:老存档没有它 → undefined → 当作 null,旧 run 不会卡住。
  cardOffer?: string[] | null
  stageMod: string | null
  // 两条候选路线(关间选一条走)。非空时远征页停在选路界面。
  routeOffer: string[] | null // 当前关的战场态势修饰符 id(第 1 关为 null)
  rngState: number // 宝物/修饰符随机的种子推进(可复现)
  // 無盡:打完 24 关不结束,绕回第一关继续 —— 每绕一圈敌将血量再涨一档。
  // **可选字段**:老存档的 run 没有它 → undefined → 走原来的「通关即结束」,
  // 打到一半的旧 run 不会因为这次改动变成另一个模式。
  endless?: boolean
}

interface ExpeditionState {
  run: ExpeditionRun | null
  bestDepth: number // 历史最深:通到第几关(0–8)
  totalRuns: number
  start(heroId: string, deck: string[], endless?: boolean): void
  settle(win: boolean): void // 一场打完
  pickRelic(id: string): void
  pickCard(id: string): void // 把牌加进卡组并进下一关
  skipCard(): void
  // 选定关间路线(两条候选之一)。选定才推进关卡。
  pickRoute(modId: string): void // 不加牌,直接进下一关
  dropCard(id: string): void // 精简军册:从卡组里删掉一张(选牌阶段可用)
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

      start(heroId, deck, endless = false) {
        set({
          run: {
            heroId,
            deck,
            endless,
            stage: 0,
            relics: [],
            offered: null,
            stageMod: null,
            routeOffer: null,
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
        // 高难修饰符的补偿:通关多给一件宝物 → 直接折成一个卡包(结算即得)
        const clearedMod = run.stageMod ? MODIFIERS_BY_ID[run.stageMod] : undefined
        if (clearedMod?.bonusRelic) useCollection.getState().grantPacks(1)
        if (clearedStage >= BOSSES.length - 1 && !run.endless) {
          // 通关全部:大奖 + 满进度
          useCollection.getState().grantPacks(3)
          useCollection.setState({ merit: useCollection.getState().merit + 300 })
          set({ run: null, bestDepth: BOSSES.length })
          return
        }
        // 無盡:每绕完一圈发一次通关奖,然后接着走。
        // 发奖放在这里而不是「结束时结算」—— 無盡没有结束,只有失败,
        // 而失败之后再补发奖励读起来像安慰奖。
        if (run.endless && (clearedStage + 1) % BOSSES.length === 0) {
          useCollection.getState().grantPacks(3)
          useCollection.setState({ merit: useCollection.getState().merit + 300 })
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
        // 选完宝物再选一张牌 —— 卡组在一趟远征里真正成长(roguelike 的核心黏性)
        const doctrine = HEROES_BY_ID[run.heroId]?.doctrine
        const { offered: cards, next } = offerCards(doctrine, run.rngState)
        set({
          run: { ...run, relics: [...run.relics, id], offered: null, cardOffer: cards, rngState: next },
        })
      },

      // 选完牌(或跳过)才真正进下一关:抽战场态势修饰符,推进 stage
      // 选完牌(或跳过)进**选路**:两条候选态势,挑一条走。
      // 远征此前是「系统给你一个态势,接受它」—— 路本身没有分叉,
      // 而 roguelike 的核心恰恰是路线选择。
      pickCard(id) {
        const run = get().run
        if (!run || !run.cardOffer || !run.cardOffer.includes(id)) return
        const { ids, next } = rollTwoModifiers(run.rngState)
        set({
          run: { ...run, deck: [...run.deck, id], cardOffer: null, routeOffer: ids, rngState: next },
        })
      },

      skipCard() {
        const run = get().run
        if (!run || !run.cardOffer) return
        const { ids, next } = rollTwoModifiers(run.rngState)
        set({ run: { ...run, cardOffer: null, routeOffer: ids, rngState: next } })
      },

      // 选定路线才真正推进 stage
      pickRoute(modId: string) {
        const run = get().run
        if (!run || !run.routeOffer?.includes(modId)) return
        set({
          run: { ...run, routeOffer: null, stage: run.stage + 1, stageMod: modId },
        })
      },

      // 精简军册:删掉一张(选牌阶段可用)。留一道下限,别把卡组删空。
      dropCard(id) {
        const run = get().run
        if (!run || !run.cardOffer) return
        const i = run.deck.indexOf(id)
        if (i < 0 || run.deck.length <= 20) return
        const deck = run.deck.slice()
        deck.splice(i, 1)
        set({ run: { ...run, deck } })
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
