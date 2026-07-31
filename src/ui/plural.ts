// 英文单复数。
//
// 【为什么这个游戏特别容易漏】
// 英文是**贴着中文写的**:`t('连续 3 天', `${n} days running`)`。
// 中文没有单复数,所以写的时候脑子里根本不会冒出这件事 ——
// 而且写代码的人自己一直开着中文界面,永远看不到英文。
//
// 漏掉的地方还偏偏都是**最常被看到**的那些:第一天登录看到「1 days running」、
// 牌库剩最后一张看到「1 cards left」、超编一张看到「1 cards too many」。
// 也就是说 n === 1 不是边界情况,而是这些文案里出现频率最高的那个值。
//
// 只处理规则复数;不规则的(copy/copies)传第二个参数。
export function plural(n: number, one: string, many?: string): string {
  return n === 1 ? one : (many ?? `${one}s`)
}

// `3 cards` / `1 card` —— 带数字的那种,占了绝大多数用法
export function countOf(n: number, one: string, many?: string): string {
  return `${n} ${plural(n, one, many)}`
}
