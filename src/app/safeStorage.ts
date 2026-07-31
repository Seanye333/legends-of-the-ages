import { createJSONStorage } from 'zustand/middleware'

// persist 的容错存储。**17 个 store 共用这一份。**
//
// 【为什么非要自己包一层】
// zustand 的 createJSONStorage 只对「取 window.localStorage 这个动作」包了
// try/catch —— 所以**隐私模式/禁用 localStorage 是安全的**(storage 取不到,
// persist 整体降级成 no-op)。但它的 `setItem` 是裸调:
//
//   setItem: (name, newValue) => storage.setItem(name, JSON.stringify(newValue))
//
// 于是**配额满(QuotaExceededError)时,任何一次 set() 都会同步抛给调用方**,
// 而调用方基本都是 React 事件处理器 —— 错误边界接不住,表现是「点了没反应」。
//
// 这件事在这个项目里不是理论风险:最大的配额消耗者是 replayStore
// (每局存全部帧的完整 GameState)。它自己有 try/catch,所以它把配额吃满之后,
// **炸的是别人** —— 玩家点「领取成就」没反应,而根因在战报回放。
//
// 【为什么不做自动清理】
// 试过想「配额满就删最旧的战报」,但那意味着一个 store 的写入路径去动另一个
// store 的数据,跨模块的隐式耦合比这个问题本身更糟。
// 这里只做两件事:写失败不抛、并记一条 crash 让它在诊断信息里留痕。
function warnOnce(key: string, err: unknown): void {
  if (warned.has(key)) return
  warned.add(key)
  // 动态引 telemetry:它自己也用 localStorage,静态引会绕成循环依赖
  void import('./telemetry')
    .then((m) => m.recordCrash(err, `persist:${key}`))
    .catch(() => undefined)
}
const warned = new Set<string>()

export const safeStorage = createJSONStorage(() => {
  // 这一层的 try 只挡「拿不到 localStorage」(隐私模式);
  // 拿到之后逐个方法再各自兜写入失败。
  let ls: Storage
  try {
    // 用 globalThis 而不是 window:tsconfig.test.json 不带 DOM lib
    // (引擎测试跑在 node 环境里),而这个模块会被 store 间接引到。
    ls = (globalThis as { localStorage?: Storage }).localStorage as Storage
    if (!ls) throw new Error('no localStorage')
    // Safari 隐私模式下 getItem 存在但 setItem 会抛 —— 探一次真的写
    const probe = '__qiangu_probe__'
    ls.setItem(probe, '1')
    ls.removeItem(probe)
  } catch {
    // 存储完全不可用:给 persist 一个内存实现,本局照常玩、退出即忘。
    // 返回 undefined 也行(persist 会降级),但内存版能让同一次会话内
    // 的跨屏状态仍然一致。
    const mem = new Map<string, string>()
    return {
      getItem: (k: string) => mem.get(k) ?? null,
      setItem: (k: string, v: string) => void mem.set(k, v),
      removeItem: (k: string) => void mem.delete(k),
    }
  }
  return {
    getItem: (k: string) => {
      try {
        return ls.getItem(k)
      } catch (e) {
        warnOnce(k, e)
        return null
      }
    },
    setItem: (k: string, v: string) => {
      try {
        ls.setItem(k, v)
      } catch (e) {
        // 配额满:这一次没存住,但**绝不能把异常抛回 set() 的调用方**
        warnOnce(k, e)
      }
    },
    removeItem: (k: string) => {
      try {
        ls.removeItem(k)
      } catch (e) {
        warnOnce(k, e)
      }
    },
  }
})
