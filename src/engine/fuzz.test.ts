import { describe, expect, it } from 'vitest'
import { createGame } from './init'
import { applyCommand } from './reducer'
import { legalCommands } from './legal'
import { rngInt } from './rng'
import { replayMatch, type MatchRecord } from './replay'
import type { CardDef, CardLibrary, GameConfig, GameState } from './types'
import { BOARD_LIMIT, HAND_LIMIT, MANA_CAP, TURN_LIMIT } from './types'

// 模糊测试:种子随机地在合法命令里乱走,任何违反不变量的路径都会暴露。
// 契约:legalCommands 返回的命令 applyCommand 必须全部接受。

function def(id: string, over: Partial<CardDef>): CardDef {
  return {
    id,
    collectorNo: 1,
    name: { zh: id, en: id },
    type: 'general',
    doctrine: 'neutral',
    dynasty: 'qun',
    rarity: 'common',
    archetype: 'warrior',
    cost: 2,
    attack: 2,
    health: 3,
    keywords: [],
    ...over,
  }
}

const LIB: CardLibrary = Object.fromEntries(
  [
    def('f-van1', { cost: 1, attack: 1, health: 2 }),
    def('f-van2', {}),
    def('f-van3', { cost: 4, attack: 4, health: 5 }),
    def('f-charge', { cost: 3, attack: 3, health: 2, keywords: ['charge'] }),
    def('f-rush', { cost: 2, attack: 2, health: 2, keywords: ['rush'] }),
    def('f-wall', { cost: 3, attack: 2, health: 5, keywords: ['guard'] }),
    def('f-wind', { cost: 5, attack: 3, health: 4, keywords: ['windfury'] }),
    def('f-duel', { cost: 5, attack: 5, health: 4, keywords: ['duel'] }),
    def('f-sniper', {
      cost: 3,
      battlecry: { ops: [{ op: 'damage', amount: 2, target: 'chosenEnemyGeneral' }] },
    }),
    def('f-bomber', { cost: 3, deathrattle: { ops: [{ op: 'aoeDamage', amount: 1 }] } }),
    def('f-medic', {
      cost: 2,
      attack: 1,
      health: 3,
      battlecry: { ops: [{ op: 'heal', amount: 3, target: 'friendlyHero' }] },
    }),
    def('f-summoner', { cost: 4, battlecry: { ops: [{ op: 'summon', defId: 'f-van1', count: 2 }] } }),
    def('f-reaper', {
      cost: 6,
      attack: 4,
      health: 4,
      battlecry: { ops: [{ op: 'destroy', target: 'randomEnemyGeneral' }] },
    }),
    def('f-strat-bolt', {
      type: 'stratagem',
      cost: 2,
      attack: undefined,
      health: undefined,
      spell: { ops: [{ op: 'damage', amount: 3, target: 'chosenAny' }] },
    }),
    def('f-strat-aoe', {
      type: 'stratagem',
      cost: 4,
      attack: undefined,
      health: undefined,
      spell: { ops: [{ op: 'aoeDamage', amount: 2 }] },
    }),
    def('f-strat-draw', {
      type: 'stratagem',
      cost: 2,
      attack: undefined,
      health: undefined,
      spell: { ops: [{ op: 'draw', count: 2 }] },
    }),
    def('f-strat-buff', {
      type: 'stratagem',
      cost: 3,
      attack: undefined,
      health: undefined,
      spell: {
        ops: [
          { op: 'buffStats', attack: 2, health: 2, target: 'chosenAny' },
          { op: 'grantKeyword', keyword: 'guard', target: 'chosenAny' },
        ],
      },
    }),
    // ---- 第五卡包:让 fuzz 真的踩到抉择与发现的路径 ----
    // 抉择武将:一个模式要目标、一个不要 —— 正是 legal/apply 契约最容易破的形状
    def('f-choose-gen', {
      cost: 3,
      attack: 2,
      health: 3,
      choose: {
        modes: [
          { label: { zh: 'A', en: 'A' }, script: { ops: [{ op: 'grantKeyword', keyword: 'guard', target: 'self' }] } },
          { label: { zh: 'B', en: 'B' }, script: { ops: [{ op: 'damage', amount: 2, target: 'chosenEnemyGeneral' }] } },
        ],
      },
    }),
    def('f-choose-strat', {
      type: 'stratagem',
      cost: 2,
      attack: undefined,
      health: undefined,
      choose: {
        modes: [
          { label: { zh: 'A', en: 'A' }, script: { ops: [{ op: 'draw', count: 1 }] } },
          { label: { zh: 'B', en: 'B' }, script: { ops: [{ op: 'damage', amount: 3, target: 'chosenAny' }] } },
        ],
      },
    }),
    // 发现:把对局停在 pendingChoice 上,fuzz 必须能从挂起里选出去、不卡死
    def('f-discover', {
      type: 'stratagem',
      cost: 2,
      attack: undefined,
      health: undefined,
      spell: { ops: [{ op: 'discover', pool: 'myGeneral' }] },
    }),
    // ---- 第六卡包:势力羁绊 / 关键词 payoff ----
    def('f-dynasty-lord', {
      cost: 4,
      dynasty: 'shu',
      battlecry: { ops: [{ op: 'buffPer', per: { kind: 'friendlyDynasty' }, attack: 1, health: 1, target: 'self' }] },
    }),
    def('f-leech', { cost: 2, keywords: ['lifesteal'] }),
    def('f-leech-payoff', {
      type: 'stratagem',
      cost: 3,
      attack: undefined,
      health: undefined,
      spell: {
        ops: [{ op: 'buffPer', per: { kind: 'friendlyKeyword', keyword: 'lifesteal' }, attack: 1, health: 1, target: 'allFriendlyGenerals' }],
      },
    }),
    def('f-swarm-payoff', {
      type: 'stratagem',
      cost: 4,
      attack: undefined,
      health: undefined,
      spell: { ops: [{ op: 'draw', count: 2 }], condition: { ifKeywordCount: { keyword: 'guard', atLeast: 2 } } },
    }),
    // ---- 第七卡包:费用消减 / 牌生成 ----
    def('f-discount', {
      type: 'stratagem', cost: 2, attack: undefined, health: undefined,
      spell: { ops: [{ op: 'reduceCost', amount: 1, filter: 'all' }] },
    }),
    def('f-generator', {
      cost: 3, battlecry: { ops: [{ op: 'addToHand', defId: 'f-van1', count: 2 }] },
    }),
    // ---- 第八卡包:变形 / 复生 ----
    def('f-polymorph', {
      type: 'stratagem', cost: 4, attack: undefined, health: undefined,
      spell: { ops: [{ op: 'transform', target: 'chosenEnemyGeneral', into: 'f-van1' }] },
    }),
    def('f-rez', {
      type: 'stratagem', cost: 5, attack: undefined, health: undefined,
      spell: { ops: [{ op: 'resurrect', count: 2 }] },
    }),
    // ---- 第十卡包:缩放伤害 / 献祭 ----
    def('f-warcry', {
      type: 'stratagem', cost: 4, attack: undefined, health: undefined,
      spell: { ops: [{ op: 'damagePer', per: { kind: 'friendlyGenerals' }, amount: 1, target: 'enemyHero' }] },
    }),
    def('f-sacrifice', {
      type: 'stratagem', cost: 2, attack: undefined, health: undefined,
      spell: { ops: [{ op: 'destroy', target: 'chosenFriendlyGeneral' }, { op: 'draw', count: 1 }] },
    }),
    // ---- 第十一卡包:攻击后 onAttack —— 让 fuzz 踩到「交战后再跑一段脚本」的路径 ----
    // 突袭身 + onAttack 抽牌:攻击→存活→抽牌,顺便测「攻击者战死则不触发」
    def('f-vanguard', {
      cost: 3, attack: 3, health: 4, keywords: ['rush'],
      onAttack: { ops: [{ op: 'draw', count: 1 }] },
    }),
    // onAttack 自增益(self 目标在攻击后语境要能正确指到攻击者)
    def('f-berserker', {
      cost: 4, attack: 3, health: 5, keywords: ['rush'],
      onAttack: { ops: [{ op: 'buffStats', attack: 1, health: 1, target: 'self' }] },
    }),
    // ---- 第十二卡包:碾压 —— 让 fuzz 踩到「攻击武将后溢出打脸」的路径 ----
    def('f-trampler', { cost: 5, attack: 6, health: 4, keywords: ['trample'] }),
    // ---- 第十三卡包:激怒 —— 受伤/治疗都要正确开关派生攻击 ----
    def('f-enrage', { cost: 4, attack: 2, health: 6, enrage: 3 }),
    // ---- 第十四卡包:移形换位 —— 交换攻血,负 delta 附魔也要合法 ----
    def('f-swap', {
      type: 'stratagem', cost: 3, attack: undefined, health: undefined,
      spell: { ops: [{ op: 'swapStats', target: 'chosenEnemyGeneral' }] },
    }),
    // ---- 第十五卡包:施法触发 —— 每打出锦囊后自增益,踩板扫触发的路径 ----
    def('f-spellcaster', {
      cost: 2, attack: 1, health: 3,
      onSpellCast: { ops: [{ op: 'buffStats', attack: 1, health: 0, target: 'self' }] },
    }),
    // ---- 第十六卡包:搜将 —— 从牌库拉武将,空库/满场/无武将都要不炸 ----
    def('f-recruit', {
      cost: 4, battlecry: { ops: [{ op: 'recruit', count: 2 }] },
    }),
  ].map((d) => [d.id, d]),
)

const DECK_POOL = Object.keys(LIB)

function buildDeck(seedBase: number): string[] {
  const deck: string[] = []
  let s = seedBase
  for (let i = 0; i < 30; i++) {
    const roll = rngInt(s, DECK_POOL.length)
    s = roll.next
    deck.push(DECK_POOL[roll.value])
  }
  return deck
}

function assertInvariants(state: GameState): void {
  for (const p of state.players) {
    expect(p.hand.length).toBeLessThanOrEqual(HAND_LIMIT)
    expect(p.board.length).toBeLessThanOrEqual(BOARD_LIMIT)
    // 用 heroMaxHp 而不是常量 START_HP:引擎的治疗上限读的就是前者
    // (resolve.ts 的 healHero)。写死 30 只是因为 fuzz 的 cfg 没传 heroHps
    // 而碰巧成立 —— 一旦给高血主公开 fuzz,这条会变成假阳性。
    expect(p.heroHp).toBeLessThanOrEqual(p.heroMaxHp)
    expect(p.mana.max).toBeLessThanOrEqual(MANA_CAP)
    expect(p.mana.current).toBeGreaterThanOrEqual(0)
    for (const c of p.board) {
      expect(c.health).toBeGreaterThan(0) // 死亡必须已被结算
      expect(c.attacksUsed).toBeLessThanOrEqual(2)
    }

    // ---- 第二批不变量(2026-07)----
    // 上面五条是原有的。下面这些此前**没有任何断言保护** ——
    // 而 resolve.ts 与 reducer.ts 里 throw 的数量是 0 和 0,
    // 也就是说对局中一处运行时校验都没有,全靠「代码写对了」。

    // 可用法力不能超过本回合上限(超了等于凭空多打一张牌)
    expect(p.mana.current).toBeLessThanOrEqual(p.mana.max)
    // 护甲不为负。gainArmor 是裸 `p.armor += n`,没有下限。
    // (heroHp **可以**为负 —— 那是斩杀时的溢出伤害,实测能到 -3。
    //  真正该钉的是下面那条「血 ≤ 0 就必须已结算」,不是「血非负」。)
    expect(p.armor).toBeGreaterThanOrEqual(0)
    // 血掉到 0 就必须已经结算成终局 —— 不能出现「0 血还在打」
    if (p.heroHp <= 0) expect(state.phase).toBe('ended')
    // 过载记账不为负
    expect(p.overloadNext).toBeGreaterThanOrEqual(0)
    expect(p.overloadLocked).toBeGreaterThanOrEqual(0)
    // 附魔层有界:光环每次 refresh 都整批清掉重算,泄漏的话这里会无限增长。
    // 32 是个宽松的天花板 —— 正常局面下单个单位的附魔个位数。
    for (const c of [...p.board, ...p.hand]) {
      expect(c.enchants.length).toBeLessThanOrEqual(32)
    }
  }

  // iid 全局唯一。**这条此前只在建局那一刻查过**(scenario.test.ts),
  // 而 summon / addToHand / recruit / resurrect / transform / discover
  // 全都在对局中从 nextIid 铸新 id —— 中途撞号没有任何东西会发现,
  // 而撞号之后「按 iid 找单位」会找到错的那个。
  const seen = new Set<number>()
  for (const p of state.players) {
    for (const zone of [p.board, p.hand, p.deck, p.secrets]) {
      for (const c of zone) {
        expect(seen.has(c.iid), `iid ${c.iid} 出现了两次`).toBe(false)
        seen.add(c.iid)
        // nextIid 必须始终大于所有已发出的 id,否则下一次铸号就会撞
        expect(c.iid).toBeLessThan(state.nextIid)
      }
    }
  }

  expect(state.turn).toBeLessThanOrEqual(TURN_LIMIT + 1)
}

function runFuzzGame(seed: number): { state: GameState; record: MatchRecord; steps: number } {
  const cfg: GameConfig = {
    seed,
    heroIds: ['hero-a', 'hero-b'],
    // 【为什么必须给主公技】
    // 不给的话 legalCommands 永远不产出 UseHeroPower/UpgradeHeroPower ——
    // 也就是说 fuzz 此前**一次都没走过主公技这条路**,而它每回合都会被用到,
    // 还牵着升阶、费用调整、一回合一次这几条状态。
    // 两边给不同的技能:一个点杀(带目标)、一个召唤 + 升阶(改变场面宽度)。
    heroPowers: [
      {
        id: 'fz-hp-a',
        name: { zh: '试', en: 'Test A' },
        text: { zh: '造成 1 点伤害。', en: 'Deal 1 damage.' },
        cost: 2,
        script: { ops: [{ op: 'damage', amount: 1, target: 'chosenAny' }] },
      },
      {
        id: 'fz-hp-b',
        name: { zh: '募', en: 'Test B' },
        text: { zh: '召唤一个 1/1。', en: 'Summon a 1/1.' },
        cost: 2,
        script: { ops: [{ op: 'summon', defId: 'f-van1', count: 1 }] },
        // 升阶那条路径同样从没被 fuzz 走过
        upgradeCost: 3,
        upgrade: {
          id: 'fz-hp-b2',
          name: { zh: '募·改', en: 'Test B+' },
          text: { zh: '召唤两个 1/1。', en: 'Summon two 1/1s.' },
          cost: 2,
          script: { ops: [{ op: 'summon', defId: 'f-van1', count: 2 }] },
        },
      },
    ],
    deckIds: [buildDeck(seed * 7 + 1), buildDeck(seed * 13 + 5)],
    first: seed % 2 === 0 ? 0 : 1,
  }
  let state = createGame(cfg, LIB)
  const record: MatchRecord = { cfg, commands: [] }
  let pick = seed * 31 + 17
  let steps = 0

  while (state.phase !== 'ended') {
    steps++
    expect(steps).toBeLessThan(3000)
    const actors = state.phase === 'mulligan' ? ([0, 1] as const) : ([state.activePlayer] as const)
    for (const player of actors) {
      if (state.phase === 'ended') break
      const commands = legalCommands(state, player, LIB).filter((c) => c.type !== 'Concede')
      if (commands.length === 0) continue
      // 偏向前面的命令(出牌/攻击),EndTurn 兜底;避免全随机导致每回合立刻结束
      const roll = rngInt(pick, commands.length)
      pick = roll.next
      const cmd = commands[roll.value]
      const r = applyCommand(state, player, cmd, LIB)
      expect(r.ok, `legal command rejected: ${JSON.stringify(cmd)} → ${r.ok ? '' : r.error}`).toBe(true)
      if (r.ok) {
        state = r.state
        record.commands.push({ player, cmd })
        assertInvariants(state)
      }
    }
  }
  expect(state.winner).toBeDefined()
  return { state, record, steps }
}

describe('fuzz: random legal games', () => {
  // 显式放宽超时:卡池播种机制后单局分支变多,冷启动那一轮偶尔会顶到默认的 5s。
  it(
    '100 seeded games terminate with all invariants held',
    () => {
      for (let seed = 1; seed <= 100; seed++) {
        runFuzzGame(seed)
      }
    },
    // 60s 而不是 20s:给主公技之后单跑要 9-12s、全量并行跑要 17-19s ——
    // 20s 的余量太薄,实测在负载高的时候会随机超时红。
    // 这是**唯一**一个长测试,宁可给足余量也不要一道随机翻红的闸门。
    60_000,
  )

  it('replays reproduce the exact final state', () => {
    for (let seed = 1; seed <= 10; seed++) {
      const { state, record } = runFuzzGame(seed)
      const replayed = replayMatch(record, LIB)
      expect(replayed.ok).toBe(true)
      if (replayed.ok) expect(replayed.state).toEqual(state)
    }
  })
})
