// 斩杀谜题挖矿:自对弈 PRECON 互搏,在每个「玩家回合开始」检查是否存在**非平凡** lethal,
// 命中就把这一帧抽成残局。每个候选都「重建后再解一次」验证(重建改变了可解性就丢),
// 去重、按干净度排序,写进 src/content/dailyPuzzles.ts(committed 数据,勿手改)。
//
// 运行:npm run mine-puzzles(SEEDS=自对弈局数,KEEP=保留题数)
// 确定性:全走种子 RNG,同参数逐字节可复现。
import { writeFileSync } from 'node:fs'
import { PRECON_DECKS } from '../src/content/decks'
import { CARDS_BY_ID } from '../src/content/cards'
import { HEROES_BY_ID } from '../src/content/overrides/heroes'
import { createGame } from '../src/engine/init'
import { applyCommand } from '../src/engine/reducer'
import { aiStep, AI_NORMAL } from '../src/ai/greedy'
import { solveLethal, trivialFaceLethal } from '../src/ai/lethalSolver'
import { extractScenario } from '../src/ai/mineScenario'
import { maxAttacksOf } from '../src/engine/combat'
import type { GameConfig, GameState, PlayerIdx, PuzzleScenario } from '../src/engine/types'
import { START_HP } from '../src/engine/types'

const SEEDS = Number(process.env.SEEDS ?? 800)
const KEEP = Number(process.env.KEEP ?? 24)
// 筛选预算小(多数回合没有斩杀,但要证明「无解」也得烧满预算 —— 这是挖矿主开销);
// 只有通过筛选的候选才用大预算重建复验。
const SCREEN_BUDGET = 4_000
const SOLVE_BUDGET = 40_000

// 极便宜的伤害上界:低于敌方有效血就绝无斩杀,直接跳过昂贵的求解器。
// 宽松估法(宁可高估):场面攻击×2(风怒余量)+ 法力×3(每点法力的爆发天花板)+ 6(主公技等)。
function damageCeiling(state: GameState, player: PlayerIdx): number {
  const me = state.players[player]
  let dmg = 6
  for (const u of me.board) dmg += u.attack * Math.max(2, maxAttacksOf(u))
  dmg += me.mana.current * 3
  return dmg
}
// 质量筛选:太短(1 步)太平凡,太长(>6 步)人算不动;场面太宽像乱摆。
const MIN_STEPS = 2
const MAX_STEPS = 6
// 只在小场面上挖:大场面既慢(搜索爆炸)又难看(像乱摆)—— 上界前置成筛选门,
// 既提质又提速(宽场面直接不搜)。
const MAX_TOTAL_BOARD = 6
const MAX_HAND = 5

interface Candidate {
  scenario: PuzzleScenario
  heroes: [string, string]
  steps: number
  key: string
}

// 残局功能指纹(忽略 iid),用于去重
function scenarioKey(sc: PuzzleScenario): string {
  const side = (i: 0 | 1) => {
    const s = sc.players[i]
    const board = s.board
      .map((u) => `${u.defId}/${u.damage ?? 0}/${u.exhausted ? 1 : 0}/${u.frozen ? 1 : 0}`)
      .sort()
      .join(',')
    const hand = [...s.hand].sort().join(',')
    return `${s.heroHp}+${s.armor ?? 0}|m${s.mana}|${board}|${hand}`
  }
  return `${sc.activePlayer}#${side(0)}#${side(1)}`
}

function play(a: number, b: number, seed: number, first: PlayerIdx, sink: (c: Candidate) => void) {
  const da = PRECON_DECKS[a]
  const db = PRECON_DECKS[b]
  const heroes = [HEROES_BY_ID[da.heroId], HEROES_BY_ID[db.heroId]]
  const cfg: GameConfig = {
    seed,
    heroIds: [da.heroId, db.heroId],
    deckIds: [[...da.cardIds], [...db.cardIds]],
    first,
    heroPowers: [heroes[0]?.power, heroes[1]?.power],
    heroHps: [heroes[0]?.hp ?? START_HP, heroes[1]?.hp ?? START_HP],
  }
  let state = createGame(cfg, CARDS_BY_ID)
  const rngs: [number, number] = [seed ^ 0x0a1a, seed ^ 0x0b2b]
  let guard = 0
  let lastTurn = -1
  while (state.phase !== 'ended') {
    if (++guard > 5000) return
    const actor: PlayerIdx =
      state.phase === 'mulligan'
        ? state.players[0].mulliganDone
          ? 1
          : 0
        : state.activePlayer

    // 回合开始(main、双方调度完、这一回合还没动过)的那一帧才检查
    if (
      state.phase === 'main' &&
      state.turn !== lastTurn &&
      state.players[actor].cardsPlayedThisTurn === 0
    ) {
      lastTurn = state.turn
      const foe = state.players[actor === 0 ? 1 : 0]
      const smallEnough =
        state.players[0].board.length + state.players[1].board.length <= MAX_TOTAL_BOARD &&
        state.players[actor].hand.length <= MAX_HAND
      const reachable = damageCeiling(state, actor) >= foe.heroHp + foe.armor
      if (smallEnough && reachable && !trivialFaceLethal(state, actor)) {
        const res = solveLethal(state, actor, CARDS_BY_ID, { nodeBudget: SCREEN_BUDGET })
        if (res && res.steps >= MIN_STEPS && res.steps <= MAX_STEPS) {
          const sc = extractScenario(state, actor, CARDS_BY_ID)
          if (sc) {
            const totalBoard = sc.players[0].board.length + sc.players[1].board.length
            const hand = sc.players[actor].hand.length
            if (totalBoard <= MAX_TOTAL_BOARD && hand <= MAX_HAND) {
              // 重建后复验:可解性必须保住,且仍非平凡
              const rebuilt = createGame(
                {
                  seed: 1,
                  heroIds: [da.heroId, db.heroId],
                  deckIds: [[], []],
                  first: actor,
                  heroPowers: [heroes[0]?.power, heroes[1]?.power],
                  scenario: sc,
                },
                CARDS_BY_ID,
              )
              const reSolve = solveLethal(rebuilt, actor, CARDS_BY_ID, { nodeBudget: SOLVE_BUDGET })
              if (reSolve && !trivialFaceLethal(rebuilt, actor)) {
                sink({
                  scenario: sc,
                  heroes: actor === 0 ? [da.heroId, db.heroId] : [db.heroId, da.heroId],
                  steps: reSolve.steps,
                  key: scenarioKey(sc),
                })
              }
            }
          }
        }
      }
    }

    const step = aiStep(state, actor, CARDS_BY_ID, rngs[actor], AI_NORMAL)
    rngs[actor] = step.rng
    const r = applyCommand(state, actor, step.cmd, CARDS_BY_ID)
    if (!r.ok) return
    state = r.state
  }
}

// 注意:extractScenario 把座位保持为原局座位(activePlayer 可能是 1)。
// 但谜题里玩家恒为 0 号。若挖到的是 1 号回合,要把两边对调、activePlayer 归 0。
function normalizeToPlayerZero(c: Candidate): Candidate {
  if (c.scenario.activePlayer === 0) return c
  const sc: PuzzleScenario = {
    activePlayer: 0,
    rng: c.scenario.rng,
    players: [c.scenario.players[1], c.scenario.players[0]],
  }
  return { scenario: sc, heroes: [c.heroes[0], c.heroes[1]], steps: c.steps, key: scenarioKey(sc) }
}

const n = PRECON_DECKS.length
const found = new Map<string, Candidate>()
console.log(`mine-puzzles: ${n} decks, ${SEEDS} self-play games, solve budget ${SOLVE_BUDGET}`)
const t0 = performance.now()

for (let g = 0; g < SEEDS; g++) {
  const a = g % n
  const b = (g * 7 + 1) % n
  if (a === b) continue
  const first = (g & 1) as PlayerIdx
  play(a, b, g * 104729 + 12345, first, (c0) => {
    const c = normalizeToPlayerZero(c0)
    if (!found.has(c.key)) found.set(c.key, c)
  })
  if (g % 100 === 0) process.stdout.write('.')
}

const all = [...found.values()]
// 干净度排序:步数适中优先(3 步最甜),再偏好较小场面
all.sort((x, y) => {
  const sweet = (s: number) => Math.abs(s - 3)
  if (sweet(x.steps) !== sweet(y.steps)) return sweet(x.steps) - sweet(y.steps)
  const bx = x.scenario.players[0].board.length + x.scenario.players[1].board.length
  const by = y.scenario.players[0].board.length + y.scenario.players[1].board.length
  return bx - by
})
const kept = all.slice(0, KEEP)

const ms = Math.round(performance.now() - t0)
console.log(`\n候选 ${all.length} 道(去重后),保留 ${kept.length} 道,用时 ${ms}ms`)
for (const c of kept.slice(0, 40)) {
  const heroZh = HEROES_BY_ID[c.heroes[0]]?.name.zh ?? c.heroes[0]
  console.log(
    `  ${c.steps}步 ${heroZh}  场面 ${c.scenario.players[0].board.length}v${c.scenario.players[1].board.length} 手牌${c.scenario.players[0].hand.length} 敌血${c.scenario.players[1].heroHp}`,
  )
}

// 写数据文件(committed;勿手改,改了重跑 npm run mine-puzzles)
const body = kept
  .map((c, i) => {
    const diff = c.steps <= 2 ? 1 : c.steps <= 4 ? 2 : 3
    return `  {
    id: 'dp-${String(i + 1).padStart(2, '0')}',
    heroes: ${JSON.stringify(c.heroes)},
    difficulty: ${diff},
    scenario: ${JSON.stringify(c.scenario)},
  },`
  })
  .join('\n')

const out = `// 每日谜题池 —— 由 \`npm run mine-puzzles\` 从真实自对弈局面挖出的残局,**勿手改**。
// 每道题都经过「重建后再解一次」验证:一回合内存在非平凡 lethal。
// 结构与手搓题(lethalPuzzles.ts)同构,复用同一套残局构造器与 UI。
import type { PuzzleScenario } from '../engine/types'

export interface GeneratedPuzzle {
  id: string
  heroes: [string, string]
  difficulty: 1 | 2 | 3
  scenario: PuzzleScenario
}

export const DAILY_POOL: GeneratedPuzzle[] = [
${body}
]
`
const target = new URL('../src/content/dailyPuzzles.ts', import.meta.url)
writeFileSync(target, out)
console.log(`已写入 src/content/dailyPuzzles.ts(${kept.length} 道)`)
