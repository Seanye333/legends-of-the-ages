import { describe, expect, it } from 'vitest'
import { createGame } from './init'
import { refreshAuras, silenceGeneral } from './resolve'
import { CARDS_BY_ID, COLLECTIBLE_CARDS } from '../content/cards'
import { CLAN_ATTACK, CLAN_HEALTH, CLAN_QUORUM } from './types'
import type { GameConfig, GameEvent } from './types'

// 家族:和羁绊/宿敌同一条光环路径,但**没有锚点** ——
// 所以这一层的难点全在「谁算一个人头」上(同一个人的两张牌、被沉默的人)。
function boards(mine: string[], theirs: string[] = []) {
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
const base = (id: string) => [CARDS_BY_ID[id].attack!, CARDS_BY_ID[id].health!]

// 从卡池里现找一族两人,免得把测试钉死在某两个具体的人身上
// (族谱是生成的,谁跟谁同族会随源数据变)。
const CLANNED = COLLECTIBLE_CARDS.filter((c) => c.clan)
function twoOfOneClan(): [string, string] {
  const byClan = new Map<string, string[]>()
  for (const c of CLANNED) {
    const k = c.clan!.id
    byClan.set(k, [...(byClan.get(k) ?? []), c.id])
  }
  const pair = [...byClan.values()].find((ids) => ids.length >= 2)!
  return [pair[0], pair[1]]
}

describe('家族 clan', () => {
  it('内容自检:族谱有规模,且每一族的 size 与实际人数一致', () => {
    expect(CLANNED.length).toBeGreaterThan(300)
    const counted = new Map<string, number>()
    for (const c of CLANNED) counted.set(c.clan!.id, (counted.get(c.clan!.id) ?? 0) + 1)
    for (const c of CLANNED) {
      expect(c.clan!.size, `${c.name.zh} 的 ${c.clan!.name.zh}`).toBe(counted.get(c.clan!.id))
      // 一个人自己成不了一族
      expect(c.clan!.size).toBeGreaterThanOrEqual(CLAN_QUORUM)
    }
  })

  it('内容自检:族名是同族共用的一个对象,不是各写各的', () => {
    const nameByClan = new Map<string, string>()
    for (const c of CLANNED) {
      const seen = nameByClan.get(c.clan!.id)
      if (seen === undefined) nameByClan.set(c.clan!.id, c.clan!.name.zh)
      else expect(c.clan!.name.zh, c.clan!.id).toBe(seen)
    }
  })

  it('卡面写了家族 —— 否则这条机制在牌桌上是隐形的', () => {
    for (const c of CLANNED.slice(0, 40)) {
      expect(c.text?.zh, c.name.zh).toContain(`家族 · ${c.clan!.name.zh}`)
      expect(c.text?.zh, c.name.zh).toContain(`${c.clan!.size} 人`)
      expect(c.text?.en, c.name.zh).toContain(c.clan!.name.en)
    }
  })

  it('一个人在场不成族,同族两人在场则各吃一份', () => {
    const [a, b] = twoOfOneClan()
    const alone = boards([a])
    expect(alone.players[0].board[0].maxHealth).toBe(base(a)[1])

    const s = boards([a, b])
    for (const id of [a, b]) {
      expect(at(s, 0, id).attack, id).toBe(base(id)[0] + CLAN_ATTACK)
      expect(at(s, 0, id).maxHealth, id).toBe(base(id)[1] + CLAN_HEALTH)
    }
  })

  it('同一个人的两张牌不算一族(那是同一个人,不是父子)', () => {
    const [a] = twoOfOneClan()
    const s = boards([a, a])
    for (const u of s.players[0].board) expect(u.maxHealth).toBe(base(a)[1])
  })

  it('分处两侧不成族 —— 家族只看自己这半边(那是宿敌的活)', () => {
    const [a, b] = twoOfOneClan()
    const s = boards([a], [b])
    expect(at(s, 0, a).maxHealth).toBe(base(a)[1])
    expect(at(s, 1, b).maxHealth).toBe(base(b)[1])
  })

  it('被沉默的人既不算人头也不吃增益', () => {
    const [a, b] = twoOfOneClan()
    const s = boards([a, b])
    const events: GameEvent[] = []
    silenceGeneral({ player: 0, index: 0, inst: at(s, 0, a) }, CARDS_BY_ID, events)
    refreshAuras(s, CARDS_BY_ID)
    // 沉默的那个不吃(沉默本身也清了基础关键词,这里只看数值)
    expect(at(s, 0, a).maxHealth).toBe(base(a)[1])
    // 剩下的那个凑不齐人头,也退回原样
    expect(at(s, 0, b).maxHealth).toBe(base(b)[1])
  })

  it('人走了增益自动收回 —— 走的是光环那条撤销路径', () => {
    const [a, b] = twoOfOneClan()
    const s = boards([a, b])
    expect(at(s, 0, b).maxHealth).toBe(base(b)[1] + CLAN_HEALTH)
    s.players[0].board = s.players[0].board.filter((u) => u.defId !== a)
    refreshAuras(s, CARDS_BY_ID)
    expect(at(s, 0, b).maxHealth).toBe(base(b)[1])
  })

  it('三人在场也只给一份 —— 家族不随人数叠加', () => {
    const byClan = new Map<string, string[]>()
    for (const c of CLANNED) {
      const k = c.clan!.id
      byClan.set(k, [...(byClan.get(k) ?? []), c.id])
    }
    const trio = [...byClan.values()].find((ids) => ids.length >= 3)!.slice(0, 3)
    const s = boards(trio)
    for (const id of trio) expect(at(s, 0, id).maxHealth, id).toBe(base(id)[1] + CLAN_HEALTH)
  })
})
