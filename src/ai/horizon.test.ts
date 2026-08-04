import { describe, expect, it } from 'vitest'
import { evaluate, DEFAULT_WEIGHTS } from './greedy'
import { createGame } from '../engine/init'
import { CARDS_BY_ID } from '../content/cards'
import { PRECON_DECKS } from '../content/decks'
import type { CardInstance, GameState } from '../engine/types'

// 跨回合估值的验收:它必须能看见**单帧估值看不见的那些东西**。
//
// 这道闸门的存在理由,是 heroes.ts 里那两条被记下来的失败:
//   呂蒙「白衣渡江」改成潜行奇袭 → 镜像胜率 38% 掉到 26%
//   劉秀「柔道」改成回血 2 + 护甲 1 → 40% 掉到 27%
// 两次都不是设计变差了,是尺子量不到(铁律 8)。
// 下面每一条都是「在旧尺子上分数一模一样,在新尺子上必须分出高下」。

const HZ = { persist: 0.35 }

function blank(): GameState {
  const d = PRECON_DECKS[0]
  return createGame(
    {
      seed: 1,
      heroIds: [d.heroId, d.heroId],
      deckIds: [[...d.cardIds], [...d.cardIds]],
      first: 0,
    },
    CARDS_BY_ID,
  )
}

// 造一个只有身材与关键词的单位,绕开卡池
function unit(iid: number, attack: number, health: number, keywords: string[] = []): CardInstance {
  return {
    iid,
    defId: 'token-si-shi',
    attack,
    health,
    maxHealth: health,
    keywords: keywords as CardInstance['keywords'],
    canAttack: true,
    attacksThisTurn: 0,
    enchants: [],
  } as CardInstance
}

const score = (s: GameState, w: Partial<typeof DEFAULT_WEIGHTS> = {}) =>
  evaluate(s, 0, CARDS_BY_ID, false, w)

describe('威胁存续:潜行与铁壁不再等于零', () => {
  it('同样身材,潜行的那个更值钱 —— 旧尺子上两者完全相同', () => {
    // 潜行的价值全部在「下回合它还站着」。单帧估值里潜行只值 0.6 的
    // 关键词当量,远不足以表达「这份威胁保住了」。
    const plain = blank()
    plain.players[0].board = [unit(900, 4, 4)]
    plain.players[1].board = [unit(901, 5, 5)]
    const stealthy = blank()
    stealthy.players[0].board = [unit(900, 4, 4, ['stealth'])]
    stealthy.players[1].board = [unit(901, 5, 5)]

    // 旧尺子:只差一个 0.6 的关键词当量
    const oldGap = score(stealthy) - score(plain)
    // 新尺子:还要加上「这 4 点攻击活到下回合的概率」的差
    const newGap = score(stealthy, HZ) - score(plain, HZ)
    expect(newGap).toBeGreaterThan(oldGap)
  })

  it('打不死的大个子比换一换就没的小个子更值钱', () => {
    // 面对 3 攻的对手:8 血的怪站得住,3 血的怪一换就没。
    // 旧尺子只看 attack + health*0.8,4/8 和 4/3 的差是固定的 4 点血;
    // 新尺子还要算「这 4 点攻击下回合还在不在」。
    const tanky = blank()
    tanky.players[0].board = [unit(900, 4, 8)]
    tanky.players[1].board = [unit(901, 3, 3)]
    const fragile = blank()
    fragile.players[0].board = [unit(900, 4, 3)]
    fragile.players[1].board = [unit(901, 3, 3)]
    const oldGap = score(tanky) - score(fragile)
    const newGap = score(tanky, HZ) - score(fragile, HZ)
    expect(newGap).toBeGreaterThan(oldGap)
  })

  it('治疗一个残血单位有了价值 —— 它把这份威胁从「会死」拉回「站得住」', () => {
    const hurt = blank()
    hurt.players[0].board = [unit(900, 5, 2)]
    hurt.players[1].board = [unit(901, 4, 4)]
    const healed = blank()
    healed.players[0].board = [unit(900, 5, 6)]
    healed.players[1].board = [unit(901, 4, 4)]
    const oldGap = score(healed) - score(hurt)
    const newGap = score(healed, HZ) - score(hurt, HZ)
    expect(newGap).toBeGreaterThan(oldGap)
  })
})

describe('冻结:第一版漏掉的那一层', () => {
  it('被冻的己方单位不算存续威胁 —— 它下回合挥不出来', () => {
    // 漏了这一层的后果是「冻结」这个机制在新尺子上一分不值:
    // 劉秀「柔道」镜像胜率从 40% 掉到 25%,而那不是技能变弱,是模型算漏了。
    const awake = blank()
    awake.players[0].board = [unit(900, 6, 6)]
    awake.players[1].board = [unit(901, 2, 2)]
    const frozen = blank()
    frozen.players[0].board = [{ ...unit(900, 6, 6), frozen: true }]
    frozen.players[1].board = [unit(901, 2, 2)]
    expect(score(awake, HZ)).toBeGreaterThan(score(frozen, HZ))
  })

  it('冻住对方的大怪确实是收益', () => {
    const free = blank()
    free.players[1].board = [unit(901, 8, 8)]
    const iced = blank()
    iced.players[1].board = [{ ...unit(901, 8, 8), frozen: true }]
    expect(score(iced, HZ)).toBeGreaterThan(score(free, HZ))
  })
})

describe('默认权重仍是 0 —— 开关权在 AI_NORMAL,不在这里', () => {
  it('DEFAULT_WEIGHTS.persist 是 0', () => {
    // 基准尺 AI_NORMAL 显式传 { persist: 0.35 };DEFAULT_WEIGHTS 保持 0,
    // 这样「不传权重」的调用点(测试夹具、旧脚本)行为一字不变,
    // 谁在用新尺子一目了然。
    expect(DEFAULT_WEIGHTS.persist).toBe(0)
  })

  it('不传权重时的分数与只传 0 完全相同', () => {
    const s = blank()
    s.players[0].board = [unit(900, 4, 4, ['stealth'])]
    s.players[1].board = [unit(901, 5, 5)]
    expect(score(s)).toBe(score(s, { persist: 0 }))
  })
})
