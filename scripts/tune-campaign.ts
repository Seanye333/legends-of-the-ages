// 关底战难度自动调参:对每个 Boss 二分搜索**卡组质量分位 tier**,让玩家胜率落在目标附近。
// 运行:npm run tune-campaign(它只打印建议值,**不改代码**——数值要人过目再落库)
//
// 为什么搜 tier 而不是血量:实测血量是**弱旋钮**——把张角从 30 血压到 23 血,
// 玩家胜率只从 35% 挪到 37%;而 tier 从 0 调到 0.75,同一个张角从 35% 变成 97%。
// 原因是贪心 AI 的胜负主要由场面交换决定,主帅血量只在最后几回合才成为瓶颈。
// Boss 技能之间强度也差得离谱(每回合铺两个 1/1 远强于每回合 3 点伤害),
// 单靠人手试八个数值、每次等 20 秒,不如让机器二分。
import { BOSSES, bossDeck } from '../src/content/campaign'
import { PRECON_DECKS } from '../src/content/decks'
import { CARDS_BY_ID } from '../src/content/cards'
import { HEROES_BY_ID } from '../src/content/overrides/heroes'
import { createGame } from '../src/engine/init'
import { applyCommand } from '../src/engine/reducer'
import { aiStep, AI_NORMAL } from '../src/ai/greedy'
import { START_HP } from '../src/engine/types'
import type { BossDef } from '../src/content/campaign'
import type { GameConfig, PlayerIdx, Winner } from '../src/engine/types'

const GAMES = Number(process.env.GAMES ?? 48)

// 目标曲线,按章各成一段:开章友好、收官吃力、中间平滑过渡。
// 第二章开章时玩家已成军,所以它的「友好」定在 ~52% 而非第一章的 70%。
const TARGETS = [
  70, 63, 57, 50, 44, 37, 30, 22, // 第一章 汉末群雄
  52, 46, 42, 37, 32, 27, 20, 12, // 第二章 逐鹿千年
]

function play(boss: BossDef, tier: number, deckIdx: number, seed: number, first: PlayerIdx): Winner {
  const mine = PRECON_DECKS[deckIdx]
  const myHero = HEROES_BY_ID[mine.heroId]
  const cfg: GameConfig = {
    seed,
    heroIds: [mine.heroId, boss.heroId],
    deckIds: [[...mine.cardIds], bossDeck(boss.doctrine, tier)],
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
    const step = aiStep(state, actor, CARDS_BY_ID, rngs[actor], AI_NORMAL)
    rngs[actor] = step.rng
    const r = applyCommand(state, actor, step.cmd, CARDS_BY_ID)
    if (!r.ok) throw new Error(r.error)
    state = r.state
  }
  return state.winner ?? 'draw'
}

function winRate(boss: BossDef, tier: number): number {
  let wins = 0
  for (let g = 0; g < GAMES; g++) {
    const w = play(boss, tier, g % PRECON_DECKS.length, boss.hp * 7919 + g * 31 + 1, ((g >> 1) % 2) as PlayerIdx)
    if (w === 0) wins++
  }
  return (wins / GAMES) * 100
}

console.log(`tune-campaign: 每次测量 ${GAMES} 局,二分搜索卡组分位 tier\n`)
const t0 = performance.now()
const suggested: number[] = []

for (let i = 0; i < BOSSES.length; i++) {
  const boss = BOSSES[i]
  const target = TARGETS[i] ?? 40
  // tier 越大卡组越弱 → 玩家胜率越高,单调递增,可以二分
  let lo = 0
  let hi = 0.9
  let best = boss.deckTier
  let bestErr = Infinity
  for (let step = 0; step < 6; step++) {
    const mid = (lo + hi) / 2
    const rate = winRate(boss, mid)
    const err = Math.abs(rate - target)
    if (err < bestErr) {
      bestErr = err
      best = Math.round(mid * 100) / 100
    }
    if (rate > target) hi = mid
    else lo = mid
  }
  suggested.push(best)
  console.log(
    `${String(i + 1).padStart(2)}. ${boss.name.zh.padEnd(4)} 目标 ${String(target).padStart(2)}%  ` +
      `建议 tier ${best.toFixed(2)}(当前 ${boss.deckTier})  实测偏差 ±${Math.round(bestErr)}%`,
  )
}

console.log(`\n(${((performance.now() - t0) / 1000).toFixed(1)}s)`)
console.log('\n把这组 deckTier 填回 src/content/campaign.ts,再跑 npm run sim-campaign 验收:')
console.log(suggested.map((t, i) => `  ${BOSSES[i].name.zh}: deckTier ${t.toFixed(2)}`).join('\n'))
