import type { Doctrine, HeroPowerDef, RunModifiers } from '../engine/types'
import { ALL_HEROES } from './overrides/heroes'
import { bossDeck } from './campaign'

// 无尽爬塔「登樓」:一层比一层难,看你能爬多高。
//
// 与冒险(有终点的十六关)和名局(设定局)都不同:这里**没有终点**,只有个人最高层。
// 给硬核玩家一个无上限的挑战与攀比点,内容成本却几乎为零 —— 敌人是**算出来的**,
// 不是手写的:层数 → 卡组分位 / 血量 / 开局态势,一条公式铺出无限内容。
//
// 难度三个旋钮沿用 campaign 的结论(见 campaign.ts 顶部):
//   · deckTier 是强旋钮 —— 从最弱(1.0)线性收紧到最强(0.0),前二十层走完;
//   · 血量是弱旋钮 —— 只用来做递增的压迫感;
//   · 开局态势按层数阶梯式加码(第 5 层起给敌方铺场,第 10 层起加甲)。
// 每五层换一位主公(ALL_HEROES 轮转),避免一路打同一张脸。

export const TOWER_TIER_FLOORS = 20 // 走完卡组分位的层数;之后靠血量与态势继续加压

export interface TowerFloorSpec {
  floor: number
  heroId: string
  doctrine: Doctrine
  power: HeroPowerDef
  hp: number
  deckTier: number
  enemyModifiers?: RunModifiers
  rewardMerit: number
}

// 层数 → 这一层的敌人。纯函数、确定性:同一层永远是同一个对手(可针对性重组卡组再来)。
export function towerFloor(floor: number): TowerFloorSpec {
  const n = Math.max(1, Math.floor(floor))
  const hero = ALL_HEROES[(n - 1) % ALL_HEROES.length]
  // 卡组分位:第 1 层最软(1.0),到第 TOWER_TIER_FLOORS 层收到最强(0.0)
  const t = Math.min(1, (n - 1) / (TOWER_TIER_FLOORS - 1))
  const deckTier = Math.max(0, 1 - t)
  // 血量:30 起,每层 +1,第 20 层后每层 +2(后期只剩血量与态势能加压)
  const hp = 30 + Math.min(n - 1, 20) + Math.max(0, n - 20) * 2
  // 开局态势阶梯
  const tokens: string[] = []
  if (n >= 5) tokens.push('token-xiangyong')
  if (n >= 10) tokens.push('token-tie-qi')
  if (n >= 15) tokens.push('token-jin-jun')
  if (n >= 25) tokens.push('token-tie-qi')
  const armor = n >= 10 ? Math.min(12, Math.floor((n - 5) / 5) * 3) : 0
  const enemyModifiers: RunModifiers | undefined =
    tokens.length || armor ? { ...(tokens.length ? { startTokens: tokens } : {}), ...(armor ? { startArmor: armor } : {}) } : undefined
  return {
    floor: n,
    heroId: hero.id,
    doctrine: hero.doctrine,
    power: hero.power,
    hp,
    deckTier,
    enemyModifiers,
    rewardMerit: 20 + n * 5, // 每通一层给功勋,越高越多(只在刷新最高层时发,见 towerStore)
  }
}

// 这一层敌人的卡组(确定性)
export function towerDeck(spec: TowerFloorSpec): string[] {
  return bossDeck(spec.doctrine, spec.deckTier)
}
