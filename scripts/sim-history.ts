// 历史名战难度模拟:六套预组轮流去打每一场名战,输出玩家胜率。
// 运行:npm run sim-history(GAMES=每场局数,默认 60)
//
// 与 sim-campaign 的关键差别:名战**带开局态势**(RunModifiers),必须把
// battleModifiers 传进 GameConfig —— 少传这一项,模拟出的难度就和实际玩的不是一回事。
//
// 闸门也不同:名战是**可自由挑选的设定局**,不是线性阶梯,所以不校验「单调递减」,
// 只校验每一场都落在「打得过、但要认真打」的带里(贪心 AI 基准尺 35%–68%)。
// 同样的警告:这测的是贪心 AI 的游戏,真人更强,故这里的胜率是**下限**。
//
// **护送(protect)目标只观察、不闸门**:贪心 AI 不懂「守住 VIP」,不会为保它而清场,
// 于是敌方总能把它秒了 → sim 恒为 0%,这是假阴性(真人会主动清威胁)。斩将(assassinate)
// 反而能测:目标带守护逼 AI 必须啃穿它,斩将自然发生。所以只把 protect 排除在闸门外。
import { HISTORY_BATTLES, battleDeck, battleModifiers } from '../src/content/historyBattles'
import { PRECON_DECKS } from '../src/content/decks'
import { CARDS_BY_ID } from '../src/content/cards'
import { HEROES_BY_ID } from '../src/content/overrides/heroes'
import { createGame } from '../src/engine/init'
import { applyCommand } from '../src/engine/reducer'
import { aiStep, AI_LEVELS, AI_NORMAL } from '../src/ai/greedy'
import { START_HP } from '../src/engine/types'
import type { GameConfig, PlayerIdx, Winner } from '../src/engine/types'

const GAMES = Number(process.env.GAMES ?? 60)
const BOSS_AI = process.env.BOSS_AI === 'general' ? AI_LEVELS.general : AI_NORMAL

// 「打得过、但要认真打」的带:低于 LOW 太劝退,高于 HIGH 太送。
const LOW = 35
const HIGH = 68

function play(battleIdx: number, playerDeckIdx: number, seed: number, first: PlayerIdx): Winner {
  const battle = HISTORY_BATTLES[battleIdx]
  const mine = PRECON_DECKS[playerDeckIdx]
  const myHero = HEROES_BY_ID[mine.heroId]
  const cfg: GameConfig = {
    seed,
    heroIds: [mine.heroId, battle.heroId],
    deckIds: [[...mine.cardIds], battleDeck(battle)],
    first,
    heroPowers: [myHero?.power, battle.power],
    heroHps: [myHero?.hp ?? START_HP, battle.hp],
    modifiers: battleModifiers(battle), // ← 名战的灵魂:开局态势
    objective: battle.objective, // 目标版(守成等);普通场为 undefined
  }
  let state = createGame(cfg, CARDS_BY_ID)
  const rngs: [number, number] = [seed ^ 0xa1, seed ^ 0xb2]
  let guard = 0
  while (state.phase !== 'ended') {
    if (++guard > 5000) return 'draw'
    const actor: PlayerIdx =
      state.phase === 'mulligan' ? (state.players[0].mulliganDone ? 1 : 0) : state.activePlayer
    const step = aiStep(state, actor, CARDS_BY_ID, rngs[actor], actor === 1 ? BOSS_AI : AI_NORMAL)
    rngs[actor] = step.rng
    const r = applyCommand(state, actor, step.cmd, CARDS_BY_ID)
    if (!r.ok) throw new Error(`AI illegal command (${r.error}) vs ${battle.foeName.zh}`)
    state = r.state
  }
  return state.winner ?? 'draw'
}

console.log(`sim-history: ${HISTORY_BATTLES.length} 场,${GAMES} 局/场(六套预组轮流上)\n`)
const t0 = performance.now()
const rates: number[] = []
for (let b = 0; b < HISTORY_BATTLES.length; b++) {
  let wins = 0
  for (let g = 0; g < GAMES; g++) {
    const w = play(b, g % PRECON_DECKS.length, b * 7919 + g * 31 + 1, ((g >> 1) % 2) as PlayerIdx)
    if (w === 0) wins++
  }
  const pct = Math.round((wins / GAMES) * 100)
  rates.push(pct)
  const observeOnly = HISTORY_BATTLES[b].objective?.kind === 'protect'
  const bar = '█'.repeat(Math.max(0, Math.round(pct / 4)))
  const flag = observeOnly ? ' (护送·仅观察)' : pct < LOW ? ' ← 太难' : pct > HIGH ? ' ← 太送' : ''
  console.log(
    `${String(b + 1).padStart(2)}. ${HISTORY_BATTLES[b].name.zh.padEnd(6)} ` +
      `hp=${String(HISTORY_BATTLES[b].hp).padStart(2)} tier=${HISTORY_BATTLES[b].deckTier.toFixed(2)}  ` +
      `玩家胜率 ${String(pct).padStart(3)}%  ${bar}${flag}`,
  )
}
console.log(`\n(${((performance.now() - t0) / 1000).toFixed(1)}s)`)

const problems: string[] = []
for (let b = 0; b < HISTORY_BATTLES.length; b++) {
  if (HISTORY_BATTLES[b].objective?.kind === 'protect') continue // 护送不闸门,见顶部注释
  if (rates[b] < LOW) problems.push(`${HISTORY_BATTLES[b].name.zh}:${rates[b]}% 太难(应 ≥${LOW}%)`)
  if (rates[b] > HIGH) problems.push(`${HISTORY_BATTLES[b].name.zh}:${rates[b]}% 太送(应 ≤${HIGH}%)`)
}
if (problems.length === 0) {
  console.log(`✓ 每场都落在 ${LOW}–${HIGH}% 的「打得过但要认真打」带里(护送场仅观察)`)
} else {
  console.log('⚠ 难度需要调整:')
  for (const p of problems) console.log(`  ${p}`)
  process.exit(1)
}
