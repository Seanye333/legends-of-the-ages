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
  // 力度(0.6 ~ 1.8)。**打 1 点和打 12 点此前是同一个抖动** ——
  // 牌桌上最该被感觉到的差别(这一下疼不疼)在画面上完全不存在。
  // 由伤害值折算,喂给 CSS 的 --fx-power,只乘在位移与形变上。
  power?: number
}

// 伤害 → 力度。4 点是基准(一次普通交换),往下不低于 0.6(再小就看不见了),
// 往上封在 1.8(再大整个令牌会飞出格子,而且高伤害本来就不需要靠幅度强调,
// 它自带一个巨大的飘字)。
export function powerOf(damage: number): number {
  return Math.max(0.6, Math.min(1.8, 0.6 + damage / 5))
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
  guard?: boolean // 生前是守护:残影要带着那堵墙一起塌
  banish?: boolean // 放逐不是阵亡:向上散,不往下倒
}

export interface CastFx {
  id: number
  defId: string
  fromEnemy: boolean
}

// 墨珠:法术/装备/主公技从施法处飞向落点的那一道。
// 此前锦囊只有全屏居中的展牌,和目标之间**没有任何一根线** ——
// 群体法术打完,玩家靠飘字倒推刚才发生了什么。
export interface BoltFx {
  id: number
  x: number
  y: number
  dx: number
  dy: number
  delayMs: number
}

// 爆发环:主公技的鎏金涟漪 / 单挑交锋点的火花。定位取自实测 rect。
export interface BurstFx {
  id: number
  x: number
  y: number
  kind: 'power' | 'clash'
}

export interface EventAnimState {
  floats: FloatItem[]
  fx: ReadonlyMap<string, TokenFx>
  ghosts: GhostFx[]
  cast: CastFx | null
  bolts: BoltFx[]
  bursts: BurstFx[]
  // 桌震:只给最重的那几下(单击 ≥8、主帅挨 ≥6、致命一击)。
  // power 进 CSS 的 --quake-power;挂在 .top/.battlefield/.bottom 上,
  // **绝不能挂 .screen**(transform 会重锚 fixed 后代 —— 认输按钮事件的教训)。
  quake: { id: number; power: number } | null
  turnEbb: number // 回合收束的烛暗一拍(id,0 = 无)
  lethalFlash: boolean
  myTurnPulse: boolean
  holdResult: boolean // 致命一击闪光未播完前,压住终局结算面板
}

// ---------- 时间轴条目 ----------

interface MotionPlan {
  key: string
  kind: FxMotion['kind']
  power?: number
  towardKey?: string // 突进方向:执行时按 DOM 实测位置换算
  fallbackY?: number
  delayMs?: number
}

interface Entry {
  t: number
  events: GameEvent[] // 本条目要落地的飘字事件
  motions: MotionPlan[]
  flashes: Array<{ key: string; kind: FxFlash['kind'] }>
  deaths: Array<{ defId: string; rect: DOMRect | null; guard?: boolean; banish?: boolean }>
  skipShake?: Set<string> // 正在突进的单位不叠加受击震颤(避免动画中断回弹)
  cast?: { defId: string; fromEnemy: boolean }
  // 墨珠的出发点:'cast'(展牌位置)或某个 fxkey(主公技从帅案出发)。
  // 落点不在这里 —— 由这一拍 events 里的受影响目标在执行时实测推出。
  boltFrom?: string
  bursts?: Array<{ key: string; key2?: string; kind: BurstFx['kind'] }>
  quake?: number
  ebb?: boolean
  lethal?: boolean
  pulse?: boolean
  release?: boolean // 放行终局结算
  sfx: SfxName[]
}

// 这一拍里哪些目标该收到一颗墨珠(法术/装备/主公技的落点)。
// 从事件反推而不是让每个 case 自己填:落点的真相本来就在事件里。
function boltTargets(events: GameEvent[]): string[] {
  const seen = new Set<string>()
  for (const ev of events) {
    switch (ev.type) {
      case 'GeneralDamaged':
      case 'GeneralHealed':
      case 'GeneralFrozen':
      case 'GeneralSilenced':
      case 'GeneralBuffed':
      case 'DivineShieldPopped':
        seen.add(`gen-${ev.iid}`)
        break
      case 'EquipmentAttached':
        seen.add(`gen-${ev.targetIid}`)
        break
      case 'HeroDamaged':
      case 'HeroHealed':
        seen.add(`hero-${ev.player}`)
        break
      default:
        break
    }
  }
  return [...seen]
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
  bolts: [],
  bursts: [],
  quake: null,
  turnEbb: 0,
  lethalFlash: false,
  myTurnPulse: false,
  holdResult: false,
}

// ---------- 时间轴编排 ----------

function buildTimeline(
  events: GameEvent[],
  rects: ReadonlyMap<string, DOMRect>,
  guards: ReadonlySet<string>,
): Entry[] {
  const entries: Entry[] = []
  let t = 0
  let cur: Entry | null = null
  // 刚有一次施法(锦囊/装备/主公技),效果落点的那一拍要放墨珠。
  // 只给紧随其后的第一个松散节拍 —— 再往后的事件已经是连锁反应了。
  let castPending: string | null = null

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
  const loose = (): Entry => {
    if (cur) return cur
    const e = push(LOOSE_DUR)
    if (castPending) {
      e.boltFrom = castPending
      castPending = null
    }
    return e
  }

  const addSfxOnce = (e: Entry, name: SfxName) => {
    if (!e.sfx.includes(name)) e.sfx.push(name)
  }

  for (const ev of events) {
    switch (ev.type) {
      case 'TurnStarted': {
        castPending = null
        if (ev.player === 0) {
          // 轻锣之后跟一记玉磬:水晶是逐颗点亮的(HeroPlate 里第 i 颗晚 45ms),
          // 声音跟着一起到,那一下「资源到账」才成立。
          push(300, { pulse: true, sfx: ['turnStart', 'mana'] })
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
          castPending = 'cast' // 效果落点那一拍:从展牌位置放墨珠
        } else {
          push(220, { sfx: ['cardPlay'] })
          castPending = null
        }
        break
      }

      case 'TurnEnded': {
        // 回合的收束此前**没有任何表现** —— 开始有横扫有横幅,结束是凭空静止。
        // 一拍极短的烛暗(全屏压深 → 回来)把接缝标出来,不打断任何东西。
        push(160, { ebb: true })
        cur = null
        break
      }

      case 'AttackResolved': {
        castPending = null
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
        impact.motions.push({ key: targetKey, kind: 'shake', power: powerOf(ev.damageToTarget) })
        impact.flashes.push({ key: targetKey, kind: 'hit' })
        impact.flashes.push({ key: attackerKey, kind: 'hit' })
        // 桌震只留给最重的那几下 —— 每刀都震等于没有震
        if (ev.damageToTarget >= 8) impact.quake = powerOf(ev.damageToTarget)
        break
      }

      case 'DuelFought': {
        castPending = null
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
        // 第二步:金光交锋 + 重震 + 伤害飘字 + 交锋点一簇金铁火星
        const clash = push(340, { sfx: ['attack', 'hit'] })
        clash.events.push(...stolen)
        clash.motions.push({ key: chKey, kind: 'shakeHard' }, { key: defKey, kind: 'shakeHard' })
        clash.flashes.push({ key: chKey, kind: 'clash' }, { key: defKey, kind: 'clash' })
        clash.bursts = [{ key: chKey, key2: defKey, kind: 'clash' }]
        break
      }

      case 'GeneralDied': {
        push(260, {
          sfx: ['death'],
          // guard 从上一帧的 DOM 快照读:事件里没有关键词,而此刻单位已经不在场上
          deaths: [
            { defId: ev.defId, rect: rects.get(`gen-${ev.iid}`) ?? null, guard: guards.has(`gen-${ev.iid}`) },
          ],
        })
        cur = null // 亡语效果另起节拍
        break
      }

      case 'HeroDamaged': {
        if (ev.amount > 0) loose().events.push(ev)
        const e = loose()
        e.flashes.push({ key: `hero-${ev.player}`, kind: 'hit' })
        e.motions.push({ key: `hero-${ev.player}`, kind: 'shake', power: powerOf(ev.amount) })
        addSfxOnce(e, 'hit')
        if (ev.amount >= 6) e.quake = powerOf(ev.amount)
        if (ev.hpAfter <= 0) {
          // 致命一击:全屏白金闪光 + 慢镜,压在终局结算之前。
          //
          // 从 340ms 拉到 760ms 是为了让慢镜真的存在:这一拍原本一闪而过,
          // 玩家还没看清是哪一击结束的战斗,结算面板就盖上来了。
          // **一局四十分钟只有这一下**,值得给它一秒钟。
          // 时长同时决定了 .slowmo 的作用窗口(MatchScreen 按 lethalFlash 挂类)。
          push(760, { lethal: true, sfx: ['lethal'], quake: 1.8 })
          cur = null
        }
        break
      }

      case 'GeneralDamaged': {
        const e = loose()
        e.events.push(ev)
        // 攻击结算的节拍里受击方已有震颤;松散伤害(法术/亡语)补上
        if (!e.motions.some((m) => m.key === `gen-${ev.iid}`)) {
          e.motions.push({ key: `gen-${ev.iid}`, kind: 'shake', power: powerOf(ev.amount) })
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
        // 后面的伤害/召唤飘字才不会和「按钮亮起」糊在一起。
        // 此前它的全部表现是一声借来的锦囊音、零视觉 ——
        // 现在帅案起一圈鎏金涟漪,效果落点那一拍再从帅案放墨珠。
        push(300, {
          sfx: ['stratagemCast'],
          bursts: [{ key: `hero-${ev.player}`, kind: 'power' }],
        })
        cur = null
        castPending = `hero-${ev.player}`
        break
      }

      // ---- 第四卡包 ----

      case 'SecretRevealed': {
        // 伏兵翻开必须**看得见是哪一张**。只发一行战报是不够的:
        // 玩家刚点了攻击,场面突然变了,他需要知道原因。
        // 复用锦囊的展示大卡动画 —— 语义上这就是「对手甩出一张牌」。
        // 给的时间比锦囊长(680 vs 520):这张牌是意料之外的,要留出读的时间。
        push(680, { cast: { defId: ev.defId, fromEnemy: ev.player === 1 }, sfx: ['stratagemCast'] })
        cur = null // 伏兵的效果飘字落在展示之后
        castPending = 'cast'
        break
      }

      case 'SecretPlayed': {
        // 埋下:不展示牌面(对手拿到的 defId 本来就是空的),音效 + 主帅上的「伏兵」飘字。
        // 飘字在 floats.ts 里早就定义了,但这里从没把事件塞进 events —— 死代码复活。
        const e = push(200, { sfx: ['cardPlay'] })
        e.events.push(ev)
        break
      }

      case 'ComboTriggered':
      case 'ManaOverloaded':
      case 'ManaLocked': {
        // 这三条只出飘字,不单独占节拍 —— 它们伴随出牌/回合开始发生,
        // 单独给一拍会把出牌的节奏拖散
        loose().events.push(ev)
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

      // ---- 声音补齐:这四类事件此前完全是静音的 ----
      // 它们都**不占独立节拍**(`loose()` 挂在当前这一拍上)——
      // 抽牌一回合能响四五次,给每次都排一拍会把回合开始拖成慢动作。
      // `addSfxOnce` 保证同一拍里重复的同类事件只发一次声。

      case 'CardDrawn': {
        // 只响自己的抽牌。对手抽牌照样有战报行,但不该发声 ——
        // 一局里对手抽的牌和自己一样多,全响等于把这个音效的信息量摊薄成噪音。
        if (ev.player === 0) addSfxOnce(loose(), 'draw')
        break
      }

      case 'ArmorGained': {
        // 得甲用「甲片」音色的那一记,和受击(闷响)听感上分得开。
        // 「+N 甲」的飘字此前不可达:音效塞了,事件本身没进 events。
        const e = loose()
        e.events.push(ev)
        addSfxOnce(e, 'armorBreak')
        break
      }

      // ---- 复活的死代码飘字:floats.ts 里定义齐全,但 buildTimeline 从不喂 ----

      case 'EquipmentAttached': {
        // 装备此前的全部视觉是令牌角上的静态 ⚔:锦囊展牌之后,
        // 墨珠飞到佩戴者身上 + 一记金闪 + 角标自己的入场动画(CSS)。
        const e = loose()
        e.events.push(ev) // 不出飘字(floats 无此 case),但 boltTargets 靠它找落点
        e.flashes.push({ key: `gen-${ev.targetIid}`, kind: 'clash' })
        addSfxOnce(e, 'bond')
        break
      }

      case 'GeneralBanished': {
        // 放逐不是阵亡:残影向上散(ghostBanish),飘字挂主帅(单位元素已不在)
        const e = loose()
        e.events.push(ev)
        e.deaths.push({
          defId: ev.defId,
          rect: rects.get(`gen-${ev.iid}`) ?? null,
          banish: true,
        })
        addSfxOnce(e, 'death')
        break
      }

      case 'GeneralSeized': {
        const e = loose()
        e.events.push(ev)
        e.flashes.push({ key: `gen-${ev.iid}`, kind: 'clash' })
        addSfxOnce(e, 'bond')
        break
      }

      case 'GeneralTransformed': {
        const e = loose()
        e.events.push(ev)
        e.flashes.push({ key: `gen-${ev.intoIid}`, kind: 'clash' })
        addSfxOnce(e, 'discover')
        break
      }

      case 'CardGenerated': {
        const e = loose()
        e.events.push(ev)
        if (ev.player === 0) addSfxOnce(e, 'draw')
        break
      }

      case 'MoraleChanged':
      case 'SupplyChanged': {
        // 飘字层自己会过滤噪音(粮道每回合 +1 不飘)
        loose().events.push(ev)
        break
      }

      case 'ChainTriggered': {
        const e = loose()
        e.events.push(ev)
        addSfxOnce(e, 'bond')
        break
      }

      case 'GeneralSummoned': {
        // 入场此前完全游离在时间轴外(动画靠 React 挂载即播,声音没有)。
        // 衍生物/亡语召唤落在当前节拍并补一声落子;从手牌打出时
        // CardPlayed 那一拍已经有同名音效,addSfxOnce 会去重。
        addSfxOnce(loose(), 'cardPlay')
        break
      }

      case 'DiscoverStarted': {
        // 发现三选一:覆盖层弹出前的那一下气声,给玩家「要做选择了」的预告
        addSfxOnce(loose(), 'discover')
        break
      }

      case 'KeywordGranted': {
        // 羁绊与宿敌都走「授予关键词」这条路(光环 → 附魔 → 关键词),
        // 于是这一声也就顺带覆盖了羁绊成立的那一刻。
        addSfxOnce(loose(), 'bond')
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
  const guardsRef = useRef(new Set<string>())
  const seqTimersRef = useRef<number[]>([]) // 时间轴条目:新批次到来即作废
  const gcTimersRef = useRef<number[]>([]) // 清理计时:只在卸载时统一清

  const later = (fn: () => void, ms: number, gc = false) => {
    const id = window.setTimeout(fn, ms)
    ;(gc ? gcTimersRef : seqTimersRef).current.push(id)
    return id
  }

  // 执行时按 DOM 实测位置换算突进向量
  const resolveMotion = (m: MotionPlan): FxMotion => {
    const fx: FxMotion = { id: ++idRef.current, kind: m.kind, delayMs: m.delayMs, power: m.power }
    if (m.kind !== 'lunge') return fx
    const from = getRect(rectsRef.current, m.key)
    const to = m.towardKey ? getRect(rectsRef.current, m.towardKey) : null
    if (from && to) {
      const dx = to.left + to.width / 2 - (from.left + from.width / 2)
      const dy = to.top + to.height / 2 - (from.top + from.height / 2)
      const dist = Math.hypot(dx, dy) || 1
      // 冲**到目标身上**,不是冲到半路折返。原来 min(0.45, 96/dist) 把突进
      // 硬压在半程以内 —— 大部分攻击读起来像「朝那个方向比划了一下」。
      // 现在走到距目标中心约 46px(正好贴上对方边缘)再由顿帧接住;
      // 近身对撞至少走 1/4,免得贴脸攻击完全看不见位移。
      const k = Math.max(0.25, Math.min(0.86, (dist - 46) / dist))
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
        guard: d.guard,
        banish: d.banish,
      })
    }
    const cast: CastFx | null = e.cast ? { id: ++idRef.current, ...e.cast } : null

    // 墨珠:出发点(展牌中心或帅案)→ 这一拍每个受影响目标,依次错开 70ms
    const bolts: BoltFx[] = []
    if (e.boltFrom) {
      const origin =
        e.boltFrom === 'cast'
          ? { x: window.innerWidth / 2, y: window.innerHeight * 0.46 }
          : (() => {
              const r = getRect(rectsRef.current, e.boltFrom!)
              return r ? { x: r.left + r.width / 2, y: r.top + r.height / 2 } : null
            })()
      if (origin) {
        let i = 0
        for (const key of boltTargets(e.events)) {
          const r = getRect(rectsRef.current, key)
          if (!r) continue
          bolts.push({
            id: ++idRef.current,
            x: origin.x,
            y: origin.y,
            dx: r.left + r.width / 2 - origin.x,
            dy: r.top + r.height / 2 - origin.y,
            delayMs: i * 70,
          })
          if (++i >= 5) break // 超大群体法术:五颗以后视觉已饱和
        }
      }
    }

    // 爆发环:单点取该元素中心,双点(单挑)取两者的交锋中点
    const bursts: BurstFx[] = []
    for (const b of e.bursts ?? []) {
      const r1 = getRect(rectsRef.current, b.key)
      if (!r1) continue
      let x = r1.left + r1.width / 2
      let y = r1.top + r1.height / 2
      if (b.key2) {
        const r2 = getRect(rectsRef.current, b.key2)
        if (r2) {
          x = (x + r2.left + r2.width / 2) / 2
          y = (y + r2.top + r2.height / 2) / 2
        }
      }
      bursts.push({ id: ++idRef.current, x, y, kind: b.kind })
    }

    const quake = e.quake ? { id: ++idRef.current, power: e.quake } : null
    const ebbId = e.ebb ? ++idRef.current : 0

    setAnim((a) => {
      const fx = new Map(a.fx)
      for (const { key, fx: motion } of motions) fx.set(key, { ...fx.get(key), motion })
      for (const { key, fx: flash } of flashes) fx.set(key, { ...fx.get(key), flash })
      return {
        floats: [...a.floats, ...floats],
        fx,
        ghosts: [...a.ghosts, ...ghosts],
        cast: cast ?? a.cast,
        bolts: [...a.bolts, ...bolts],
        bursts: [...a.bursts, ...bursts],
        quake: quake ?? a.quake,
        turnEbb: ebbId || a.turnEbb,
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
      }, 950, true) // 残影 0.6s + 魂魄/墙塌的余韵
    }
    if (bolts.length > 0) {
      const ids = new Set(bolts.map((b) => b.id))
      later(() => {
        setAnim((a) => ({ ...a, bolts: a.bolts.filter((b) => !ids.has(b.id)) }))
      }, 700, true)
    }
    if (bursts.length > 0) {
      const ids = new Set(bursts.map((b) => b.id))
      later(() => {
        setAnim((a) => ({ ...a, bursts: a.bursts.filter((b) => !ids.has(b.id)) }))
      }, 750, true)
    }
    if (quake) {
      later(() => {
        setAnim((a) => (a.quake?.id === quake.id ? { ...a, quake: null } : a))
      }, 600, true)
    }
    if (ebbId) {
      later(() => {
        setAnim((a) => (a.turnEbb === ebbId ? { ...a, turnEbb: 0 } : a))
      }, 700, true)
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

    const entries = buildTimeline(lastEvents, rectsRef.current, guardsRef.current)
    const hold = entries.some((e) => e.release)
    setAnim((a) => ({ ...a, cast: null, lethalFlash: false, holdResult: hold }))
    for (const e of entries) {
      if (e.t <= 0) execEntry(e)
      else later(() => execEntry(e), e.t)
    }
  }, [state, lastEvents])

  // 快照所有可动效元素的位置(供残影/突进换算)。
  //
  // 这里原来**没有依赖数组** —— 每次渲染都跑一遍 querySelectorAll +
  // getBoundingClientRect,而动效期间每个条目会触发约十次 setAnim,
  // 于是一次攻击就强制同步布局几十次,场面越宽越明显。
  //
  // 改成只跟 state 走:元素位置只在对局状态变化(有人上场/阵亡/换边)时才变;
  // 动效本身是 CSS transform,不改布局位置。这不只是更快,也更正确 ——
  // 原来在 transform 生效期间取到的 rect 是位移后的坐标,拿它换算突进向量是错的。
  useLayoutEffect(() => {
    const m = rectsRef.current
    const g = guardsRef.current
    g.clear()
    document.querySelectorAll<HTMLElement>('[data-fxkey]').forEach((el) => {
      const key = el.dataset.fxkey
      if (!key) return
      m.set(key, el.getBoundingClientRect())
      // 顺手快照守护状态:GeneralDied 事件里没有关键词,而死亡那一帧
      // 单位已从 DOM 移除 —— 残影要不要塌一堵墙,只有上一帧知道。
      if (el.dataset.guard) g.add(key)
    })
  }, [state])

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
