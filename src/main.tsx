import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { startProfileSync } from './app/profileSync'
import './index.css'

// 存档云同步:本地优先,云端只是镜像;没服务器/断网时静默降级,不阻塞启动。
startProfileSync()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
