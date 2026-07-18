import type { GameEvent, PlayerIdx, TargetRef } from '../../engine/types'
import { KEYWORD_ZH } from '../doctrineColors'

export interface EventTextCtx {
  // iid → 卡名(找不到时给占位)
  name(iid: number): string
  // defId → 卡名
  defName(defId: string): string
  // 玩家 → 主帅名
  heroName(p: PlayerIdx): string
}

const side = (p: PlayerIdx) => (p === 0 ? '我方' : '对方')

function targetName(t: TargetRef, ctx: EventTextCtx): string {
  return t.kind === 'hero' ? `${ctx.heroName(t.player)}(主帅)` : ctx.name(t.iid)
}

const KIND_ZH = { battlecry: '战吼', deathrattle: '亡语', spell: '锦囊' } as const

// 每种 GameEvent 一条中文战报。
export function formatEvent(ev: GameEvent, ctx: EventTextCtx): string {
  switch (ev.type) {
    case 'MulliganDone':
      return `${side(ev.player)}调度完成,换掉 ${ev.replacedCount} 张`
    case 'TurnStarted':
      return `—— 第 ${ev.turn} 回合:${side(ev.player)}回合(法力 ${ev.mana})——`
    case 'TurnEnded':
      return `${side(ev.player)}结束回合`
    case 'CardDrawn':
      return ev.player === 0 ? `我方抽到「${ctx.name(ev.iid)}」` : '对方抽了一张牌'
    case 'CardBurned':
      return `${side(ev.player)}手牌已满,「${ctx.defName(ev.defId)}」被烧毁`
    case 'FatigueDamage':
      return `${side(ev.player)}牌库已空,疲劳 ${ev.amount} 点`
    case 'HeroDamaged':
      return `${ctx.heroName(ev.player)} 受到 ${ev.amount} 伤害(剩 ${ev.hpAfter})`
    case 'HeroHealed':
      return `${ctx.heroName(ev.player)} 恢复 ${ev.amount} 点(至 ${ev.hpAfter})`
    case 'CardPlayed':
      return `${side(ev.player)}打出「${ctx.name(ev.iid)}」(${ev.cost} 费)`
    case 'GeneralSummoned':
      return `「${ctx.name(ev.iid)}」登场(${ev.attack}/${ev.health})`
    case 'EffectTriggered':
      return `「${ctx.name(ev.sourceIid ?? -1)}」${KIND_ZH[ev.kind]}发动`
    case 'GeneralDamaged':
      return `「${ctx.name(ev.iid)}」受到 ${ev.amount} 伤害(剩 ${ev.healthAfter})`
    case 'GeneralHealed':
      return `「${ctx.name(ev.iid)}」恢复 ${ev.amount} 点(至 ${ev.healthAfter})`
    case 'GeneralBuffed':
      return `「${ctx.name(ev.iid)}」获得 +${ev.attack}/+${ev.health}`
    case 'KeywordGranted':
      return `「${ctx.name(ev.iid)}」获得【${KEYWORD_ZH[ev.keyword]}】`
    case 'GeneralDied':
      return `「${ctx.name(ev.iid)}」阵亡`
    case 'AttackResolved': {
      const back = ev.damageToAttacker > 0 ? `,反受 ${ev.damageToAttacker}` : ''
      return `「${ctx.name(ev.attackerIid)}」攻击 ${targetName(ev.target, ctx)},造成 ${ev.damageToTarget} 伤害${back}`
    }
    case 'DuelFought': {
      const a = ctx.name(ev.challengerIid)
      const b = ctx.name(ev.defenderIid)
      let s = `单挑:「${a}」对决「${b}」`
      if (ev.firstStrikeIid !== undefined) s += `,「${ctx.name(ev.firstStrikeIid)}」先手`
      const deaths = [ev.challengerDied ? a : null, ev.defenderDied ? b : null].filter(Boolean)
      if (deaths.length > 0) s += `,「${deaths.join('」「')}」阵亡`
      return s
    }
    case 'GameEnded':
      return ev.winner === 'draw' ? '对局结束:平局' : `对局结束:${side(ev.winner)}胜利`
  }
}
