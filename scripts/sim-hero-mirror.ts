// 备选主公技的平衡校验。
//
// sim-balance 只测预组(用六位基准主公),测不到备选主公技。这个脚本补那个洞:
// 对每个主义,拿它的预组打一场**镜像**——一边基准主公、一边备选主公,同一副牌、
// 座位与先后手轮满。备选主公技如果和基准差不多强,镜像胜率应在 ~50%。
//
// 备选主公技全部借用另一条轴上已验证过的招(见 heroes.ts),所以这里是回归防线:
// 确认「换个主义用」没有意外地过强/过弱。闸门:每个备选主公 40–60%。
import { createGame } from '../src/engine/init'
import { applyCommand } from '../src/engine/reducer'
import { aiStep, AI_NORMAL } from '../src/ai/greedy'
import { CARDS_BY_ID } from '../src/content/cards'
import { PRECON_DECKS } from '../src/content/decks'
import { HEROES, ALT_HEROES, HEROES_BY_ID } from '../src/content/overrides/heroes'
import type { GameConfig, PlayerIdx, Winner } from '../src/engine/types'
import { START_HP } from '../src/engine/types'

const GAMES = Number(process.env.GAMES ?? 100)

// 一场:altSeat 用备选主公,另一边用基准主公,同一副 deck。
function play(
  deck: string[],
  baseId: string,
  altId: string,
  altSeat: PlayerIdx,
  seed: number,
): Winner {
  const heroFor = (seat: PlayerIdx) => (seat === altSeat ? altId : baseId)
  const cfg: GameConfig = {
    seed,
    heroIds: [heroFor(0), heroFor(1)],
    deckIds: [deck, deck],
    first: (seed & 1) as PlayerIdx,
    heroPowers: [HEROES_BY_ID[heroFor(0)].power, HEROES_BY_ID[heroFor(1)].power],
    heroHps: [START_HP, START_HP],
  }
  let state = createGame(cfg, CARDS_BY_ID)
  const rngs: [number, number] = [seed ^ 0x51, seed ^ 0x8f]
  let guard = 0
  while (state.phase !== 'ended') {
    if (++guard > 6000) return 'draw'
    const actor: PlayerIdx = state.pendingChoice
      ? state.pendingChoice.player
      : state.phase === 'mulligan'
        ? state.players[0].mulliganDone
          ? 1
          : 0
        : state.activePlayer
    const step = aiStep(state, actor, CARDS_BY_ID, rngs[actor], AI_NORMAL)
    rngs[actor] = step.rng
    const r = applyCommand(state, actor, step.cmd, CARDS_BY_ID)
    if (!r.ok) throw new Error(`AI illegal (${r.error})`)
    state = r.state
  }
  return state.winner ?? 'draw'
}

console.log(`sim-hero-mirror: 每个备选主公 ${GAMES} 局镜像(同预组,基准 vs 备选)\n`)
let bad = 0
for (const alt of ALT_HEROES) {
  const base = HEROES.find((h) => h.doctrine === alt.doctrine)!
  const deck = PRECON_DECKS.find((d) => d.heroId === base.id)?.cardIds
  if (!deck) {
    console.log(`  ${alt.name.zh}: 找不到 ${base.name.zh} 的预组,跳过`)
    continue
  }
  let altWins = 0
  let played = 0
  for (let i = 0; i < GAMES; i++) {
    const altSeat = (i & 1) as PlayerIdx // 轮流坐先后手
    const w = play(deck, base.id, alt.id, altSeat, i * 131 + 7)
    if (w === 'draw') continue
    played++
    if (w === altSeat) altWins++
  }
  const rate = played > 0 ? (altWins / played) * 100 : 50
  const ok = rate >= 40 && rate <= 60
  if (!ok) bad++
  console.log(
    `  ${alt.name.zh}(${alt.power.name.zh}) vs 基准 ${base.name.zh}: 备选胜率 ${rate.toFixed(0)}%  ${ok ? '✓' : '⚠ 超出 40–60'}`,
  )
}

console.log('')
if (bad === 0) {
  console.log('✓ 所有备选主公技镜像胜率落在 40–60%')
} else {
  console.log(`⚠ ${bad} 个备选主公技超出 40–60%,需要调整`)
  process.exit(1)
}
