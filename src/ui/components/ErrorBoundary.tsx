import { Component } from 'react'
import type { ErrorInfo, ReactNode } from 'react'
import styles from './ErrorBoundary.module.css'

interface Props {
  children: ReactNode
}

interface State {
  error: Error | null
  info: string
}

// 渲染异常兜底。在这之前,任何一个组件抛异常都是**白屏**,而且没有任何信号 ——
// 玩家看到一片黑,开发者什么都收不到(ScreenFallback 是 Suspense 占位,不是错误边界)。
//
// 这里刻意把错误摘要显示出来并提供一键复制:没有 Sentry 之类的上报通道时,
// 让玩家能把这段贴给你,是唯一现实的诊断途径。
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null, info: '' }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // 保留组件栈 —— 只有 message 的话经常定位不到是哪一屏炸的
    this.setState({ info: info.componentStack ?? '' })
    console.error('[qiangu] render error', error, info)
  }

  private report(): string {
    const { error, info } = this.state
    return [
      `千古名将 · 错误报告`,
      `UA: ${navigator.userAgent}`,
      `URL: ${location.href}`,
      ``,
      `${error?.name ?? 'Error'}: ${error?.message ?? ''}`,
      error?.stack ?? '',
      ``,
      info,
    ].join('\n')
  }

  render(): ReactNode {
    if (!this.state.error) return this.props.children
    return (
      <div className={styles.screen} role="alert">
        <div className={styles.seal} aria-hidden="true">
          誤
        </div>
        <h1 className={styles.title}>出了点岔子 · Something broke</h1>
        <p className={styles.body}>
          界面渲染时抛出了异常。对局进度已保存在本地,回到标题页通常可以继续。
          <br />
          The UI hit an unexpected error. Your progress is saved locally — returning to the title
          screen usually recovers it.
        </p>
        <pre className={styles.detail}>
          {this.state.error.name}: {this.state.error.message}
        </pre>
        <div className={styles.actions}>
          <button
            type="button"
            className={styles.primary}
            onClick={() => {
              location.reload()
            }}
          >
            重新载入 · Reload
          </button>
          <button
            type="button"
            className={styles.secondary}
            onClick={() => {
              void navigator.clipboard?.writeText(this.report())
            }}
          >
            复制错误信息 · Copy details
          </button>
        </div>
      </div>
    )
  }
}
