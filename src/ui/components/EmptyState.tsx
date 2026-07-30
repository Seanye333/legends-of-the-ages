import type { ReactNode } from 'react'
import styles from './EmptyState.module.css'

interface EmptyStateProps {
  // 一个字形。用字而不是图标 —— 这套界面的视觉语言是书法与印章,
  // 一个线性图标插进来会立刻显得是别的软件的零件。
  glyph: string
  title: string
  hint?: string
  action?: ReactNode
}

// 空态。
//
// 【为什么要收成一个组件】
// 截图审下来:战报回放的空态是居中一行小字,图鉴无结果是一行小字,
// 竞技场功勋不足时整页只有一个灰按钮,个人纪录是一句话。
// 四处各写各的,而它们回答的是同一个问题 ——
// **「这里现在是空的,以及你可以做什么」**。
//
// 【空态是最容易被当成 bug 的地方】
// 一行灰字居中,读起来和「加载失败」几乎没有区别。给它一个字形、一句标题、
// 一句去路,它才像是设计过的状态,而不是什么都没渲染出来。
export function EmptyState({ glyph, title, hint, action }: EmptyStateProps) {
  return (
    <div className={styles.wrap} role="status">
      <span className={styles.glyph} aria-hidden="true">
        {glyph}
      </span>
      <div className={styles.title}>{title}</div>
      {hint && <p className={styles.hint}>{hint}</p>}
      {action && <div className={styles.action}>{action}</div>}
    </div>
  )
}
