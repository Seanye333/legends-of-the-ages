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
  count?: number // 同一拍里被合并的同类数字次数(≥2 时渲染成 ×N 连击标)
  weight?: 2 | 3 // 分量档:大数字用更大的字(见 CSS .w2/.w3)
}

// 数字的分量。震动有 --fx-power 分级,飘字此前没有 ——
// 打 1 点和打 12 点是同一个字号,而字号才是玩家真正读的那个通道。
function weightOf(n: number): 2 | 3 | undefined {
  if (n >= 9) return 3
  if (n >= 5) return 2
  return undefined
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
  // 同一拍里同一目标连挨两刀,原来是横向排开两个数字(-1、-2)——
  // 读的人得自己心算。合并成一个总数 + ×N 连击标:总量才是他要的答案。
  // 只合并**纯数字**的伤害/治疗;「壁碎」「沉默」这类语义字各自独立。
  const merged = new Map<string, { item: FloatItem; total: number }>()
  const pushNum = (targetKey: string, amount: number, kind: 'damage' | 'heal') => {
    const key = `${targetKey}|${kind}`
    const prev = merged.get(key)
    if (prev) {
      prev.total += amount
      prev.item.text = `${kind === 'damage' ? '-' : '+'}${prev.total}`
      prev.item.count = (prev.item.count ?? 1) + 1
      prev.item.weight = weightOf(prev.total)
      return
    }
    push(targetKey, `${kind === 'damage' ? '-' : '+'}${amount}`, kind)
    const item = out[out.length - 1]
    item.weight = weightOf(amount)
    merged.set(key, { item, total: amount })
  }
  for (const ev of events) {
    switch (ev.type) {
      case 'GeneralDamaged':
        pushNum(`gen-${ev.iid}`, ev.amount, 'damage')
        break
      case 'GeneralHealed':
        pushNum(`gen-${ev.iid}`, ev.amount, 'heal')
        break
      case 'HeroDamaged':
        if (ev.amount > 0) pushNum(`hero-${ev.player}`, ev.amount, 'damage')
        break
      case 'HeroHealed':
        pushNum(`hero-${ev.player}`, ev.amount, 'heal')
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
        // 挂在**主帅**上,不能挂 gen-iid:飘字是在事件之后渲染的,
        // 而被放逐的单位那一帧已经从场上(和 DOM 里)消失了 ——
        // 锚一个不存在的元素,字永远不会出现。
        push(`hero-${ev.player}`, pickCompact({ zh: '放逐', en: 'BANISH' }, lang), 'damage')
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
      // 洗入牌库挂在**主帅**上:牌库没有 DOM 锚点,而这件事影响的是整个牌库。
      // 塞给对手的废牌用 damage 色,给自己的用 buff 色 —— 同一个事件两种含义,
      // 颜色是唯一能当场说清「这是好事还是坏事」的通道。
      // ---- 第二十二卡包 ----
      // 装备损毁挂在持有者身上(他还在场,有 DOM 锚点);军令/伏笔挂主帅。
      case 'EquipmentBroken':
        push(`gen-${ev.iid}`, pickCompact({ zh: '兵器断', en: 'BROKE' }, lang), 'damage')
        break
      case 'HandCardGrew':
        push(`hero-${ev.player}`, `+${ev.attack}/+${ev.health}`, 'buff')
        break
      case 'QuestTaken':
        push(`hero-${ev.player}`, pickCompact({ zh: '军令', en: 'QUEST' }, lang), 'buff')
        break
      case 'QuestCompleted':
        push(`hero-${ev.player}`, pickCompact({ zh: '军令达成', en: 'QUEST!' }, lang), 'buff')
        break
      case 'DelaySet':
        push(
          `hero-${ev.player}`,
          pickCompact({ zh: `伏笔 ${ev.turns}`, en: `FUSE ${ev.turns}` }, lang),
          'buff',
        )
        break
      case 'CardShuffledIn':
        push(
          `hero-${ev.player}`,
          pickCompact({ zh: `洗入 ${ev.count}`, en: `SHUFFLED ${ev.count}` }, lang),
          ev.player === 0 ? 'buff' : 'damage',
        )
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
