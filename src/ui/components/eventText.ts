import type { GameEvent, LocalizedText, PlayerIdx, TargetRef } from '../../engine/types'
import { CARDS_BY_ID } from '../../content/cards'
import { HEROES_BY_ID } from '../../content/overrides/heroes'
import { KEYWORD_NAME } from '../doctrineColors'

const UNKNOWN_CARD: LocalizedText = { zh: '一张牌', en: 'a card' }

// 联机时对手抽牌 defId 被裁剪为空 → 占位名
export function cardName(defId: string | undefined): LocalizedText {
  if (!defId) return UNKNOWN_CARD
  return CARDS_BY_ID[defId]?.name ?? { zh: defId, en: defId }
}

export function heroName(heroId: string): LocalizedText {
  return HEROES_BY_ID[heroId]?.name ?? { zh: heroId, en: heroId }
}

export interface EventTextCtx {
  // iid → 卡名(找不到时给占位)
  name(iid: number): LocalizedText
  // defId → 卡名
  defName(defId: string): LocalizedText
  // 玩家 → 主帅名
  heroName(p: PlayerIdx): LocalizedText
}

type Lang = 'zh' | 'en'

const SIDE: Record<Lang, [string, string]> = {
  zh: ['我方', '对方'],
  en: ['You', 'Foe'],
}

// 所属格:「我方的手牌」/「Your hand」
const SIDE_POSS: Record<Lang, [string, string]> = {
  zh: ['我方', '对方'],
  en: ['Your', "Foe's"],
}

const KIND_NAME = {
  battlecry: { zh: '战吼', en: 'Battlecry' },
  deathrattle: { zh: '亡语', en: 'Deathrattle' },
  spell: { zh: '锦囊', en: 'Stratagem' },
  endOfTurn: { zh: '回合结束', en: 'End of Turn' },
  startOfTurn: { zh: '回合开始', en: 'Start of Turn' },
  onDamaged: { zh: '受创', en: 'On Damaged' },
  heroPower: { zh: '主公技', en: 'Hero Power' },
  combo: { zh: '连击', en: 'Combo' },
} as const

// 每种 GameEvent 一条战报,中英各出一份(英文用战报口吻的一般过去时)。
export function formatEvent(ev: GameEvent, ctx: EventTextCtx): LocalizedText {
  return { zh: line(ev, ctx, 'zh'), en: line(ev, ctx, 'en') }
}

function line(ev: GameEvent, ctx: EventTextCtx, l: Lang): string {
  const zh = l === 'zh'
  // 中文用书名号包卡名,英文靠语序即可,加引号反而碍眼
  const q = (s: string) => (zh ? `「${s}」` : s)
  const n = (iid: number) => q(ctx.name(iid)[l])
  const dn = (defId: string) => q(ctx.defName(defId)[l])
  const hero = (p: PlayerIdx) => ctx.heroName(p)[l]
  const side = (p: PlayerIdx) => SIDE[l][p]
  const poss = (p: PlayerIdx) => SIDE_POSS[l][p]
  const target = (t: TargetRef) =>
    t.kind === 'hero'
      ? zh
        ? `${hero(t.player)}(主帅)`
        : `${hero(t.player)} (hero)`
      : n(t.iid)
  const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? '' : 's'}`

  switch (ev.type) {
    case 'MulliganDone':
      if (ev.replacedCount === 0) {
        return zh ? `${side(ev.player)}保留了起手牌` : `${side(ev.player)} kept the opening hand`
      }
      return zh
        ? `${side(ev.player)}调度完成,换掉 ${ev.replacedCount} 张`
        : `${side(ev.player)} mulliganed ${plural(ev.replacedCount, 'card')}`
    case 'TurnStarted':
      return zh
        ? `—— 第 ${ev.turn} 回合:${side(ev.player)}回合(法力 ${ev.mana})——`
        : `—— Turn ${ev.turn}: ${ev.player === 0 ? 'your' : 'enemy'} turn (${ev.mana} mana) ——`
    case 'TurnEnded':
      return zh ? `${side(ev.player)}结束回合` : `${side(ev.player)} ended the turn`
    case 'CardDrawn':
      if (ev.player === 0) {
        return zh ? `我方抽到${n(ev.iid)}` : `You drew ${n(ev.iid)}`
      }
      return zh ? '对方抽了一张牌' : 'Foe drew a card'
    case 'CardBurned':
      return zh
        ? `${side(ev.player)}手牌已满,${dn(ev.defId)}被烧毁`
        : `${poss(ev.player)} hand was full — ${dn(ev.defId)} burned away`
    case 'FatigueDamage':
      return zh
        ? `${side(ev.player)}牌库已空,疲劳 ${ev.amount} 点`
        : `${poss(ev.player)} deck ran dry — ${ev.amount} fatigue damage`
    case 'HeroDamaged':
      return zh
        ? `${hero(ev.player)} 受到 ${ev.amount} 伤害(剩 ${ev.hpAfter})`
        : `${hero(ev.player)} took ${ev.amount} damage (${ev.hpAfter} HP left)`
    case 'HeroHealed':
      return zh
        ? `${hero(ev.player)} 恢复 ${ev.amount} 点(至 ${ev.hpAfter})`
        : `${hero(ev.player)} recovered ${ev.amount} (up to ${ev.hpAfter} HP)`
    case 'CardPlayed':
      return zh
        ? `${side(ev.player)}打出${n(ev.iid)}(${ev.cost} 费)`
        : `${side(ev.player)} played ${n(ev.iid)} (${ev.cost} mana)`
    case 'GeneralSummoned':
      return zh
        ? `${n(ev.iid)}登场(${ev.attack}/${ev.health})`
        : `${n(ev.iid)} took the field (${ev.attack}/${ev.health})`
    case 'EffectTriggered': {
      const kind = KIND_NAME[ev.kind][l]
      const src = ev.sourceIid !== undefined ? n(ev.sourceIid) : dn(ev.sourceDefId)
      return zh ? `${src}${kind}发动` : `${src} — ${kind} triggered`
    }
    case 'GeneralDamaged':
      return zh
        ? `${n(ev.iid)}受到 ${ev.amount} 伤害(剩 ${ev.healthAfter})`
        : `${n(ev.iid)} took ${ev.amount} damage (${ev.healthAfter} left)`
    case 'GeneralHealed':
      return zh
        ? `${n(ev.iid)}恢复 ${ev.amount} 点(至 ${ev.healthAfter})`
        : `${n(ev.iid)} recovered ${ev.amount} (up to ${ev.healthAfter})`
    case 'GeneralBuffed': {
      // 临时增益到期与光环撤销走同一个事件,数值为负 —— 文案要跟着换措辞
      const fading = ev.attack < 0 || ev.health < 0
      const fmt = (v: number) => (v >= 0 ? `+${v}` : `${v}`)
      if (fading) {
        return zh
          ? `${n(ev.iid)}的增益消退(${fmt(ev.attack)}/${fmt(ev.health)})`
          : `${n(ev.iid)} lost a buff (${fmt(ev.attack)}/${fmt(ev.health)})`
      }
      return zh
        ? `${n(ev.iid)}获得 +${ev.attack}/+${ev.health}`
        : `${n(ev.iid)} gained +${ev.attack}/+${ev.health}`
    }
    case 'KeywordGranted':
      return zh
        ? `${n(ev.iid)}获得【${KEYWORD_NAME[ev.keyword].zh}】`
        : `${n(ev.iid)} gained [${KEYWORD_NAME[ev.keyword].en}]`
    case 'GeneralDied':
      return zh ? `${n(ev.iid)}阵亡` : `${n(ev.iid)} fell in battle`
    case 'AttackResolved': {
      if (zh) {
        const back = ev.damageToAttacker > 0 ? `,反受 ${ev.damageToAttacker}` : ''
        return `${n(ev.attackerIid)}攻击 ${target(ev.target)},造成 ${ev.damageToTarget} 伤害${back}`
      }
      const back = ev.damageToAttacker > 0 ? `, taking ${ev.damageToAttacker} back` : ''
      return `${n(ev.attackerIid)} struck ${target(ev.target)} for ${ev.damageToTarget}${back}`
    }
    case 'DuelFought': {
      const a = n(ev.challengerIid)
      const b = n(ev.defenderIid)
      const deaths = [ev.challengerDied ? a : null, ev.defenderDied ? b : null].filter(
        (x): x is string => x !== null,
      )
      if (zh) {
        let s = `单挑:${a}对决${b}`
        if (ev.firstStrikeIid !== undefined) s += `,${n(ev.firstStrikeIid)}先手`
        if (deaths.length > 0) s += `,${deaths.join('')}阵亡`
        return s
      }
      let s = `Duel — ${a} challenged ${b}`
      if (ev.firstStrikeIid !== undefined) s += `; ${n(ev.firstStrikeIid)} struck first`
      if (deaths.length > 0) s += `; ${deaths.join(' and ')} fell`
      return s
    }
    case 'EquipmentAttached':
      return zh
        ? `${n(ev.targetIid)}装备${dn(ev.defId)}`
        : `${n(ev.targetIid)} equipped ${dn(ev.defId)}`
    case 'ArmorGained':
      return zh
        ? `${hero(ev.player)} 获得 ${ev.amount} 点护甲(共 ${ev.armorAfter})`
        : `${hero(ev.player)} gained ${ev.amount} armor (${ev.armorAfter} total)`
    case 'GeneralReturned':
      return zh ? `${n(ev.iid)}被弹回手牌` : `${n(ev.iid)} was sent back to hand`
    case 'CardDiscarded':
      return zh
        ? `${side(ev.player)}弃掉${dn(ev.defId)}`
        : `${side(ev.player)} discarded ${dn(ev.defId)}`
    case 'DivineShieldPopped':
      return zh ? `${n(ev.iid)}的铁壁被击碎` : `${n(ev.iid)}'s Divine Shield shattered`
    case 'GeneralSilenced':
      return zh ? `${n(ev.iid)}被沉默` : `${n(ev.iid)} was silenced`
    case 'GeneralFrozen':
      return zh ? `${n(ev.iid)}被冻结` : `${n(ev.iid)} was frozen`
    case 'GeneralUnfrozen':
      return zh ? `${n(ev.iid)}解除冻结` : `${n(ev.iid)} thawed`
    case 'StealthBroken':
      return zh ? `${n(ev.iid)}暴露行踪` : `${n(ev.iid)} broke Stealth`
    case 'ManaGained':
      return zh
        ? ev.temporary
          ? `${side(ev.player)}本回合获得 ${ev.amount} 点法力`
          : `${side(ev.player)}法力上限 +${ev.amount}`
        : ev.temporary
          ? `${side(ev.player)} gained ${ev.amount} mana this turn`
          : `${side(ev.player)} gained ${ev.amount} Mana Crystal`
    case 'HeroPowerUsed':
      return zh
        ? `${hero(ev.player)} 发动主公技(${ev.cost} 费)`
        : `${hero(ev.player)} used their Hero Power (${ev.cost} mana)`
    // ---- 第四卡包 ----
    // 埋伏兵时对手拿到的 defId 是空串(见 redactEvent),dn('') 会退化成「未知」,
    // 战报里读起来就是「敌方埋下一处伏兵」—— 正是想要的效果。
    case 'SecretPlayed':
      return zh ? `${side(ev.player)}埋下一处伏兵` : `${side(ev.player)} set a Secret`
    case 'SecretRevealed':
      return zh
        ? `伏兵发动:${dn(ev.defId)}!`
        : `Secret revealed — ${dn(ev.defId)}!`
    case 'ComboTriggered':
      return zh ? `${dn(ev.defId)}连击生效` : `${dn(ev.defId)} — Combo!`
    case 'ManaOverloaded':
      return zh
        ? `${side(ev.player)}过载 ${ev.amount} 点(下回合水晶被锁)`
        : `${side(ev.player)} overloaded ${ev.amount} (locked next turn)`
    case 'ManaLocked':
      return zh
        ? `${side(ev.player)}本回合被锁 ${ev.amount} 点水晶`
        : `${side(ev.player)} has ${ev.amount} crystals locked this turn`
    case 'GameEnded':
      if (ev.winner === 'draw') return zh ? '对局结束:平局' : 'Battle over — a draw'
      return zh
        ? `对局结束:${side(ev.winner)}胜利`
        : `Battle over — ${ev.winner === 0 ? 'you win' : 'the foe wins'}`
  }
}
