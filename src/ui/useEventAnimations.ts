// 事件驱动的战斗动效队列:把一批 GameEvent 编成时间轴顺序播放,
// AI 整回合的事件读起来是一段有节奏的连招而非同时糊脸。
// - 只产出 transform/opacity 级别的动效状态(具体动画由 CSS 承担)
// - 音效与动效走同一条时间轴
// - 整批播放上限 ~4s,超长自动等比快进
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { GameEvent, GameState } from '../engine/types'
import { CARDS_BY_ID } from '../content/cards'
import { extractFloats, targetFloatKey, type FloatItem } from './components/floats'
import { useLang } from './i18n'
import { playSfx, type SfxName } from './sound'
import { haptic, type HapticKind } from './haptics'

// ---------- 对外状态 ----------

export interface FxMotion {
  id: number
  kind: 'lunge' | 'shake' | 'shakeHard'
  x?: number // 突进位移(px)
  y?: number
  delayMs?: number // 单挑后手的延迟起步
}

export interface FxFlash {
  id: number
  kind: 'hit' | 'clash' // 红光受击 / 金光交锋
}

export interface TokenFx {
  motion?: FxMotion
  flash?: FxFlash
}

export interface GhostFx {
  id: number
  defId: string
  left: number
  top: number
  width: number
  height: number
}

export interface CastFx {
  id: number
  defId: string
  fromEnemy: boolean
}

export interface EventAnimState {
  floats: FloatItem[]
  fx: ReadonlyMap<string, TokenFx>
  ghosts: GhostFx[]
  cast: CastFx | null
  lethalFlash: boolean
  myTurnPulse: boolean
  holdResult: boolean // 致命一击闪光未播完前,压住终局结算面板
}

// ---------- 时间轴条目 ----------

interface MotionPlan {
  key: string
  kind: FxMotion['kind']
  towardKey?: string // 突进方向:执行时按 DOM 实测位置换算
  fallbackY?: number
  delayMs?: number
}

interface Entry {
  t: number
  events: GameEvent[] // 本条目要落地的飘字事件
  motions: MotionPlan[]
  flashes: Array<{ key: string; kind: FxFlash['kind'] }>
  deaths: Array<{ defId: string; rect: DOMRect | null }>
  skipShake?: Set<string> // 正在突进的单位不叠加受击震颤(避免动画中断回弹)
  cast?: { defId: string; fromEnemy: boolean }
  lethal?: boolean
  pulse?: boolean
  release?: boolean // 放行终局结算
  sfx: SfxName[]
}

// 音效 → 触感的映射。只挑几个真正该有手感的时刻,不是每声都震。
const HAPTIC_FOR: Partial<Record<SfxName, HapticKind>> = {
  cardPlay: 'play',
  stratagemCast: 'play',
  attack: 'impact',
  hit: 'impact',
  duel: 'impact',
  lethal: 'lethal',
  victory: 'reward',
}

const LOOSE_DUR = 220 // 松散伤害/治疗条目的节拍
const TOTAL_CAP = 4000 // 整批播放上限(ms)

const EMPTY: EventAnimState = {
  floats: [],
  fx: new Map(),
  ghosts: [],
  cast: null,
  lethalFlash: false,
  myTurnPulse: false,
  holdResult: false,
}

// ---------- 时间轴编排 ----------

function buildTimeline(events: GameEvent[], rects: ReadonlyMap<string, DOMRect>): Entry[] {
  const entries: Entry[] = []
  let t = 0
  let cur: Entry | null = null

  const push = (dur: number, fill?: Partial<Entry>): Entry => {
    const e: Entry = {
      t,
      events: [],
      motions: [],
      flashes: [],
      deaths: [],
      sfx: [],
      ...fill,
    }
    entries.push(e)
    t += dur
    cur = e
    return e
  }

  // 松散事件(法术伤害/治疗等)落进一个新节拍,与前面的动作错开
  const loose = (): Entry => cur ?? push(LOOSE_DUR)

  const addSfxOnce = (e: Entry, name: SfxName) => {
    if (!e.sfx.includes(name)) e.sfx.push(name)
  }

  for (const ev of events) {
    switch (ev.type) {
      case 'TurnStarted': {
        if (ev.player === 0) {
          push(300, { pulse: true, sfx: ['turnStart'] })
        } else {
          push(200)
        }
        cur = null
        break
      }

      case 'CardPlayed': {
        const def = CARDS_BY_ID[ev.defId]
        if (def?.type === 'stratagem' || def?.type === 'equipment') {
          push(520, { cast: { defId: ev.defId, fromEnemy: ev.player === 1 }, sfx: ['stratagemCast'] })
          cur = null // 锦囊/装备的效果飘字落在闪光之后
        } else {
          push(220, { sfx: ['cardPlay'] })
        }
        break
      }

      case 'AttackResolved': {
        const attackerKey = `gen-${ev.attackerIid}`
        const targetKey = targetFloatKey(ev.target)
        push(170, {
          sfx: ['attack'],
          motions: [
            {
              key: attackerKey,
              kind: 'lunge',
              towardKey: targetKey,
              fallbackY: ev.attacker === 0 ? -44 : 44,
            },
          ],
        })
        // 冲撞落点:受击方震颤 + 红光,随后的伤害事件都归到这一拍
        const impact = push(280, { sfx: ['hit'] })
        impact.motions.push({ key: targetKey, kind: 'shake' })
        impact.flashes.push({ key: targetKey, kind: 'hit' })
        impact.flashes.push({ key: attackerKey, kind: 'hit' })
        break
      }

      case 'DuelFought': {
        const chKey = `gen-${ev.challengerIid}`
        const defKey = `gen-${ev.defenderIid}`
        const firstKey = ev.firstStrikeIid === ev.defenderIid ? defKey : chKey
        const secondKey = firstKey === chKey ? defKey : chKey
        // 单挑的伤害事件先于 DuelFought 产生:从当前节拍里挪到交锋落点
        const stolen: GameEvent[] = []
        if (cur) {
          const c = cur as Entry
          c.events = c.events.filter((e) => {
            const mine =
              e.type === 'GeneralDamaged' && (e.iid === ev.challengerIid || e.iid === ev.defenderIid)
            if (mine) stolen.push(e)
            return !mine
          })
        }
        // 第一步:先手突进,后手(若有先手)延迟跟进
        push(340, {
          sfx: ['duel'],
          motions: [
            { key: firstKey, kind: 'lunge', towardKey: secondKey, fallbackY: -40 },
            {
              key: secondKey,
              kind: 'lunge',
              towardKey: firstKey,
              fallbackY: 40,
              delayMs: ev.firstStrikeIid !== undefined ? 150 : 0,
            },
          ],
        })
        // 第二步:金光交锋 + 重震 + 伤害飘字
        const clash = push(340, { sfx: ['attack', 'hit'] })
        clash.events.push(...stolen)
        clash.motions.push({ key: chKey, kind: 'shakeHard' }, { key: defKey, kind: 'shakeHard' })
        clash.flashes.push({ key: chKey, kind: 'clash' }, { key: defKey, kind: 'clash' })
        break
      }

      case 'GeneralDied': {
        push(260, {
          sfx: ['death'],
          deaths: [{ defId: ev.defId, rect: rects.get(`gen-${ev.iid}`) ?? null }],
        })
        cur = null // 亡语效果另起节拍
        break
      }

      case 'HeroDamaged': {
        if (ev.amount > 0) loose().events.push(ev)
        const e = loose()
        e.flashes.push({ key: `hero-${ev.player}`, kind: 'hit' })
        e.motions.push({ key: `hero-${ev.player}`, kind: 'shake' })
        addSfxOnce(e, 'hit')
        if (ev.hpAfter <= 0) {
          // 致命一击:全屏白金闪光,压在终局结算之前
          push(340, { lethal: true, sfx: ['lethal'] })
          cur = null
        }
        break
      }

      case 'GeneralDamaged': {
        const e = loose()
        e.events.push(ev)
        // 攻击结算的节拍里受击方已有震颤;松散伤害(法术/亡语)补上
        if (!e.motions.some((m) => m.key === `gen-${ev.iid}`)) {
          e.motions.push({ key: `gen-${ev.iid}`, kind: 'shake' })
          e.flashes.push({ key: `gen-${ev.iid}`, kind: 'hit' })
        }
        addSfxOnce(e, 'hit')
        break
      }

      case 'GeneralHealed':
      case 'HeroHealed': {
        const e = loose()
        e.events.push(ev)
        addSfxOnce(e, 'heal')
        break
      }

      case 'GeneralBuffed': {
        loose().events.push(ev)
        break
      }

      // ---- 第三卡包 ----
      case 'HeroPowerUsed': {
        // 主公技单独占一拍:它每回合都会响,给它一个稳定的节奏点,
        // 后面的伤害/召唤飘字才不会和「按钮亮起」糊在一起
        push(300, { sfx: ['stratagemCast'] })
        cur = null
        break
      }

      case 'DivineShieldPopped': {
        const e = loose()
        e.events.push(ev)
        e.flashes.push({ key: `gen-${ev.iid}`, kind: 'clash' })
        addSfxOnce(e, 'attack')
        break
      }

      case 'GeneralSilenced': {
        const e = loose()
        e.events.push(ev)
        e.motions.push({ key: `gen-${ev.iid}`, kind: 'shake' })
        addSfxOnce(e, 'death')
        break
      }

      case 'GeneralFrozen': {
        const e = loose()
        e.events.push(ev)
        e.flashes.push({ key: `gen-${ev.iid}`, kind: 'clash' })
        addSfxOnce(e, 'heal')
        break
      }

      case 'ManaGained': {
        loose().events.push(ev)
        break
      }

      case 'GameEnded': {
        push(0, {
          release: true,
          sfx: [ev.winner === 0 ? 'victory' : ev.winner === 1 ? 'defeat' : 'turnStart'],
        })
        cur = null
        break
      }

      default:
        break
    }
  }

  // 超长批次等比快进,总时长压进上限
  if (t > TOTAL_CAP) {
    const k = TOTAL_CAP / t
    for (const e of entries) e.t = Math.round(e.t * k)
  }
  return entries
}

// ---------- Hook 本体 ----------

export function useEventAnimations(
  state: GameState | null,
  lastEvents: GameEvent[],
): EventAnimState {
  const [anim, setAnim] = useState<EventAnimState>(EMPTY)
  const lang = useLang()
  const langRef = useRef(lang)
  langRef.current = lang
  const doneRef = useRef<GameEvent[] | null>(null)
  const idRef = useRef(0)
  const rectsRef = useRef(new Map<string, DOMRect>())
  const seqTimersRef = useRef<number[]>([]) // 时间轴条目:新批次到来即作废
  const gcTimersRef = useRef<number[]>([]) // 清理计时:只在卸载时统一清

  const later = (fn: () => void, ms: number, gc = false) => {
    const id = window.setTimeout(fn, ms)
    ;(gc ? gcTimersRef : seqTimersRef).current.push(id)
    return id
  }

  // 执行时按 DOM 实测位置换算突进向量
  const resolveMotion = (m: MotionPlan): FxMotion => {
    const fx: FxMotion = { id: ++idRef.current, kind: m.kind, delayMs: m.delayMs }
    if (m.kind !== 'lunge') return fx
    const from = getRect(rectsRef.current, m.key)
    const to = m.towardKey ? getRect(rectsRef.current, m.towardKey) : null
    if (from && to) {
      const dx = to.left + to.width / 2 - (from.left + from.width / 2)
      const dy = to.top + to.height / 2 - (from.top + from.height / 2)
      const dist = Math.hypot(dx, dy) || 1
      const k = Math.min(0.45, 96 / dist)
      fx.x = Math.round(dx * k)
      fx.y = Math.round(dy * k)
    } else {
      fx.x = 0
      fx.y = m.fallbackY ?? -40
    }
    return fx
  }

  const execEntry = (e: Entry) => {
    const batchId = ++idRef.current
    const floats = extractFloats(e.events, batchId, langRef.current)
    const motions = e.motions.map((m) => ({ key: m.key, fx: resolveMotion(m) }))
    const flashes = e.flashes.map((f) => ({ key: f.key, fx: { id: ++idRef.current, kind: f.kind } }))
    const ghosts: GhostFx[] = []
    for (const d of e.deaths) {
      if (!d.rect) continue
      ghosts.push({
        id: ++idRef.current,
        defId: d.defId,
        left: d.rect.left,
        top: d.rect.top,
        width: d.rect.width,
        height: d.rect.height,
      })
    }
    const cast: CastFx | null = e.cast ? { id: ++idRef.current, ...e.cast } : null

    setAnim((a) => {
      const fx = new Map(a.fx)
      for (const { key, fx: motion } of motions) fx.set(key, { ...fx.get(key), motion })
      for (const { key, fx: flash } of flashes) fx.set(key, { ...fx.get(key), flash })
      return {
        floats: [...a.floats, ...floats],
        fx,
        ghosts: [...a.ghosts, ...ghosts],
        cast: cast ?? a.cast,
        lethalFlash: e.lethal ? true : a.lethalFlash,
        myTurnPulse: e.pulse ? true : a.myTurnPulse,
        holdResult: e.release ? false : a.holdResult,
      }
    })
    for (const name of e.sfx) playSfx(name)
    // 触感跟着同一条时间轴走 —— 音效响的那一拍才震,不另起节奏
    const first = e.sfx[0]
    const feel = first ? HAPTIC_FOR[first] : undefined
    if (feel) haptic(feel)

    // —— 逐项定时回收(按 id 匹配,绝不误伤后续动效)——
    if (floats.length > 0) {
      later(() => {
        setAnim((a) => ({ ...a, floats: a.floats.filter((f) => !f.id.startsWith(`${batchId}-`)) }))
      }, 1650, true)
    }
    for (const { key, fx: motion } of motions) {
      later(() => {
        setAnim((a) => {
          const t = a.fx.get(key)
          if (t?.motion?.id !== motion.id) return a
          const fx = new Map(a.fx)
          const rest: TokenFx = { ...t, motion: undefined }
          if (rest.flash) fx.set(key, rest)
          else fx.delete(key)
          return { ...a, fx }
        })
      }, (motion.delayMs ?? 0) + 500, true)
    }
    for (const { key, fx: flash } of flashes) {
      later(() => {
        setAnim((a) => {
          const t = a.fx.get(key)
          if (t?.flash?.id !== flash.id) return a
          const fx = new Map(a.fx)
          const rest: TokenFx = { ...t, flash: undefined }
          if (rest.motion) fx.set(key, rest)
          else fx.delete(key)
          return { ...a, fx }
        })
      }, 520, true)
    }
    for (const g of ghosts) {
      later(() => {
        setAnim((a) => ({ ...a, ghosts: a.ghosts.filter((x) => x.id !== g.id) }))
      }, 600, true)
    }
    if (cast) {
      later(() => {
        setAnim((a) => (a.cast?.id === cast.id ? { ...a, cast: null } : a))
      }, 720, true)
    }
    if (e.lethal) later(() => setAnim((a) => ({ ...a, lethalFlash: false })), 420, true)
    if (e.pulse) later(() => setAnim((a) => ({ ...a, myTurnPulse: false })), 1100, true)
  }

  // 新批次到来:useLayoutEffect 在绘制前跑——rectsRef 里还是上一帧的位置,
  // 阵亡单位虽已从 DOM 移除,残影坐标仍可从快照取到。
  useLayoutEffect(() => {
    if (!state || lastEvents === doneRef.current) return
    doneRef.current = lastEvents
    for (const id of seqTimersRef.current) window.clearTimeout(id)
    seqTimersRef.current = []

    const entries = buildTimeline(lastEvents, rectsRef.current)
    const hold = entries.some((e) => e.release)
    setAnim((a) => ({ ...a, cast: null, lethalFlash: false, holdResult: hold }))
    for (const e of entries) {
      if (e.t <= 0) execEntry(e)
      else later(() => execEntry(e), e.t)
    }
  }, [state, lastEvents])

  // 每次渲染后快照所有可动效元素的位置(供残影/突进换算)
  useEffect(() => {
    const m = rectsRef.current
    document.querySelectorAll<HTMLElement>('[data-fxkey]').forEach((el) => {
      const key = el.dataset.fxkey
      if (key) m.set(key, el.getBoundingClientRect())
    })
  })

  // 对局重置:清场
  useEffect(() => {
    if (state) return
    doneRef.current = null
    for (const id of seqTimersRef.current) window.clearTimeout(id)
    for (const id of gcTimersRef.current) window.clearTimeout(id)
    seqTimersRef.current = []
    gcTimersRef.current = []
    rectsRef.current.clear()
    setAnim(EMPTY)
  }, [state])

  // 卸载:清光所有计时器
  useEffect(
    () => () => {
      for (const id of seqTimersRef.current) window.clearTimeout(id)
      for (const id of gcTimersRef.current) window.clearTimeout(id)
    },
    [],
  )

  return anim
}

function getRect(snapshot: ReadonlyMap<string, DOMRect>, key: string): DOMRect | null {
  const el = document.querySelector<HTMLElement>(`[data-fxkey="${key}"]`)
  if (el) return el.getBoundingClientRect()
  return snapshot.get(key) ?? null
}
