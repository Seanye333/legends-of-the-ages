import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { ErrorBoundary } from './ui/components/ErrorBoundary'
import { recordCrash } from './app/telemetry'

// 错误边界只抓**渲染期**异常。事件回调、定时器、Promise 里的抛错它一概看不见 ——
// 而联机与音频那两块恰恰全是异步的。这两个监听补上那半边。
window.addEventListener('error', (e) => recordCrash(e.error ?? e.message, 'window.onerror'))
window.addEventListener('unhandledrejection', (e) => recordCrash(e.reason, 'unhandledrejection'))
import { startProfileSync } from './app/profileSync'
import { initSound, setMasterVolume, setMusicVolume, stopMusic } from './ui/sound'
import { useSettings } from './app/settingsStore'
import './index.css'

// 存档云同步:本地优先,云端只是镜像;没服务器/断网时静默降级,不阻塞启动。
startProfileSync()

// 音频解锁监听挂在这里而不是各个界面里:直接深链进图鉴/构筑器时,
// 之前不会经过标题页,AudioContext 就一直是锁着的。
initSound()

// 设置落到全局:音量喂给音频母线,减少动效落成 <html data-reduced-motion>,
// 让 CSS 能把战斗特效整体关掉(战斗特效在 index.css 里,原来完全不理会这个偏好)。
function applySettings(s: {
  volume: number
  reducedMotion: boolean
  soundEnabled: boolean
  musicEnabled: boolean
  musicVolume: number
  colorBlind: boolean
  theme: string
  uiScale: number
  language: string
}): void {
  setMasterVolume(s.volume)
  setMusicVolume(s.musicVolume)
  // 总音效开关关掉时,音乐也必须停 —— 玩家关音效多半是在安静场合
  if (!s.soundEnabled || !s.musicEnabled) stopMusic()
  const prefersLess =
    typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches
  document.documentElement.dataset.reducedMotion = String(s.reducedMotion || prefersLess)
  document.documentElement.dataset.colorblind = String(s.colorBlind)
  // 亮色主题:只写属性,值全在 index.css 的 :root[data-theme='light'] 里。
  // 暗色是默认,所以不写 data-theme —— 少一个要在两处保持一致的地方。
  if (s.theme === 'light') document.documentElement.dataset.theme = 'light'
  else delete document.documentElement.dataset.theme

  // 【lang 必须跟着语言走】
  // index.html 里写死 `<html lang="zh">`,切英文时从不更新。三个后果:
  //   1. **读屏器用中文语音念英文**(VoiceOver/TalkBack 按 lang 选语音库)——
  //      而这个项目是在意无障碍的(有 a11y.spec.ts)。
  //   2. 断词规则按中文走:中文允许任意字符间断行,英文不允许,
  //      长英文串在窄容器里的换行行为是错的。
  //   3. 拼写检查、font-variant、翻译提示全部按中文处理。
  // 它同时也是排版修复的**前置** —— 有了这一行,CSS 里的 `html[lang='en']`
  // 才选得中(见 index.css 里那段字距覆盖)。
  document.documentElement.lang = s.language === 'en' ? 'en' : 'zh-Hans'

  // 界面缩放走 **zoom**,不是根字号。
  //
  // 全站的字号几乎都写成 `clamp(12px, 2vh, 16px)` —— 两端是 px、中间是 vh,
  // 一个 rem 都没有。也就是说改 `html { font-size }` 对它们**完全没有作用**,
  // 那条最常见的做法在这个代码库里是无效的。
  //
  // zoom 缩放的是布局视口:px 跟着变,vh 的参照也跟着变,于是那些 clamp
  // 整体等比放大 —— 这正是「界面大一点」该有的行为(它缩放的是整个界面,
  // 而不只是文字,所以按钮的点击区也跟着变大,这对手抖的人比单放大字更有用)。
  //
  // 挂在 documentElement 而不是 #root:#root 是定位上下文,牌桌里那些
  // position: fixed 的层(指向箭、台词气泡、安装横幅)会以它为参照,
  // 缩放 #root 会让它们和牌桌错位。缩放根元素则一切都在同一个坐标系里。
  document.documentElement.style.zoom = s.uiScale === 1 ? '' : String(s.uiScale)
}
applySettings(useSettings.getState())
useSettings.subscribe(applySettings)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)
