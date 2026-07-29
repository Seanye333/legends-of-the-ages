import type { GameEvent } from '../../engine/types'
import type { Language } from '../i18n'
import { pickCompact } from '../i18n'

// 飘字:伤害/治疗/增益数字,叠在受影响单位上方。
export interface FloatItem {
  id: string
  targetKey: string // 'gen-<iid>' | 'hero-0' | 'hero-1'
  text: string
  kind: 'damage' | 'heal' | 'buff'
  offset: number // 同一目标的第几个飘字,用于错位
}

export function targetFloatKey(t: { kind: 'hero'; player: 0 | 1 } | { kind: 'general'; iid: number }): string {
  return t.kind === 'hero' ? `hero-${t.player}` : `gen-${t.iid}`
}

export function extractFloats(events: GameEvent[], batch: number, lang: Language = 'zh'): FloatItem[] {
  const out: FloatItem[] = []
  const perTarget = new Map<string, number>()
  const push = (targetKey: string, text: string, kind: FloatItem['kind']) => {
    const offset = perTarget.get(targetKey) ?? 0
    perTarget.set(targetKey, offset + 1)
    out.push({ id: `${batch}-${out.length}`, targetKey, text, kind, offset })
  }
  for (const ev of events) {
    switch (ev.type) {
      case 'GeneralDamaged':
        push(`gen-${ev.iid}`, `-${ev.amount}`, 'damage')
        break
      case 'GeneralHealed':
        push(`gen-${ev.iid}`, `+${ev.amount}`, 'heal')
        break
      case 'HeroDamaged':
        if (ev.amount > 0) push(`hero-${ev.player}`, `-${ev.amount}`, 'damage')
        break
      case 'HeroHealed':
        push(`hero-${ev.player}`, `+${ev.amount}`, 'heal')
        break
      case 'GeneralBuffed': {
        // 临时增益到期/光环撤销走同一事件,数值为负 —— 别再硬加 '+' 号
        const fmt = (v: number) => (v >= 0 ? `+${v}` : `${v}`)
        const fading = ev.attack < 0 || ev.health < 0
        push(`gen-${ev.iid}`, `${fmt(ev.attack)}/${fmt(ev.health)}`, fading ? 'damage' : 'buff')
        break
      }
      case 'ArmorGained':
        push(`hero-${ev.player}`, `+${ev.amount}${pickCompact({ zh: '甲', en: ' ARM' }, lang)}`, 'buff')
        break
      case 'DivineShieldPopped':
        push(`gen-${ev.iid}`, pickCompact({ zh: '壁碎', en: 'SHIELD' }, lang), 'damage')
        break
      case 'GeneralSilenced':
        push(`gen-${ev.iid}`, pickCompact({ zh: '沉默', en: 'SILENCED' }, lang), 'damage')
        break
      case 'GeneralFrozen':
        push(`gen-${ev.iid}`, pickCompact({ zh: '冰封', en: 'FROZEN' }, lang), 'buff')
        break
      // ---- 第四卡包 ----
      case 'SecretPlayed':
        push(`hero-${ev.player}`, pickCompact({ zh: '伏兵', en: 'SECRET' }, lang), 'buff')
        break
      case 'ComboTriggered':
        push(`hero-${ev.player}`, pickCompact({ zh: '连击', en: 'COMBO' }, lang), 'buff')
        break
      case 'ManaOverloaded':
        push(
          `hero-${ev.player}`,
          pickCompact({ zh: `过载 ${ev.amount}`, en: `OVERLOAD ${ev.amount}` }, lang),
          'damage',
        )
        break
      case 'ManaLocked':
        // 用 damage 色:被锁水晶对玩家就是一次损失,视觉上不该和增益同色
        push(
          `hero-${ev.player}`,
          pickCompact({ zh: `-${ev.amount} 水晶`, en: `-${ev.amount} MANA` }, lang),
          'damage',
        )
        break
      case 'GeneralBanished':
        push(`gen-${ev.iid}`, pickCompact({ zh: '放逐', en: 'BANISH' }, lang), 'damage')
        break
      case 'GeneralSeized':
        push(`gen-${ev.iid}`, pickCompact({ zh: '策反', en: 'DEFECT' }, lang), 'buff')
        break
      case 'GeneralTransformed':
        push(`gen-${ev.intoIid}`, pickCompact({ zh: '变形', en: 'MORPH' }, lang), 'buff')
        break
      case 'CardGenerated':
        push(`hero-${ev.player}`, pickCompact({ zh: '生成', en: 'CREATED' }, lang), 'buff')
        break
      case 'ManaGained':
        push(
          `hero-${ev.player}`,
          `+${ev.amount}${pickCompact({ zh: '费', en: ' MANA' }, lang)}`,
          'buff',
        )
        break
      // ---- 第二十一卡包 ----
      // 士气/粮道/连环都挂在主帅上:它们是**整支队伍**的状态,不属于某一个单位。
      case 'MoraleChanged':
        push(
          `hero-${ev.player}`,
          pickCompact(
            ev.delta > 0 ? { zh: '士气↑', en: 'MORALE↑' } : { zh: '士气↓', en: 'MORALE↓' },
            lang,
          ),
          ev.delta > 0 ? 'buff' : 'damage',
        )
        break
      case 'SupplyChanged':
        // 每回合末那一格 +1 是常态,不值得飘 —— 只在牌真的动了粮时才说话,
        // 否则每个回合都会在主帅头上弹一次「粮道 +1」,纯噪音。
        if (Math.abs(ev.delta) > 1 || ev.delta < 0) {
          push(
            `hero-${ev.player}`,
            `${ev.delta > 0 ? '+' : ''}${ev.delta}${pickCompact({ zh: '粮', en: ' SUP' }, lang)}`,
            ev.delta > 0 ? 'buff' : 'damage',
          )
        }
        break
      case 'ChainTriggered':
        push(`hero-${ev.player}`, pickCompact({ zh: '连环计', en: 'CHAIN' }, lang), 'buff')
        break
      default:
        break
    }
  }
  return out
}
