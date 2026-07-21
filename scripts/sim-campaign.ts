// 关底战难度模拟:六套预组轮流去打八关,输出玩家胜率曲线。
// 运行:npm run sim-campaign(GAMES=每关局数,默认 60)
//
// 与 sim-balance 的区别:那个测的是「六套预组之间是否公平」,
// 这个测的是「难度曲线是否单调递减」——关底战不需要 50%,
// 但第 8 关不该比第 1 关还好打,而这种错误光看数值表是看不出来的。
//
// 同样的警告适用:这测的是贪心 AI 的游戏。真人玩家会比 AI 强,
// 所以这里的胜率是**下限**,实际体感会更容易一些。
import { BOSSES, bossDeck } from '../src/content/campaign'
import { PRECON_DECKS } from '../src/content/decks'
import { CARDS_BY_ID } from '../src/content/cards'
import { HEROES_BY_ID } from '../src/content/overrides/heroes'
import { createGame } from '../src/engine/init'
import { applyCommand } from '../src/engine/reducer'
import { aiStep, AI_LEVELS, AI_NORMAL } from '../src/ai/greedy'
import { START_HP } from '../src/engine/types'
import type { GameConfig, PlayerIdx, Winner } from '../src/engine/types'

const GAMES = Number(process.env.GAMES ?? 60)

// Boss 侧的 AI 档位。默认 AI_NORMAL —— 它是这套曲线一路调出来的基准尺,
// 换掉就没法和历史数字比了。
//
// `BOSS_AI=general` 可以量**名将档玩家实际面对的 Boss**:
// 名将比 AI_NORMAL 多一层前瞻(foresight),对打实测 64% 胜率。
// 这两个数字**不是一回事**,别混着看 —— campaign.ts 里记的曲线是前者。
const BOSS_AI = process.env.BOSS_AI === 'general' ? AI_LEVELS.general : AI_NORMAL

function play(bossIdx: number, playerDeckIdx: number, seed: number, first: PlayerIdx): Winner {
  const boss = BOSSES[bossIdx]
  const mine = PRECON_DECKS[playerDeckIdx]
  const myHero = HEROES_BY_ID[mine.heroId]
  const cfg: GameConfig = {
    seed,
    heroIds: [mine.heroId, boss.heroId],
    deckIds: [[...mine.cardIds], bossDeck(boss.doctrine, boss.deckTier)],
    first,
    heroPowers: [myHero?.power, boss.power],
    heroHps: [myHero?.hp ?? START_HP, boss.hp],
  }
  let state = createGame(cfg, CARDS_BY_ID)
  const rngs: [number, number] = [seed ^ 0xa1, seed ^ 0xb2]
  let guard = 0
  while (state.phase !== 'ended') {
    if (++guard > 5000) return 'draw'
    const actor: PlayerIdx =
      state.phase === 'mulligan' ? (state.players[0].mulliganDone ? 1 : 0) : state.activePlayer
    // 模拟的「玩家」恒用 AI_NORMAL 当基准尺;Boss 侧可以换档(见 BOSS_AI)
    const step = aiStep(state, actor, CARDS_BY_ID, rngs[actor], actor === 1 ? BOSS_AI : AI_NORMAL)
    rngs[actor] = step.rng
    const r = applyCommand(state, actor, step.cmd, CARDS_BY_ID)
    if (!r.ok) throw new Error(`AI illegal command (${r.error}) vs ${boss.name.zh}`)
    state = r.state
  }
  return state.winner ?? 'draw'
}

console.log(`sim-campaign: ${BOSSES.length} 关,${GAMES} 局/关(六套预组轮流上)\n`)
const t0 = performance.now()
const rates: number[] = []
for (let b = 0; b < BOSSES.length; b++) {
  let wins = 0
  for (let g = 0; g < GAMES; g++) {
    const w = play(b, g % PRECON_DECKS.length, b * 7919 + g * 31 + 1, ((g >> 1) % 2) as PlayerIdx)
    if (w === 0) wins++
  }
  const pct = Math.round((wins / GAMES) * 100)
  rates.push(pct)
  const bar = '█'.repeat(Math.max(0, Math.round(pct / 4)))
  console.log(
    `${String(b + 1).padStart(2)}. ${BOSSES[b].name.zh.padEnd(4)} ` +
      `hp=${String(BOSSES[b].hp).padStart(2)}  玩家胜率 ${String(pct).padStart(3)}%  ${bar}`,
  )
}
console.log(`\n(${((performance.now() - t0) / 1000).toFixed(1)}s)`)

// 闸门:首关要够友好,末关要够难,整体大致递减。
// 用「首末关差值」而不是「逐关严格递减」——相邻两关差几个点是噪声,不该报警。
const problems: string[] = []
if (rates[0] < 55) problems.push(`第 1 关玩家胜率仅 ${rates[0]}%,开局劝退`)
if (rates[rates.length - 1] > 45) {
  problems.push(`最终关玩家胜率 ${rates[rates.length - 1]}%,关底不够关底`)
}
const firstHalf = rates.slice(0, 4).reduce((a, b) => a + b, 0) / 4
const lastHalf = rates.slice(4).reduce((a, b) => a + b, 0) / 4
if (firstHalf - lastHalf < 10) {
  problems.push(
    `难度曲线太平:前四关均 ${Math.round(firstHalf)}% vs 后四关均 ${Math.round(lastHalf)}%`,
  )
}

if (problems.length === 0) {
  console.log('✓ 难度曲线合理:首关友好、末关有压力、整体递减')
} else {
  console.log('⚠ 难度曲线需要调整:')
  for (const p of problems) console.log(`  ${p}`)
  process.exit(1)
}
