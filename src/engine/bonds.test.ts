import { describe, expect, it } from 'vitest'
import { createGame } from './init'
import { refreshAuras } from './resolve'
import { CARDS_BY_ID } from '../content/cards'
import { BOND_OVERRIDES } from '../content/overrides/bonds'
import type { GameConfig } from './types'

// 羁绊:走光环的附魔路径,所以「凑齐才有、散了就没」应当全自动。
function board(defIds: string[]) {
  const cfg: GameConfig = {
    seed: 3,
    heroIds: ['liu-bei', 'cao-cao'],
    deckIds: [[], []],
    first: 0,
    scenario: {
      activePlayer: 0,
      players: [
        { heroHp: 30, mana: 10, board: defIds.map((defId) => ({ defId })), hand: [] },
        { heroHp: 30, mana: 10, board: [], hand: [] },
      ],
    },
  }
  const s = createGame(cfg, CARDS_BY_ID)
  refreshAuras(s, CARDS_BY_ID)
  return s
}
const find = (s: ReturnType<typeof board>, defId: string) =>
  s.players[0].board.find((u) => u.defId === defId)!

describe('羁绊 bond', () => {
  it('内容自检:每条羁绊的成员都真实存在,且不含锚点自己', () => {
    for (const [anchor, ov] of Object.entries(BOND_OVERRIDES)) {
      const b = ov.bond!
      expect(CARDS_BY_ID[anchor], anchor).toBeDefined()
      expect(b.members).not.toContain(anchor)
      for (const m of b.members) expect(CARDS_BY_ID[m], `${b.id} → ${m}`).toBeDefined()
      expect(b.members.length).toBeGreaterThan(0)
    }
  })

  // 上线时这 31 条在卡面上一个字都没有 —— 机制只活在结算里,玩家永远发现不了。
  it('卡面写了羁绊 —— 机制不能只活在结算里', () => {
    for (const [anchor, ov] of Object.entries(BOND_OVERRIDES)) {
      expect(CARDS_BY_ID[anchor].bond?.id, anchor).toBe(ov.bond!.id)
      expect(CARDS_BY_ID[anchor].text?.zh, anchor).toContain(ov.bond!.name.zh)
    }
  })

  it('凑不齐不生效 —— 只有刘关没有张飞,谁都不加', () => {
    const s = board(['liu-bei', 'guan-yu'])
    const base = CARDS_BY_ID['liu-bei']
    expect(find(s, 'liu-bei').attack).toBe(base.attack)
  })

  it('凑齐则锚点与全体成员一起吃增益', () => {
    const s = board(['liu-bei', 'guan-yu', 'zhang-fei'])
    for (const id of ['liu-bei', 'guan-yu', 'zhang-fei']) {
      const inst = find(s, id)
      expect(inst.attack, id).toBe((CARDS_BY_ID[id].attack ?? 0) + 2)
      expect(inst.maxHealth, id).toBe((CARDS_BY_ID[id].health ?? 0) + 2)
    }
  })

  it('不相干的单位不吃增益', () => {
    const s = board(['liu-bei', 'guan-yu', 'zhang-fei', 'zhou-yu'])
    expect(find(s, 'zhou-yu').attack).toBe(CARDS_BY_ID['zhou-yu'].attack)
  })

  it('**羁绊断裂增益自动收回** —— 这是走光环路径的全部理由', () => {
    const s = board(['liu-bei', 'guan-yu', 'zhang-fei'])
    expect(find(s, 'liu-bei').attack).toBe((CARDS_BY_ID['liu-bei'].attack ?? 0) + 2)
    // 张飞离场 → 重算 → 羁绊断
    s.players[0].board = s.players[0].board.filter((u) => u.defId !== 'zhang-fei')
    refreshAuras(s, CARDS_BY_ID)
    expect(find(s, 'liu-bei').attack).toBe(CARDS_BY_ID['liu-bei'].attack)
    expect(find(s, 'guan-yu').attack).toBe(CARDS_BY_ID['guan-yu'].attack)
  })

  it('锚点被沉默则羁绊失效(与光环一致)', () => {
    const s = board(['liu-bei', 'guan-yu', 'zhang-fei'])
    find(s, 'liu-bei').silenced = true
    refreshAuras(s, CARDS_BY_ID)
    expect(find(s, 'guan-yu').attack).toBe(CARDS_BY_ID['guan-yu'].attack)
  })

  it('重复重算不叠加(幂等)', () => {
    const s = board(['liu-bei', 'guan-yu', 'zhang-fei'])
    refreshAuras(s, CARDS_BY_ID)
    refreshAuras(s, CARDS_BY_ID)
    expect(find(s, 'liu-bei').attack).toBe((CARDS_BY_ID['liu-bei'].attack ?? 0) + 2)
  })
})
