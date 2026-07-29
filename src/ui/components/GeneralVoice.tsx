import { useEffect, useRef, useState } from 'react'
import type { GameEvent } from '../../engine/types'
import { CARDS_BY_ID } from '../../content/cards'
import { loadLore, loreNow } from '../../content/loreLazy'
import { usePickText } from '../i18n'
import styles from './GeneralVoice.module.css'

interface GeneralVoiceProps {
  events: GameEvent[]
}

// 名将出阵台词。
//
// 【这批文案本来就在仓库里】
// `lore.gen.ts` 里有 59 位名将的**单挑台词**(关羽「青龍偃月,斬!」那一类),
// 从导入那天起就只在「名将列传」那一屏里躺着 —— 也就是说玩家只有翻博物馆时
// 才看得到,真打起来的时候关羽和一个 7/7 的白板没有任何区别。
// 这里把它接到对局里:零新素材,零新数据,只是把已有的东西放到它该在的地方。
//
// 【为什么锚在单位上而不是屏幕角落】
// 关底 Boss 的台词(BossVoice)可以固定在角落,因为说话的永远是同一个人。
// 出阵台词说话的是**刚上场的那一位**,不指出是谁的话,五个人的场面上
// 玩家根本对不上号。所以用 data-fxkey 现查它的屏幕位置,把气泡钉在他头上。
//
// 【三条节流,全部是为了别变成刷屏】
//   · 同一个人一局只说一次(名字进 saidRef 就不再触发);
//   · 一局最多 VOICE_BUDGET 条 —— 铺场流一回合能上四个人,不设上限会连珠炮;
//   · 一条 2.6 秒自动消失,新的直接顶掉旧的(排队会让台词落后战况好几步)。
const VOICE_BUDGET = 6
const HOLD_MS = 2600

interface Bubble {
  id: number
  text: string
  x: number
  y: number
}

export function GeneralVoice({ events }: GeneralVoiceProps) {
  const pick = usePickText()
  const [bubble, setBubble] = useState<Bubble | null>(null)
  const saidRef = useRef<Set<string>>(new Set())
  const budgetRef = useRef(VOICE_BUDGET)
  const seenRef = useRef<GameEvent[] | null>(null)
  const seqRef = useRef(0)
  // 列传是懒加载的 144KB(见 loreLazy)。开局就预热一次,这样第一位名将
  // 上场时台词已经在手边;没加载完就不说话 —— 台词晚到不如不到。
  const [, setLoreReady] = useState(false)

  useEffect(() => {
    let alive = true
    void loadLore().then(() => {
      if (alive) setLoreReady(true)
    })
    return () => {
      alive = false
    }
  }, [])

  useEffect(() => {
    if (events === seenRef.current) return
    seenRef.current = events
    if (budgetRef.current <= 0) return
    const lore = loreNow()

    for (const ev of events) {
      // 出阵与单挑各说一次。单挑是这批台词的原始出处(它们本就是单挑词),
      // 出阵是更常见的那个场合 —— 两个都接,谁先来算谁的。
      const iid =
        ev.type === 'GeneralSummoned'
          ? ev.iid
          : ev.type === 'DuelFought'
            ? ev.challengerIid
            : undefined
      if (iid === undefined) continue
      const defId =
        ev.type === 'GeneralSummoned'
          ? ev.defId
          : // 单挑事件不带 defId,靠场上元素的 data-def 反查
            document.querySelector<HTMLElement>(`[data-fxkey="gen-${iid}"]`)?.dataset.def
      if (!defId || saidRef.current.has(defId)) continue
      const line = lore[defId]?.line
      if (!line?.zh) continue
      // 白板小兵不该开口 —— 有台词的都是签名卡,但衍生物也可能撞 id,顺手挡一下
      if (CARDS_BY_ID[defId]?.token) continue
      const el = document.querySelector<HTMLElement>(`[data-fxkey="gen-${iid}"]`)
      if (!el) continue
      const r = el.getBoundingClientRect()
      saidRef.current.add(defId)
      budgetRef.current -= 1
      seqRef.current += 1
      setBubble({
        id: seqRef.current,
        text: pick(line),
        x: r.left + r.width / 2,
        y: r.top,
      })
      break // 一批事件只说一句
    }
  }, [events, pick])

  useEffect(() => {
    if (!bubble) return
    const timer = window.setTimeout(() => setBubble(null), HOLD_MS)
    return () => window.clearTimeout(timer)
  }, [bubble])

  if (!bubble) return null
  return (
    <div
      key={bubble.id}
      className={styles.bubble}
      role="status"
      style={{ left: `${bubble.x}px`, top: `${bubble.y}px` }}
    >
      {bubble.text}
    </div>
  )
}
