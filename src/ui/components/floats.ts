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
      case 'ManaGained':
        push(
          `hero-${ev.player}`,
          `+${ev.amount}${pickCompact({ zh: '费', en: ' MANA' }, lang)}`,
          'buff',
        )
        break
      default:
        break
    }
  }
  return out
}
