// DurableObjectState 的最小内存替身,供单元测试用。
//
// 用它而不是 @cloudflare/vitest-pool-workers 的取舍:
// 那个方案能跑真 workerd(更真实),但要引一整套 pool + 单独的 vitest 配置,
// 而我们要测的是**纯逻辑**——ELO 数学、赛季换算、TOFU 判定、闹钟取最早值。
// 这些逻辑不碰 workerd 的任何特有行为,一个 Map 就够了。
//
// 真正需要 workerd 语义的部分(hibernation、alarm 真的被调度、WebSocketPair)
// 仍然只能靠 server/drive-test.ts —— 那条防线不能撤。
export interface FakeCtx {
  storage: {
    get<T>(key: string): Promise<T | undefined>
    put(key: string, value: unknown): Promise<void>
    delete(key: string): Promise<boolean>
    deleteAll(): Promise<void>
    list<T>(opts?: { prefix?: string }): Promise<Map<string, T>>
    setAlarm(at: number): Promise<void>
    getAlarm(): Promise<number | null>
  }
  id: { name?: string }
  _alarm: number | null
  _map: Map<string, unknown>
}

export function fakeCtx(name?: string): FakeCtx {
  const map = new Map<string, unknown>()
  const ctx: FakeCtx = {
    _map: map,
    _alarm: null,
    id: { name },
    storage: {
      async get<T>(key: string) {
        // 结构化克隆一份:真 DO 的 get 返回的是反序列化结果,
        // 直接返回同一个对象引用会让「改了没 put 也生效」这类 bug 测不出来
        const v = map.get(key)
        return (v === undefined ? undefined : structuredClone(v)) as T | undefined
      },
      async put(key: string, value: unknown) {
        map.set(key, structuredClone(value))
      },
      async delete(key: string) {
        return map.delete(key)
      },
      async deleteAll() {
        map.clear()
      },
      async list<T>(opts?: { prefix?: string }) {
        const out = new Map<string, T>()
        for (const [k, v] of map) {
          if (opts?.prefix && !k.startsWith(opts.prefix)) continue
          out.set(k, structuredClone(v) as T)
        }
        return out
      },
      async setAlarm(at: number) {
        ctx._alarm = at
      },
      async getAlarm() {
        return ctx._alarm
      },
    },
  }
  return ctx
}
