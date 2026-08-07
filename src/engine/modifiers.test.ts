// 远征宝物修正:GameConfig.modifiers 在开局施加给对应座位。
import { describe, expect, it } from 'vitest'
import { createGame } from './init'
import { applyCommand } from './reducer'
import { effectiveCost } from './resolve'
import type { CardDef, CardLibrary, GameConfig } from './types'
import { SECOND_PLAYER_COMP, START_HP } from './types'

const power = { id: 'p', name: { zh: 'p', en: 'p' }, text: { zh: 'p', en: 'p' }, cost: 2, script: { ops: [{ op: 'draw' as const, count: 1 }] } }

const LIB: CardLibrary = Object.fromEntries(
  Array.from({ length: 40 }, (_, i): [string, CardDef] => [
    `c${i}`,
    { id: `c${i}`, collectorNo: i + 1, name: { zh: 'c', en: 'c' }, type: 'general', doctrine: 'neutral', dynasty: 'qun', rarity: 'common', archetype: 'warrior', cost: 3, attack: 2, health: 2, keywords: [] },
  ]).concat([['tok', { id: 'tok', collectorNo: 999, name: { zh: 't', en: 't' }, type: 'general', doctrine: 'neutral', dynasty: 'qun', rarity: 'common', archetype: 'warrior', cost: 1, attack: 2, health: 2, keywords: [], token: true }]]),
)

const deck = Array.from({ length: 30 }, (_, i) => `c${i}`)

function make(mod: NonNullable<GameConfig['modifiers']>[0]): GameConfig {
  return {
    seed: 5,
    heroIds: ['h', 'h'],
    deckIds: [deck, deck],
    first: 0,
    heroPowers: [power, power],
    heroHps: [START_HP + (mod?.bonusHandSize ? 0 : 0), START_HP],
    modifiers: [mod, undefined],
  }
}

// 后手补偿是**默认规则**,不是修饰符 —— 见 types.ts 的 SECOND_PLAYER_COMP。
// 下面几条断言里 1 号座位是后手(make 里 first: 0),所以它带着这份补偿。
describe('后手补偿(默认规则)', () => {
  it('后手起手全部手牌便宜 1 费,先手不便宜', () => {
    const s = createGame(make(undefined), LIB)
    for (const c of s.players[1].hand) expect(c.costDelta).toBe(SECOND_PLAYER_COMP.handCostDelta)
    for (const c of s.players[0].hand) expect(c.costDelta).toBe(0)
  })

  it('后手开局带护甲,先手不带', () => {
    const s = createGame(make(undefined), LIB)
    expect(s.players[1].armor).toBe(SECOND_PLAYER_COMP.startArmor)
    expect(s.players[0].armor).toBe(0)
  })

  it('**跟着先后手走,不跟着座位号走**', () => {
    // 这一条是整个补偿最容易写错的地方:座位 0 不一定先手。
    const s = createGame({ ...make(undefined), first: 1 }, LIB)
    expect(s.players[0].armor).toBe(SECOND_PLAYER_COMP.startArmor)
    expect(s.players[1].armor).toBe(0)
  })

  it('远征宝物**叠加**在补偿之上,不是替代', () => {
    // 后手同时拿到宝物时,两份护甲要相加 —— 早期写成 `mod?.startArmor ?? COMP` 的话
    // 宝物会把补偿悄悄吃掉,而那是一条不会报错的规则丢失。
    const cfg = { ...make(undefined), modifiers: [undefined, { startArmor: 5 }] as GameConfig['modifiers'] }
    const s = createGame(cfg, LIB)
    expect(s.players[1].armor).toBe(5 + SECOND_PLAYER_COMP.startArmor)
  })
})

describe('远征宝物修正', () => {
  it('开局护甲', () => {
    const s = createGame(make({ startArmor: 5 }), LIB)
    expect(s.players[0].armor).toBe(5)
    // 1 号是后手,所以它带着默认补偿的那 3 点 —— 这里验的是「宝物只给了 0 号」
    expect(s.players[1].armor).toBe(SECOND_PLAYER_COMP.startArmor)
  })

  it('起手多抽', () => {
    const base = createGame(make(undefined), LIB)
    const boosted = createGame(make({ bonusHandSize: 2 }), LIB)
    expect(boosted.players[0].hand.length).toBe(base.players[0].hand.length + 2)
  })

  it('开局衍生物上场', () => {
    const s = createGame(make({ startTokens: ['tok', 'tok'] }), LIB)
    expect(s.players[0].board.map((c) => c.defId)).toEqual(['tok', 'tok'])
    expect(s.players[1].board).toHaveLength(0)
  })

  it('起手手牌减费', () => {
    const s = createGame(make({ handCostDelta: -1 }), LIB)
    for (const c of s.players[0].hand) expect(effectiveCost(c, LIB)).toBe(2) // 3 - 1
  })

  it('主公技减费整局有效 —— 1 费就能用原本 2 费的主公技', () => {
    const s = createGame(make({ heroPowerCostDelta: -1 }), LIB)
    expect(s.players[0].heroPowerCostDelta).toBe(-1)
    // 直接构造主阶段、只有 1 法力的场面,验证减费后的主公技可用
    const battle = structuredClone(s)
    battle.phase = 'main'
    battle.activePlayer = 0
    battle.players[0].mana = { current: 1, max: 1 }
    const r = applyCommand(battle, 0, { type: 'UseHeroPower' }, LIB)
    expect(r.ok).toBe(true)
    // 没有减费的话 2 费主公技在 1 法力下会被拒
    const noMod = createGame(make(undefined), LIB)
    const b2 = structuredClone(noMod)
    b2.phase = 'main'
    b2.activePlayer = 0
    b2.players[0].mana = { current: 1, max: 1 }
    const r2 = applyCommand(b2, 0, { type: 'UseHeroPower' }, LIB)
    expect(r2.ok).toBe(false)
  })
})
