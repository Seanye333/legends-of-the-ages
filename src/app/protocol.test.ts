// 服务器地址的协议推导:三种运行环境(HTTPS 网页 / Tauri 原生 / 本地开发)
// 各有各的约束,写错任何一条都表现为「填了地址却静默连不上」。
import { afterEach, describe, expect, it } from 'vitest'
import { httpBase, wsScheme } from './protocol'

// 模拟页面协议;Node 里本来没有 location
function setPageProtocol(protocol: string | null): void {
  const g = globalThis as { location?: unknown }
  if (protocol === null) delete g.location
  else g.location = { protocol }
}

afterEach(() => setPageProtocol(null))

describe('显式带 scheme 的地址原样尊重', () => {
  it('ws/wss 保持不变', () => {
    setPageProtocol('https:')
    expect(wsScheme('ws://example.com')).toBe('wss://') // 仅用于无 scheme 时,这里不参与
    expect(httpBase('wss://a.workers.dev')).toBe('https://a.workers.dev')
    expect(httpBase('ws://localhost:8787')).toBe('http://localhost:8787')
  })

  it('http/https 直接透传', () => {
    expect(httpBase('https://a.example.com')).toBe('https://a.example.com')
    expect(httpBase('http://192.168.1.9:8787')).toBe('http://192.168.1.9:8787')
  })
})

describe('本地与内网:必须明文(没有可用证书)', () => {
  it('localhost / 回环地址', () => {
    setPageProtocol('http:')
    for (const s of ['localhost:8787', '127.0.0.1:8787', '0.0.0.0:8787']) {
      expect(wsScheme(s), s).toBe('ws://')
      expect(httpBase(s), s).toBe(`http://${s}`)
    }
  })

  it('局域网网段与 .local(真机联调常用)', () => {
    setPageProtocol(null) // Tauri 原生:没有 https 页面
    for (const s of ['192.168.1.9:8787', '10.0.0.5:8787', '172.16.3.4:8787', 'macbook.local:8787']) {
      expect(wsScheme(s), s).toBe('ws://')
    }
  })
})

describe('远端主机:一律加密', () => {
  it('Tauri 原生环境下也要用 wss —— Workers 只收加密连接', () => {
    setPageProtocol(null) // 关键:原生 app 的页面不是 https
    expect(wsScheme('qiangu-server.foo.workers.dev')).toBe('wss://')
    expect(httpBase('qiangu-server.foo.workers.dev')).toBe('https://qiangu-server.foo.workers.dev')
  })

  it('HTTPS 网页下同样加密(否则被当混合内容拦掉)', () => {
    setPageProtocol('https:')
    expect(wsScheme('qiangu-server.foo.workers.dev')).toBe('wss://')
    expect(httpBase('qiangu-server.foo.workers.dev')).toBe('https://qiangu-server.foo.workers.dev')
  })
})

describe('HTTPS 页面压过本地判断', () => {
  it('部署在 HTTPS 时即便填 localhost 也不能降级为明文', () => {
    setPageProtocol('https:')
    // 浏览器无论如何都会拦掉明文;给出 wss 让失败发生在能看懂的地方
    expect(wsScheme('localhost:8787')).toBe('wss://')
    expect(httpBase('localhost:8787')).toBe('https://localhost:8787')
  })
})
