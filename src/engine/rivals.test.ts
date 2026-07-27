import { describe, expect, it } from 'vitest'
import { createGame } from './init'
import { refreshAuras } from './resolve'
import { CARDS_BY_ID } from '../content/cards'
import { RIVAL_OVERRIDES, RIVAL_LORE } from '../content/overrides/rivals'
import type { GameConfig } from './types'

// 宿敌:与羁绊同一条光环路径,但条件跨场 —— 所以「谁在哪一边」是这一层的全部难点。
function boards(mine: string[], theirs: string[]) {
  const cfg: GameConfig = {
    seed: 7,
    heroIds: ['liu-bei', 'cao-cao'],
    deckIds: [[], []],
    first: 0,
    scenario: {
      activePlayer: 0,
      players: [
        { heroHp: 30, mana: 10, board: mine.map((defId) => ({ defId })), hand: [] },
        { heroHp: 30, mana: 10, board: theirs.map((defId) => ({ defId })), hand: [] },
      ],
    },
  }
  const s = createGame(cfg, CARDS_BY_ID)
  refreshAuras(s, CARDS_BY_ID)
  return s
}
const at = (s: ReturnType<typeof boards>, side: 0 | 1, defId: string) =>
  s.players[side].board.find((u) => u.defId === defId)!

describe('宿敌 rival', () => {
  it('内容自检:锚点与宿敌都真实存在,且不是自己', () => {
    for (const [anchor, ov] of Object.entries(RIVAL_OVERRIDES)) {
      const r = ov.rival!
      expect(CARDS_BY_ID[anchor], anchor).toBeDefined()
      expect(CARDS_BY_ID[r.foe], `${r.id} → ${r.foe}`).toBeDefined()
      expect(r.foe).not.toBe(anchor)
    }
  })

  it('内容自检:覆盖真的落到了最终卡池上(不是写了个没人读的表)', () => {
    for (const [anchor, ov] of Object.entries(RIVAL_OVERRIDES)) {
      expect(CARDS_BY_ID[anchor].rival?.id, anchor).toBe(ov.rival!.id)
    }
  })

  it('内容自检:宿敌 id 唯一,且每条都有史料', () => {
    const ids = Object.values(RIVAL_OVERRIDES).map((ov) => ov.rival!.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const id of ids) expect(RIVAL_LORE[id], id).toBeDefined()
  })

  // 引擎两个方向都扫,所以互相声明会叠两次 —— 这是最容易犯的内容错误。
  it('内容自检:不许互相声明(A→B 且 B→A)', () => {
    for (const [anchor, ov] of Object.entries(RIVAL_OVERRIDES)) {
      const back = RIVAL_OVERRIDES[ov.rival!.foe]
      if (back) expect(back.rival!.foe, `${anchor} ⇄ ${ov.rival!.foe} 互相声明`).not.toBe(anchor)
    }
  })

  it('同侧不触发 —— 宿敌站在自己这边等于没这回事', () => {
    const s = boards(['zhuge-liang', 'sima-yi'], [])
    expect(at(s, 0, 'zhuge-liang').attack).toBe(CARDS_BY_ID['zhuge-liang'].attack)
    expect(at(s, 0, 'sima-yi').attack).toBe(CARDS_BY_ID['sima-yi'].attack)
  })

  it('异侧触发,而且双方一起吃', () => {
    const s = boards(['zhuge-liang'], ['sima-yi'])
    const r = CARDS_BY_ID['zhuge-liang'].rival!
    expect(at(s, 0, 'zhuge-liang').attack).toBe(CARDS_BY_ID['zhuge-liang'].attack! + r.attack)
    expect(at(s, 1, 'sima-yi').attack).toBe(CARDS_BY_ID['sima-yi'].attack! + r.attack)
    expect(at(s, 1, 'sima-yi').maxHealth).toBe(CARDS_BY_ID['sima-yi'].health! + r.health)
  })

  it('反过来摆也触发同一条 —— 一条声明管两个方向', () => {
    const s = boards(['sima-yi'], ['zhuge-liang'])
    const r = CARDS_BY_ID['zhuge-liang'].rival!
    expect(at(s, 0, 'sima-yi').attack).toBe(CARDS_BY_ID['sima-yi'].attack! + r.attack)
    expect(at(s, 1, 'zhuge-liang').attack).toBe(CARDS_BY_ID['zhuge-liang'].attack! + r.attack)
  })

  it('对面摆两个宿敌,锚点也只吃一份(两个宿敌各吃一份)', () => {
    const s = boards(['zhuge-liang'], ['sima-yi', 'sima-yi'])
    const r = CARDS_BY_ID['zhuge-liang'].rival!
    expect(at(s, 0, 'zhuge-liang').attack).toBe(CARDS_BY_ID['zhuge-liang'].attack! + r.attack)
    for (const u of s.players[1].board) {
      expect(u.attack).toBe(CARDS_BY_ID['sima-yi'].attack! + r.attack)
    }
  })

  it('宿敌离场则增益收回 —— 走光环路径,不需要反向登记', () => {
    const s = boards(['zhuge-liang'], ['sima-yi'])
    s.players[1].board = []
    refreshAuras(s, CARDS_BY_ID)
    expect(at(s, 0, 'zhuge-liang').attack).toBe(CARDS_BY_ID['zhuge-liang'].attack)
  })

  it('锚点被沉默则整条失效(双方都收回)', () => {
    const s = boards(['zhuge-liang'], ['sima-yi'])
    at(s, 0, 'zhuge-liang').silenced = true
    refreshAuras(s, CARDS_BY_ID)
    expect(at(s, 1, 'sima-yi').attack).toBe(CARDS_BY_ID['sima-yi'].attack)
  })

  // 同一对人既是羁绊又是宿敌 —— 孙膑与庞涓。同侧同门,异侧马陵道。
  it('孫臏 · 龐涓:同侧走羁绊,异侧走宿敌,两者不会同时生效', () => {
    const same = boards(['hist-sun-bin', 'hist-pang-juan'], [])
    const bond = CARDS_BY_ID['hist-sun-bin'].bond!
    expect(at(same, 0, 'hist-sun-bin').attack).toBe(CARDS_BY_ID['hist-sun-bin'].attack! + bond.attack)

    const split = boards(['hist-sun-bin'], ['hist-pang-juan'])
    const rival = CARDS_BY_ID['hist-sun-bin'].rival!
    expect(at(split, 0, 'hist-sun-bin').attack).toBe(
      CARDS_BY_ID['hist-sun-bin'].attack! + rival.attack,
    )
  })

  it('卡面写了宿敌 —— 机制不能只活在结算里', () => {
    for (const [anchor, ov] of Object.entries(RIVAL_OVERRIDES)) {
      expect(CARDS_BY_ID[anchor].text?.zh, anchor).toContain(ov.rival!.name.zh)
    }
  })
})
