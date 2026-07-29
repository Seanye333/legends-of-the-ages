import { useEffect, useState } from 'react'
import { useT } from '../i18n'
import { playSfx } from '../sound'
import styles from './InstallPrompt.module.css'

// 装到桌面 —— 安装引导。
//
// 【为什么值得做】
// 这个游戏离线完全能玩(app shell 与四张底图都在 precache 里),
// 但**浏览器标签页里的东西没人会第二天再打开**。装到主屏之后它才有图标、
// 才全屏、才不带地址栏 —— 也就是说才像一个游戏。
//
// 【两条完全不同的路】
// Chrome/Edge 有 `beforeinstallprompt`:拦下它,自己挑时机再 prompt()。
// **iOS Safari 没有这个事件**,而且永远不会有 —— 苹果只允许用户手动
// 「分享 → 添加到主屏幕」。所以 iOS 只能给图文说明,这不是偷懒,是平台限制。
// 两条路的文案完全不同,合成一句「安装本应用」的话 iOS 用户会去找一个不存在的按钮。
//
// 【为什么不一进来就弹】
// 第一次打开就被要求安装,答案基本一定是「不」,而 `beforeinstallprompt`
// 一局只给一次机会 —— 浪费掉就没了。等到玩家至少打完一局再问:
// 那时候他已经知道这是什么东西了。
// 拒绝之后 30 天内不再问(记 localStorage),别变成牛皮癣。

const DISMISS_KEY = 'qiangu-install-dismissed'
const QUIET_DAYS = 30

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

function dismissedRecently(): boolean {
  try {
    const at = Number(localStorage.getItem(DISMISS_KEY) ?? 0)
    if (!at) return false
    return Date.now() - at < QUIET_DAYS * 86_400_000
  } catch {
    return false
  }
}

// 已经装好了就别再劝。三条判据覆盖 Chrome / iOS Safari / 桌面 PWA。
function alreadyInstalled(): boolean {
  if (typeof window === 'undefined') return false
  if (window.matchMedia?.('(display-mode: standalone)').matches) return true
  // iOS Safari 独有的非标准属性
  if ((window.navigator as { standalone?: boolean }).standalone === true) return true
  // Tauri 打包版本身就是「已安装」,而且它连 SW 都没有
  if ('__TAURI_INTERNALS__' in window) return true
  return false
}

function isIosSafari(): boolean {
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent
  const ios = /iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)
  // Chrome/Firefox on iOS 也是 WebKit,但它们装不了 PWA —— 只有 Safari 能
  return ios && !/CriOS|FxiOS|EdgiOS/.test(ua)
}

interface InstallPromptProps {
  // 玩家是不是已经打过至少一局。没打过就先不问(见上面为什么)。
  ready: boolean
}

export function InstallPrompt({ ready }: InstallPromptProps) {
  const t = useT()
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null)
  const [showIos, setShowIos] = useState(false)
  const [gone, setGone] = useState(false)

  useEffect(() => {
    if (alreadyInstalled() || dismissedRecently()) {
      setGone(true)
      return
    }
    const onPrompt = (e: Event) => {
      // 必须拦下来,否则 Chrome 会用它自己的时机弹一个我们控制不了的横幅
      e.preventDefault()
      setDeferred(e as BeforeInstallPromptEvent)
    }
    window.addEventListener('beforeinstallprompt', onPrompt)
    // iOS 没有那个事件,只能靠 UA 判
    if (isIosSafari()) setShowIos(true)
    return () => window.removeEventListener('beforeinstallprompt', onPrompt)
  }, [])

  const dismiss = () => {
    playSfx('buttonTap')
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()))
    } catch {
      // 隐私模式下写不进去 —— 那就这一次不再显示,下次再问
    }
    setGone(true)
  }

  const install = async () => {
    if (!deferred) return
    playSfx('buttonTap')
    await deferred.prompt()
    const choice = await deferred.userChoice
    // 无论接受还是拒绝,这个事件都用掉了
    setDeferred(null)
    if (choice.outcome === 'dismissed') dismiss()
    else setGone(true)
  }

  if (gone || !ready) return null
  if (!deferred && !showIos) return null

  return (
    <div className={styles.bar} role="status">
      <span className={styles.glyph} aria-hidden="true">
        ⬓
      </span>
      <div className={styles.body}>
        <div className={styles.title}>{t('装到主屏', 'Add to Home Screen')}</div>
        <div className={styles.hint}>
          {deferred
            ? t('装好之后全屏、有图标,断网也能打。', 'Full screen, its own icon, and it plays offline.')
            : /* iOS:说清楚点哪个按钮 —— 「分享」在 Safari 底部工具栏中间 */
              t(
                '点底部的「分享」⬆︎,再选「添加到主屏幕」。断网也能打。',
                'Tap Share ⬆︎ in the toolbar, then "Add to Home Screen". It plays offline.',
              )}
        </div>
      </div>
      {deferred && (
        <button className={styles.go} onClick={() => void install()}>
          {t('安装', 'Install')}
        </button>
      )}
      <button className={styles.close} onClick={dismiss} aria-label={t('不再提示', 'Dismiss')}>
        ✕
      </button>
    </div>
  )
}
