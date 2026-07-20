import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { ErrorBoundary } from './ui/components/ErrorBoundary'
import { startProfileSync } from './app/profileSync'
import { initSound, setMasterVolume } from './ui/sound'
import { useSettings } from './app/settingsStore'
import './index.css'

// 存档云同步:本地优先,云端只是镜像;没服务器/断网时静默降级,不阻塞启动。
startProfileSync()

// 音频解锁监听挂在这里而不是各个界面里:直接深链进图鉴/构筑器时,
// 之前不会经过标题页,AudioContext 就一直是锁着的。
initSound()

// 设置落到全局:音量喂给音频母线,减少动效落成 <html data-reduced-motion>,
// 让 CSS 能把战斗特效整体关掉(战斗特效在 index.css 里,原来完全不理会这个偏好)。
function applySettings(s: { volume: number; reducedMotion: boolean }): void {
  setMasterVolume(s.volume)
  const prefersLess =
    typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches
  document.documentElement.dataset.reducedMotion = String(s.reducedMotion || prefersLess)
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
