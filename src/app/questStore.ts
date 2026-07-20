// 每日任务:每天三条,当日零点刷新,完成领卡包。
// 进度只从对局事件流统计(与引擎解耦,纯函数可测)。
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { GameEvent } from '../engine/types'
import type { Doctrine } from '../engine/types'
import { CARDS_BY_ID } from '../content/cards'
import { HEROES_BY_ID } from '../content/overrides/heroes'
import { todayStr } from './leaderboard'

// ---------- 任务定义 ----------

export type QuestKind =
  | 'win' // 获胜 N 局
  | 'duelKill' // 单挑击杀 N 名敌将
  | 'playGenerals' // 打出 N 名武将
  | 'playStratagems' // 打出 N 张锦囊
  | 'equipGenerals' // 装备 N 次
  | 'heroDamage' // 对敌方主公造成 N 点伤害
  | 'winWithDoctrine' // 用指定主义主公获胜 N 局

export interface QuestDef {
  kind: QuestKind
  goal: number
  reward: number // 卡包数
  doctrine?: Doctrine // 仅 winWithDoctrine
}

export interface QuestState extends QuestDef {
  id: string
  progress: number
  claimed: boolean
}

const DOCTRINE_ZH: Record<Doctrine, string> = {
  royal: '王道',
  hegemonic: '霸道',
  ritual: '礼教',
  fame: '名利',
  separatist: '割据',
  reclusion: '隐逸',
}

const DOCTRINE_EN: Record<Doctrine, string> = {
  royal: 'Royal',
  hegemonic: 'Hegemonic',
  ritual: 'Ritual',
  fame: 'Fame',
  separatist: 'Separatist',
  reclusion: 'Reclusion',
}

export function questText(q: QuestDef): { zh: string; en: string } {
  switch (q.kind) {
    case 'win':
      return { zh: `赢下 ${q.goal} 场对局`, en: `Win ${q.goal} matches` }
    case 'duelKill':
      return { zh: `单挑击杀 ${q.goal} 名敌将`, en: `Slay ${q.goal} generals in duels` }
    case 'playGenerals':
      return { zh: `打出 ${q.goal} 名武将`, en: `Play ${q.goal} generals` }
    case 'playStratagems':
      return { zh: `施放 ${q.goal} 张锦囊`, en: `Cast ${q.goal} stratagems` }
    case 'equipGenerals':
      return { zh: `为武将装备 ${q.goal} 次`, en: `Attach ${q.goal} equipment` }
    case 'heroDamage':
      return { zh: `对敌方主公造成 ${q.goal} 点伤害`, en: `Deal ${q.goal} damage to enemy heroes` }
    case 'winWithDoctrine':
      return {
        zh: `以${DOCTRINE_ZH[q.doctrine ?? 'royal']}主公赢下 ${q.goal} 场`,
        en: `Win ${q.goal} match with a ${DOCTRINE_EN[q.doctrine ?? 'royal']} hero`,
      }
  }
}

// 任务池:难度与奖励挂钩(一天最多产出 4 包,不破坏卡包经济)
const POOL: QuestDef[] = [
  { kind: 'win', goal: 1, reward: 1 },
  { kind: 'win', goal: 3, reward: 2 },
  { kind: 'duelKill', goal: 2, reward: 1 },
  { kind: 'duelKill', goal: 4, reward: 2 },
  { kind: 'playGenerals', goal: 20, reward: 1 },
  { kind: 'playGenerals', goal: 35, reward: 2 },
  { kind: 'playStratagems', goal: 5, reward: 1 },
  { kind: 'playStratagems', goal: 10, reward: 2 },
  { kind: 'equipGenerals', goal: 3, reward: 1 },
  { kind: 'heroDamage', goal: 60, reward: 1 },
  { kind: 'heroDamage', goal: 120, reward: 2 },
  ...(Object.keys(DOCTRINE_ZH) as Doctrine[]).map(
    (doctrine): QuestDef => ({ kind: 'winWithDoctrine', goal: 1, reward: 1, doctrine }),
  ),
]

const DAILY_COUNT = 3

// 日期字符串 → 稳定种子(同一天刷出同一组任务,跨设备也一致)
function hashDate(date: string): number {
  let h = 2166136261
  for (let i = 0; i < date.length; i++) {
    h ^= date.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

export function rollDailyQuests(date: string): QuestState[] {
  let seed = hashDate(date)
  const next = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0
    return seed / 0x100000000
  }
  const pool = [...POOL]
  const picked: QuestState[] = []
  // 同 kind 不重复,保证三条任务玩法各异
  const usedKinds = new Set<QuestKind>()
  while (picked.length < DAILY_COUNT && pool.length > 0) {
    const i = Math.floor(next() * pool.length)
    const [def] = pool.splice(i, 1)
    if (usedKinds.has(def.kind)) continue
    usedKinds.add(def.kind)
    picked.push({
      ...def,
      id: `${date}-${def.kind}-${def.doctrine ?? ''}${def.goal}`,
      progress: 0,
      claimed: false,
    })
  }
  return picked
}

// ---------- 对局结算 → 进度增量(纯函数) ----------

export interface MatchTally {
  win: number
  duelKill: number
  playGenerals: number
  playStratagems: number
  equipGenerals: number
  heroDamage: number
  heroDoctrine?: Doctrine // 我方主公主义(用于 winWithDoctrine)
}

// 统计一局的事件流。玩家恒为 0 号(本地帧)。
export function tallyMatch(events: GameEvent[], myHeroId: string): MatchTally {
  const tally: MatchTally = {
    win: 0,
    duelKill: 0,
    playGenerals: 0,
    playStratagems: 0,
    equipGenerals: 0,
    heroDamage: 0,
  }
  tally.heroDoctrine = HEROES_BY_ID[myHeroId]?.doctrine
  for (const ev of events) {
    switch (ev.type) {
      case 'GameEnded':
        if (ev.winner === 0) tally.win += 1
        break
      case 'CardPlayed': {
        if (ev.player !== 0) break
        const def = CARDS_BY_ID[ev.defId]
        if (def?.type === 'general') tally.playGenerals += 1
        else if (def?.type === 'stratagem') tally.playStratagems += 1
        break
      }
      case 'EquipmentAttached':
        if (ev.player === 0) tally.equipGenerals += 1
        break
      case 'DuelFought':
        if (ev.challenger === 0 && ev.defenderDied) tally.duelKill += 1
        break
      case 'HeroDamaged':
        if (ev.player === 1) tally.heroDamage += ev.amount
        break
      default:
        break
    }
  }
  return tally
}

export function applyTally(quests: QuestState[], tally: MatchTally): QuestState[] {
  return quests.map((q) => {
    if (q.progress >= q.goal) return q
    let gain = 0
    switch (q.kind) {
      case 'win':
        gain = tally.win
        break
      case 'duelKill':
        gain = tally.duelKill
        break
      case 'playGenerals':
        gain = tally.playGenerals
        break
      case 'playStratagems':
        gain = tally.playStratagems
        break
      case 'equipGenerals':
        gain = tally.equipGenerals
        break
      case 'heroDamage':
        gain = tally.heroDamage
        break
      case 'winWithDoctrine':
        gain = tally.heroDoctrine === q.doctrine ? tally.win : 0
        break
    }
    if (gain <= 0) return q
    return { ...q, progress: Math.min(q.goal, q.progress + gain) }
  })
}

// ---------- Store ----------

interface QuestStoreState {
  date: string
  quests: QuestState[]
  refreshIfNewDay(): void
  recordMatch(events: GameEvent[], myHeroId: string): void
  claim(id: string): number // 返回发放的卡包数(0 = 不可领)
}

export const useQuests = create<QuestStoreState>()(
  persist(
    (set, get) => ({
      date: todayStr(),
      quests: rollDailyQuests(todayStr()),

      refreshIfNewDay() {
        const today = todayStr()
        if (get().date === today) return
        set({ date: today, quests: rollDailyQuests(today) })
      },

      recordMatch(events, myHeroId) {
        get().refreshIfNewDay()
        set((s) => ({ quests: applyTally(s.quests, tallyMatch(events, myHeroId)) }))
      },

      claim(id) {
        const q = get().quests.find((x) => x.id === id)
        if (!q || q.claimed || q.progress < q.goal) return 0
        set((s) => ({
          quests: s.quests.map((x) => (x.id === id ? { ...x, claimed: true } : x)),
        }))
        return q.reward
      },
    }),
    { name: 'qiangu-quests' },
  ),
)
