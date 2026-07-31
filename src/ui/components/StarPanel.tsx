import { useState } from 'react'
import { omenFor } from '../../content/stargazing'
import { dayKey } from '../../content/dayKey'
import { useSettings } from '../../app/settingsStore'
import { usePickText, useT } from '../i18n'
import { playSfx } from '../sound'
import styles from './StarPanel.module.css'

// 觀星臺 —— 今夜的天象。
//
// 【它和其他「每日」的区别】
// 每日一将、每日军令、每日三题都是**任务**:去做一件事、领一份奖励,
// 做完今天就没别的了。观星不是任务,是**今天的底色** ——
// 不用点、不用领、没法刷,它只是在那儿,像天气一样。
//
// 【为什么默认收起】
// 标题页已经很挤(六个模式入口 + 卡组 + 军衔 + 每日一将)。
// 天象一行就够(星名 + 一句效果),想读那段史书口吻的占辞再展开。
export function StarPanel() {
  const t = useT()
  const pick = usePickText()
  const on = useSettings((s) => s.stargazing)
  const [open, setOpen] = useState(false)
  const omen = omenFor(dayKey())

  return (
    <div className={styles.panel}>
      <button
        className={styles.head}
        onClick={() => {
          playSfx('buttonTap')
          setOpen((v) => !v)
        }}
        aria-expanded={open}
      >
        <span className={styles.star} aria-hidden="true">
          ✳
        </span>
        <span className={styles.name}>{pick(omen.name)}</span>
        <span className={styles.chevron} aria-hidden="true">
          {open ? '▾' : '▸'}
        </span>
      </button>
      {open && (
        <div className={styles.body}>
          {/* 占辞是史书口吻,不解释规则;效果是规则口吻,说人话。
              两种声音刻意分开排 —— 混在一起两边都读不清。 */}
          <p className={styles.sign}>{pick(omen.sign)}</p>
          <p className={styles.effect}>{pick(omen.effect)}</p>
          {!on && (
            <p className={styles.off}>
              {t(
                '(觀星已在设置里关闭 —— 天象只显示,不作用于对局)',
                '(Stargazing is off in Settings — the omen is shown but does not affect matches.)',
              )}
            </p>
          )}
          <p className={styles.note}>
            {t(
              // 这是要渲染给玩家看的**纯文本**,不是 markdown —— 星号会原样显示。
              // (第一版就是这么漏出去的,截图上明晃晃两对 **。)
              '天象雙方同吃。冒險、遠征、名局、登樓、連斬、謎題不受影響 —— 那几个模式的难度是逐关量出来的。',
              'Omens affect both sides. Campaign, Expedition, Great Battles, Tower, Gauntlet and Puzzles are unaffected — their difficulty is tuned stage by stage.',
            )}
          </p>
        </div>
      )}
    </div>
  )
}
