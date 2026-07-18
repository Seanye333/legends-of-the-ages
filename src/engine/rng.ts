// 种子随机数 (mulberry32)。引擎内所有随机性都必须经过这里,
// 状态作为 GameState.rng 显式传递 —— 这是回放和服务端权威校验成立的前提。

export function seedRng(seed: number): number {
  return seed | 0
}

export function rngNext(state: number): { next: number; value: number } {
  const next = (state + 0x6d2b79f5) | 0
  let t = Math.imul(next ^ (next >>> 15), 1 | next)
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
  const value = ((t ^ (t >>> 14)) >>> 0) / 4294967296
  return { next, value }
}

export function rngInt(state: number, maxExclusive: number): { next: number; value: number } {
  const { next, value } = rngNext(state)
  return { next, value: Math.floor(value * maxExclusive) }
}

// Fisher–Yates,返回新数组,不改动入参
export function rngShuffle<T>(state: number, items: readonly T[]): { next: number; result: T[] } {
  const result = items.slice()
  let s = state
  for (let i = result.length - 1; i > 0; i--) {
    const roll = rngInt(s, i + 1)
    s = roll.next
    const j = roll.value
    ;[result[i], result[j]] = [result[j], result[i]]
  }
  return { next: s, result }
}
