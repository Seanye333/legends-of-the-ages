import { useEffect, useMemo, useRef, useState } from 'react'
import type { GameEvent, GameState } from '../../engine/types'
import {
  EMPTY_SEEN,
  TUTORIAL_STEPS,
  accumulateSeen,
  markTutorialDone,
  type SeenFlags,
} from '../tutorial'
import { usePickText, useT } from '../i18n'
import { playSfx } from '../sound'
import styles from './TutorialCoach.module.css'

interface TutorialCoachProps {
  state: GameState
  events: GameEvent[]
  onQuit: () => void
}

// 教程教鞭:一次只讲一步,不遮挡操作(背板不吃点击)。
// 步骤按谓词推进 —— 玩家怎么打都能跟上,不存在「卡在第 3 步」。
export function TutorialCoach({ state, events, onQuit }: TutorialCoachProps) {
  const t = useT()
  const pick = usePickText()
  const [doneIds, setDoneIds] = useState<string[]>([])
  const [seen, setSeen] = useState<SeenFlags>(EMPTY_SEEN)
  const processedRef = useRef<GameEvent[] | null>(null)

  // 累积整局事件特征(单批 lastEvents 会被下一批冲掉)
  useEffect(() => {
    if (events === processedRef.current) return
    processedRef.current = events
    setSeen((s) => accumulateSeen(s, events))
  }, [events])

  const step = useMemo(
    () =>
      TUTORIAL_STEPS.find(
        (s) => !doneIds.includes(s.id) && (s.when ? s.when(state) : true),
      ) ?? null,
    [doneIds, state],
  )

  // 满足自动完成条件即推进
  useEffect(() => {
    if (!step?.until) return
    if (step.until(state, seen)) {
      playSfx('turnStart')
      setDoneIds((d) => [...d, step.id])
    }
  }, [step, state, seen])

  // 终局:标记教程完成
  useEffect(() => {
    if (state.phase === 'ended') markTutorialDone()
  }, [state.phase])

  if (!step || state.phase === 'ended') return null

  const index = TUTORIAL_STEPS.indexOf(step) + 1
  const waiting = step.until !== undefined
  // 调度浮层占据屏幕下半部,教鞭此时靠上,免得压住「全部保留」
  const layerCls =
    state.phase === 'mulligan' ? `${styles.layer} ${styles.layerTop}` : styles.layer

  return (
    <div className={layerCls}>
      <div className={styles.card}>
        <div className={styles.head}>
          <span className={styles.step}>
            {index} / {TUTORIAL_STEPS.length}
          </span>
          <span className={styles.title}>{pick(step.title)}</span>
          <button
            className={styles.skip}
            onClick={() => {
              markTutorialDone()
              onQuit()
            }}
          >
            {t('跳过教程', 'Skip')}
          </button>
        </div>
        <p className={styles.body}>{pick(step.body)}</p>
        {waiting ? (
          <span className={styles.hint}>{t('照做即可继续 ▾', 'Do it to continue ▾')}</span>
        ) : (
          <button
            className={styles.next}
            onClick={() => {
              playSfx('buttonTap')
              setDoneIds((d) => [...d, step.id])
            }}
          >
            {t('明白了', 'Got it')}
          </button>
        )}
      </div>
    </div>
  )
}
