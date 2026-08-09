// 斩杀谜题的**轻量索引** —— 只有一串 id。
//
// 【它为什么单独存在】
// `lethalPuzzles.ts` 是 14.3KB 的残局定义(每道题的双方场面、手牌、
// 主公技、解法提示)。而 `lethalStore` 从里面只做两件事:
//   · 这个 id 是不是一道真题(`some(p => p.id === id)`)
//   · 全套解完了没有(`every(p => solved.includes(p.id))`)
// 也就是说它要的就是**这串 id**,一个残局都不用看。
//
// 但 store 是首屏就要加载的,于是 14.3KB 的残局定义跟着进了主包。
// 同 `historyIndex.ts` 一个路子,见 ROADMAP 第 51 条。
//
// 【为什么不怕它和真数据走样】
// 手写的表会烂,所以 `lethalIndex.test.ts` 双向钉住它和 `lethalPuzzles.ts`:
// 多一道、少一道、改了 id、顺序变了,都是红的。
// 走样的表现全是不崩不红的那一类 —— 少一道时「全套通关」永远凑不齐,
// 多一道时某道题的首解功勋发不出来。

export const LETHAL_PUZZLE_IDS: readonly string[] = [
  'lp-windfury',
  'lp-charge',
  'lp-heropower',
  'lp-breakwall',
  'lp-buffreach',
  'lp-gowide',
  'lp-massbuff',
  'lp-twowalls',
  'lp-combo',
  'lp-threeway',
  'lp-massrush',
  'lp-windping',
  'lp-pofu',
  'lp-beishui',
  'lp-doubleburn',
  'lp-gowide2',
]

/** 查得快一点 —— `solve()` 每次成功都要问一遍「这是不是真题」。 */
export const LETHAL_PUZZLE_ID_SET: ReadonlySet<string> = new Set(LETHAL_PUZZLE_IDS)
