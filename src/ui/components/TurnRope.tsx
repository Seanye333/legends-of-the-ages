import { useEffect, useState } from 'react'
import { useT } from '../i18n'
import { playSfx } from '../sound'
import styles from './TurnRope.module.css'

interface TurnRopeProps {
  // 服务器给的强制结束时刻(epoch ms)。本地对局没有,传 null 即整个组件不渲染。
  deadline: number | null
  myTurn: boolean
}

// 只在最后这些秒数里才显形 —— 全程挂一根倒计时会让每回合都很赶,
// 而炉石那根绳子的作用是「快到了」的提醒,不是全程计时器。
const SHOW_WITHIN_MS = 25_000
const WARN_AT_MS = 10_000

// 回合绳。服务器有 90 秒回合时限(到点代打 EndTurn),
// 不把它显示出来的话,玩家会被一个看不见的计时器判掉回合 —— 那比没有计时器更糟。
export function TurnRope({ deadline, myTurn }: TurnRopeProps) {
  const t = useT()
  const [now, setNow] = useState(() => Date.now())
  const [warned, setWarned] = useState(false)

  useEffect(() => {
    if (deadline === null) return
    const id = window.setInterval(() => setNow(Date.now()), 250)
    return () => window.clearInterval(id)
  }, [deadline])

  // 换回合就重置「已提醒」标记
  useEffect(() => setWarned(false), [deadline])

  const left = deadline === null ? Infinity : deadline - now

  useEffect(() => {
    if (!myTurn || warned || left > WARN_AT_MS || left <= 0) return
    setWarned(true)
    playSfx('turnStart')
  }, [left, myTurn, warned])

  if (deadline === null || left > SHOW_WITHIN_MS) return null

  const seconds = Math.max(0, Math.ceil(left / 1000))
  const pct = Math.max(0, Math.min(100, (left / SHOW_WITHIN_MS) * 100))
  const urgent = left <= WARN_AT_MS

  return (
    <div
      className={`${styles.rope} ${urgent ? styles.urgent : ''}`}
      role="status"
      aria-live={urgent ? 'assertive' : 'polite'}
      aria-label={
        myTurn
          ? t(`本回合剩余 ${seconds} 秒`, `${seconds} seconds left in your turn`)
          : t(`对方回合剩余 ${seconds} 秒`, `${seconds} seconds left in opponent's turn`)
      }
    >
      <div className={styles.fuse} style={{ width: `${pct}%` }}>
        <span className={styles.spark} aria-hidden="true" />
      </div>
      <span className={styles.count}>
        {myTurn ? t('该你了', 'Your turn') : t('对方', 'Opponent')} · {seconds}s
      </span>
    </div>
  )
}
