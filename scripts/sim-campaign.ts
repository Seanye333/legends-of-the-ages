// 关底战难度模拟:六套预组轮流去打八关,输出玩家胜率曲线。
// 运行:npm run sim-campaign(GAMES=每关局数,默认 60)
//
// 与 sim-balance 的区别:那个测的是「六套预组之间是否公平」,
// 这个测的是「难度曲线是否单调递减」——关底战不需要 50%,
// 但第 8 关不该比第 1 关还好打,而这种错误光看数值表是看不出来的。
//
// 同样的警告适用:这测的是贪心 AI 的游戏。真人玩家会比 AI 强,
// 所以这里的胜率是**下限**,实际体感会更容易一些。
import { BOSSES, bossDeck, bossChapter } from '../src/content/campaign'
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
    `${String(b + 1).padStart(2)}. 第${bossChapter(BOSSES[b])}章 ${BOSSES[b].name.zh.padEnd(4)} ` +
      `hp=${String(BOSSES[b].hp).padStart(2)}  玩家胜率 ${String(pct).padStart(3)}%  ${bar}`,
  )
}
console.log(`\n(${((performance.now() - t0) / 1000).toFixed(1)}s)`)

// 闸门按**章**分段:每章各是一条独立曲线(第二章开章时玩家已成军,
// 不该拿它去比张角那关的友好度)。逐章校验:
//   · 开章要够友好(第一章 ≥55 是新手门面;后续章玩家已有底子,放宽到 ≥35 ——
//     第二章是老兵的「困难本」,开章约 37% 仍明显比第一章末关的曹操(17%)松一倍,
//     读作一个能赢的新起点即可,不必再冲 55%。白起是霸道深池,已压到最软档 + 弱化技能,
//     再往上顶就得给作弊卡了,不值当;35% 是给噪声留的下限)
//   · 收官要够难(每章末关 ≤45)
//   · 章内整体递减(前半均 − 后半均 ≥ 8;用首末段差值而非逐关严格递减,躲开噪声)
// 用「章内前后半差值」而不是全局,避免跨章软重置被平均值糊掉、放过某一章的塌陷曲线。
const chapters = [...new Set(BOSSES.map(bossChapter))].sort((a, b) => a - b)
const problems: string[] = []
for (const ch of chapters) {
  const idx = BOSSES.map((b, i) => [b, i] as const).filter(([b]) => bossChapter(b) === ch)
  const chRates = idx.map(([, i]) => rates[i])
  if (chRates.length < 2) continue
  const openFloor = ch === chapters[0] ? 55 : 35
  if (chRates[0] < openFloor) {
    problems.push(`第 ${ch} 章开章胜率仅 ${chRates[0]}%(应 ≥${openFloor}%),劝退`)
  }
  if (chRates[chRates.length - 1] > 45) {
    problems.push(`第 ${ch} 章末关胜率 ${chRates[chRates.length - 1]}%,关底不够关底`)
  }
  const half = Math.floor(chRates.length / 2)
  const front = chRates.slice(0, half).reduce((a, b) => a + b, 0) / half
  const back = chRates.slice(half).reduce((a, b) => a + b, 0) / (chRates.length - half)
  if (front - back < 8) {
    problems.push(
      `第 ${ch} 章曲线太平:前半均 ${Math.round(front)}% vs 后半均 ${Math.round(back)}%`,
    )
  }
}

if (problems.length === 0) {
  console.log('✓ 各章难度曲线合理:开章友好、收官有压力、章内递减')
} else {
  console.log('⚠ 难度曲线需要调整:')
  for (const p of problems) console.log(`  ${p}`)
  process.exit(1)
}
