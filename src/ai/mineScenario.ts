// 把一个真实对局的「回合开始」局面抽成可重建的残局(PuzzleScenario)。
// 斩杀谜题挖矿用:自对弈跑到某玩家回合开始、若此刻存在非平凡 lethal,就把这一帧抽出来当题。
//
// 有些状态重建后语义会漂移,遇到就返回 null(挖矿直接跳过这一帧):
//   - 光环源/光环附魔:重建后 iid 全变,auraFrom 会指向错的单位,得靠 refreshAuras 重导 ——
//     与其小心翼翼不如整帧丢弃(带光环的斩杀本就少)。
//   - 伏兵:对手伏兵在裁剪/重建里语义微妙,且会让"一回合斩杀"多出隐藏变量。
//   - 待决选择(discover 挂起):局面卡在半路,不是干净的回合开始。
//   - 手牌费用被消减过(costDelta≠0):PuzzleSide.hand 只存 defId,重建会丢折扣。
//   - 疲劳已触发:抽牌进疲劳的边角情形,重建难对齐。
// 最终保证不靠这份清单穷举 —— 挖矿脚本会「重建后再解一次」验证,过不了就丢。
import type {
  CardLibrary,
  GameState,
  PlayerIdx,
  PlayerState,
  PuzzleScenario,
  PuzzleSide,
} from '../engine/types'

function sideReconstructable(p: PlayerState, lib: CardLibrary): boolean {
  if (p.secrets.length > 0) return false
  if (p.fatigue > 0) return false
  if (p.board.some((u) => lib[u.defId]?.aura || u.enchants.some((e) => e.auraFrom !== undefined))) {
    return false
  }
  if (p.hand.some((c) => c.costDelta !== 0)) return false
  return true
}

function toSide(p: PlayerState): PuzzleSide {
  return {
    heroHp: p.heroHp,
    heroMaxHp: p.heroMaxHp,
    armor: p.armor,
    mana: p.mana.current,
    board: p.board.map((u) => ({
      defId: u.defId,
      damage: u.damage || undefined,
      enchants: u.enchants.length ? u.enchants.map((e) => ({ ...e })) : undefined,
      exhausted: u.exhausted || undefined,
      attacksUsed: u.attacksUsed || undefined,
      frozen: u.frozen || undefined,
      silenced: u.silenced || undefined,
    })),
    hand: p.hand.map((c) => c.defId),
    // 牌库顺序保留:引擎抽牌走 deck.pop(),数组末尾即牌库顶,顺序一致抽出的牌才一致
    deck: p.deck.map((c) => c.defId),
    heroPowerUsed: p.heroPowerUsed || undefined,
    heroPowerCostDelta: p.heroPowerCostDelta || undefined,
  }
}

export function extractScenario(
  state: GameState,
  active: PlayerIdx,
  lib: CardLibrary,
): PuzzleScenario | null {
  if (state.phase !== 'main') return null
  if (state.pendingChoice) return null
  if (!sideReconstructable(state.players[0], lib)) return null
  if (!sideReconstructable(state.players[1], lib)) return null
  return {
    activePlayer: active,
    rng: state.rng,
    players: [toSide(state.players[0]), toSide(state.players[1])],
  }
}
