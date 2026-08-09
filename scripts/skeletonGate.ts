// 预组骨架的**判定逻辑**。纯函数,配 skeletonGate.test.ts(铁律 11)。
//
// 【这道闸门是 2026-08-08 从一次真实失衡里倒推出来的,先说清楚它为什么长这样】
// 当时魏武揮鞭总胜率 59.4%,把坐斷東南打到 31%、大隱於市 34%,离 30% 的对位
// 闸门只剩一步。翻它的体检表,**每一项都合规**:
//
//   · 总身材 216,中位数 203,+6.4% —— deck-stats 的 8% 容差放行
//   · 抢攻 2 张 —— 骨架注释写的是「抢攻 1~2 张」,取上限也是合法
//   · 总攻 99 —— 没有任何一条规则管过总攻
//
// 所以「每项单独设上限」这条路是走不通的:它已经每项都在限内了。
// 真正的病是**同一套牌同时占据多项之首**。三项各自 +6% 不打紧,三项叠在一起
// 就是碾压。于是这道闸门管的不是「哪一项太高」,而是「有没有人把好处占全了」。
//
// 【为什么用「严格最高」而不是 z 分数】
// 只有六个样本,z 分数的分母(六个数的标准差)自己就抖得厉害,
// 一套牌小改两点就能让别人的 z 翻倍 —— 那种闸门会天天误报。
// 「在这一项上是不是独一份的第一」是个序数判据,不受尺度影响,六个样本也稳。
// 并列第一不算「占住」:优势不独有,就不构成这里说的那种叠加。
import type { DeckHealth } from '../src/content/deckHealth'

/** 参与「占了几项之首」计数的四项。都是**越大越强**的方向。 */
export const POWER_AXES = ['body', 'attack', 'aggro', 'removal'] as const
export type PowerAxis = (typeof POWER_AXES)[number]

export const AXIS_LABEL: Record<PowerAxis, string> = {
  body: '总身材',
  attack: '总攻',
  aggro: '抢攻',
  removal: '解场',
}

/**
 * 一套牌最多能独占几项之首。
 *
 * 定 2 的算术:六套牌、四项,某一套纯靠运气独占某一项的概率约 1/6,
 * 独占三项及以上约 C(4,3)·(1/6)³ ≈ 1.9% —— 低到可以当信号看,不是噪声。
 * 独占两项约 11.6%,那还在「正常的构筑取舍」范围里,不该报。
 */
export const MAX_TOPS = 2

/** 总身材允许偏离中位数的幅度(百分比)。沿用 deck-stats 原本就在印的那条。 */
export const BODY_DEV_PCT = 8

export interface SkeletonDeck {
  name: string
  health: DeckHealth
}

export interface SkeletonVerdict {
  problems: string[]
  /** 每套牌独占了哪几项之首 */
  tops: { name: string; axes: PowerAxis[] }[]
  medianBody: number
}

const median = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)]

export function judgeSkeleton(decks: SkeletonDeck[]): SkeletonVerdict {
  const problems: string[] = []
  const tops = decks.map((d) => ({ name: d.name, axes: [] as PowerAxis[] }))

  for (const axis of POWER_AXES) {
    const vals = decks.map((d) => d.health[axis])
    const max = Math.max(...vals)
    // 严格最高 = 只有一套取到最大值。并列不算。
    const winners = vals.map((v, i) => (v === max ? i : -1)).filter((i) => i >= 0)
    if (winners.length === 1) tops[winners[0]].axes.push(axis)
  }

  for (const t of tops) {
    if (t.axes.length > MAX_TOPS) {
      problems.push(
        `骨架占优过多:${t.name} 在 ${t.axes.length} 项上独占第一` +
          `(${t.axes.map((a) => AXIS_LABEL[a]).join('、')})—— 每项都在限内也不行,叠起来就是碾压`,
      )
    }
  }

  const medianBody = median(decks.map((d) => d.health.body))
  for (const d of decks) {
    const dev = (100 * (d.health.body - medianBody)) / medianBody
    if (Math.abs(dev) > BODY_DEV_PCT) {
      problems.push(
        `总身材偏离中位数超过 ${BODY_DEV_PCT}%:${d.name} ${d.health.body}` +
          `(中位数 ${medianBody},${dev > 0 ? '+' : ''}${dev.toFixed(0)}%)`,
      )
    }
  }

  return { problems, tops, medianBody }
}
