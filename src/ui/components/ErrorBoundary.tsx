import { Component } from 'react'
import type { ErrorInfo, ReactNode } from 'react'
import { recordCrash } from '../../app/telemetry'
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
    // 落盘留档:刷新之后这一屏就没了,而玩家往往是**第二天**才来说「昨天闪退过」。
    // 只写 localStorage,不上报(见 app/telemetry.ts 的说明)。
    recordCrash(error, info.componentStack?.split('\n')[1]?.trim())
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
          {/* 【为什么需要这条出路】
              「重新载入」在**崩因是某个已持久化的坏状态**时会无限循环回同一页 ——
              刷新 → 反序列化那份坏数据 → 再崩。玩家除了清浏览器数据没有别的办法,
              而那会连搬迁凭据一起清掉。
              这里只删对局相关的易变状态(当前对局、战报、各模式进行中的 run),
              **保留收藏、功勋、成就、设置与搬迁凭据** —— 它们几乎不可能是崩因,
              而它们才是玩家真正在意的东西。 */}
          <button
            type="button"
            className={styles.secondary}
            onClick={() => {
              // 只清「进行中」的那一批。收藏/成就/设置/凭据一概不动。
              const volatile = [
                'qiangu-replays',
                'qiangu-arena',
                'qiangu-expedition',
                'qiangu-tower',
                'qiangu-bossrush',
                'qiangu-lethal',
                'qiangu-remote-session',
              ]
              for (const k of volatile) {
                try {
                  localStorage.removeItem(k)
                } catch {
                  /* 存储不可用:那就更不可能是它崩的 */
                }
              }
              location.reload()
            }}
          >
            清除进行中的对局再启动 · Clear in-progress runs &amp; restart
          </button>
        </div>
      </div>
    )
  }
}
