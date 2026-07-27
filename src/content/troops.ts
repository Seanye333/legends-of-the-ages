import type { CardDef, TroopType } from '../engine/types'

// 兵种 —— 卡池的第四个维度。
//
// 【为什么需要它】
// 一张武将卡现在有:费用、身材、势力(dynasty)、主义(doctrine)、关键词、效果。
// 势力与主义都是**归属**标签,回答的是「他是谁那边的」;没有任何一个标签回答
// 「他在战场上是干什么的」。于是「骑兵冲阵」「弓手抛射」「重甲结阵」这些
// 古代战争里最基本的分类,在牌桌上完全不存在 —— 这是一个题材上明摆着、
// 机制上却空着的位置。
//
// 【为什么是派生而不是重跑生成管线】
// `cards.gen.ts` 是脚本产物、入 git、要逐字节可复现,重跑它需要姊妹仓库在位。
// 兵种可以**完全从已有字段推出来**,那就没有理由去动那条管线:
// 派生函数放在合并层,和 withKeywordText / withBondRivalText 同一位置。
//
// 【推导规则:先看卡面已经说了什么,再看时代,最后才掷骰】
// 顺序很重要。先按关键词/效果认出明确的角色(冲锋=骑、守护=步、直伤=弓、
// 军师=不入列),再按时代给倾向(先秦车战多、宋元火器与城防多),
// 剩下的用 **id 的确定性哈希**分配 —— 与播种层同一条原则:不用 Math.random,
// 同一张卡在任何机器上任何时候都是同一个兵种。
//
// 【谋士自成一兵种,而不是「没有兵种」】
// 第一版把 archetype === 'strategist' 整个排除在外,实测**卡池 54% 是谋士** ——
// 兵种只覆盖不到一半的武将,这条轴根本立不住,「带够三个骑兵」的门槛也变得极难。
// 所以谋士自己就是一个兵种(advisor):每个武将都恰好属于一种,
// 轴是满的,顺带「谋士流」也成了一条可构筑的路。
// 锦囊、装备、衍生物仍然没有兵种 —— 它们不是人。
//
// 但**全部 1204 张谋士都归 advisor 又太挤**(54% 挤在一个兵种里,
// 剩下五个分 46%,谁也长不起来)。所以只有**守型**谋士(血 > 攻)算纯谋士,
// 攻守相当或偏攻的那批照常按战场角色入列 —— 史书里的谋士本来也分两种:
// 帐中画策的,和自己领兵的。实测这一刀把 advisor 从 54% 压到 26%。

// 兜底分配只在这五个「战场兵种」里挑 —— 谋士是靠 archetype 认的,不参与掷骰
const TROOPS: TroopType[] = ['cavalry', 'infantry', 'archer', 'navy', 'siege']

// FNV-1a,与 seed-mechanics 的 hash01 同源 —— 确定性、跨平台一致
function hash01(id: string, salt: string): number {
  let h = 0x811c9dc5
  const s = `${id}#${salt}`
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 0x01000193) >>> 0
  }
  return h / 0x100000000
}

// 水战势力:吴、南朝、南宋沿江政权 —— 这些时代/势力的人下水是常态
const NAVY_DYNASTIES = new Set(['wu', 'southern-northern', 'song'])
// 器械(攻城/火器)倾向的时代
const SIEGE_DYNASTIES = new Set(['song', 'yuan', 'ming', 'qing'])
// 车骑之世
const CAVALRY_DYNASTIES = new Set(['warring-states', 'qin', 'western-han', 'tang', 'sui', 'yuan'])

export function deriveTroop(card: CardDef): TroopType | undefined {
  if (card.type !== 'general') return undefined
  if (card.token) return undefined
  // 守型谋士(血 > 攻)= 纯谋士;偏攻的那批继续往下走,按战场角色入列
  if (card.archetype === 'strategist' && (card.health ?? 0) > (card.attack ?? 0)) return 'advisor'

  // 1) 卡面已经说明了角色
  if (card.keywords.includes('charge')) return 'cavalry'
  if (card.keywords.includes('rush')) return 'cavalry'
  if (card.keywords.includes('guard')) return 'infantry'
  if (card.keywords.includes('trample')) return 'siege'
  const ops = [...(card.battlecry?.ops ?? []), ...(card.spell?.ops ?? [])]
  if (ops.some((o) => o.op === 'damage' || o.op === 'aoeDamage' || o.op === 'damageAll')) {
    // 上来就能打到人的,是远程
    return ops.some((o) => o.op === 'aoeDamage' || o.op === 'damageAll') ? 'siege' : 'archer'
  }

  // 2) 时代倾向(加权,不独占)
  const r = hash01(card.id, 'troop')
  if (NAVY_DYNASTIES.has(card.dynasty) && r < 0.18) return 'navy'
  if (SIEGE_DYNASTIES.has(card.dynasty) && r < 0.3) return 'siege'
  if (CAVALRY_DYNASTIES.has(card.dynasty) && r < 0.45) return 'cavalry'

  // 3) 兜底:高攻低血偏骑、低攻高血偏步,其余按哈希摊平
  const atk = card.attack ?? 0
  const hp = card.health ?? 0
  if (atk >= hp + 2) return 'cavalry'
  if (hp >= atk + 2) return 'infantry'
  return TROOPS[Math.floor(hash01(card.id, 'troopfill') * TROOPS.length)]
}

export const TROOP_NAME: Record<TroopType, { zh: string; en: string }> = {
  cavalry: { zh: '騎兵', en: 'Cavalry' },
  infantry: { zh: '步卒', en: 'Infantry' },
  archer: { zh: '弓弩', en: 'Archers' },
  navy: { zh: '水軍', en: 'Navy' },
  siege: { zh: '器械', en: 'Siege' },
  advisor: { zh: '謀士', en: 'Advisor' },
}
