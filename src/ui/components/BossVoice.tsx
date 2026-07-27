import { useEffect, useRef, useState } from 'react'
import type { GameEvent, GameState } from '../../engine/types'
import { bossLines } from '../../content/bossLines'
import { usePickText } from '../i18n'
import styles from './BossVoice.module.css'

interface BossVoiceProps {
  bossId: string | null
  state: GameState
  events: GameEvent[]
}

// 关底 Boss 的战场台词气泡。
//
// 触发全部从**事件流**推,不需要引擎配合(铁律 7:UI 只消费事件,不做状态 diff)。
// 三个节流规矩,都是为了别把气泡变成刷屏:
//   · 同一类台词一局只播一次(open / low / win),斩将那句最多三次;
//   · 一条播 3.6 秒自动消失;
//   · 新台词直接顶掉旧的 —— 排队会让台词落后于战况好几个回合,那更怪。
export function BossVoice({ bossId, state, events }: BossVoiceProps) {
  const pick = usePickText()
  const lines = bossLines(bossId)
  const [text, setText] = useState<string | null>(null)
  const firedRef = useRef<Set<string>>(new Set())
  const killCountRef = useRef(0)
  const seenRef = useRef<GameEvent[] | null>(null)

  useEffect(() => {
    if (!lines) return
    if (events === seenRef.current) return
    seenRef.current = events
    const fired = firedRef.current

    const say = (key: string, zhEn: { zh: string; en: string }) => {
      if (fired.has(key)) return
      fired.add(key)
      setText(pick(zhEn))
    }

    // 开场:第一帧就说
    if (!fired.has('open')) say('open', lines.open)

    for (const ev of events) {
      // 它赢了
      if (ev.type === 'GameEnded' && ev.winner === 1) say('win', lines.win)
      // 斩了我方一员武将(座位 0 的单位死了)
      if (ev.type === 'GeneralDied' && ev.player === 0 && killCountRef.current < 3) {
        killCountRef.current++
        fired.delete('kill')
        say(`kill`, lines.kill)
      }
    }

    // 它自己掉到半血以下
    const foe = state.players[1]
    if (foe.heroHp > 0 && foe.heroHp <= foe.heroMaxHp / 2) say('low', lines.low)
  }, [events, state, lines, pick])

  useEffect(() => {
    if (text === null) return
    const timer = window.setTimeout(() => setText(null), 3600)
    return () => window.clearTimeout(timer)
  }, [text])

  if (!lines || text === null) return null
  return (
    <div className={styles.bubble} role="status">
      {text}
    </div>
  )
}
