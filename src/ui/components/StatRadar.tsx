import { usePickCompact, useT } from '../i18n'
import styles from './StatRadar.module.css'

// 五维雷达图。
//
// 【为什么值得从条形换成雷达】
// 条形回答的是「统率多少」,雷达回答的是「**这是个什么样的人**」——
// 后者才是列传要说的话。张辽和荀彧的五条横杠得逐条比才看得出差别,
// 而两个五边形的形状一眼就不一样:一个偏武力那一角,一个偏智力那一角。
//
// 【为什么手写 SVG 而不引库】
// 图表库最小的也有几十 KB,而首屏预算只剩四十几 KB。
// 一个正五边形 + 一条折线 = 三十行三角函数,不值得为它引依赖。
//
// 【可访问性】
// 图形本身对读屏器是空的,所以数值同时以文本列在下面 ——
// 那一行不是冗余,它是这张图对读屏用户的**唯一**形态。
export interface Stat5 {
  ld: number
  war: number
  int: number
  pol: number
  cha: number
}

const AXES: [keyof Stat5, string, string][] = [
  ['ld', '統率', 'LEAD'],
  ['war', '武力', 'WAR'],
  ['int', '智力', 'INT'],
  ['pol', '政治', 'POL'],
  ['cha', '魅力', 'CHA'],
]

const R = 42
const CX = 56
const CY = 50
// 从正上方开始,顺时针 —— 和五维的习惯读序一致
const angle = (i: number) => (Math.PI * 2 * i) / AXES.length - Math.PI / 2
const at = (i: number, r: number) => `${CX + r * Math.cos(angle(i))},${CY + r * Math.sin(angle(i))}`

export function StatRadar({ stats, color = '#d8b26a' }: { stats: Stat5; color?: string }) {
  const t = useT()
  const pickCompact = usePickCompact()
  const ring = (frac: number) => AXES.map((_, i) => at(i, R * frac)).join(' ')
  const shape = AXES.map(([k], i) => at(i, (R * Math.max(0, Math.min(100, stats[k]))) / 100)).join(' ')

  return (
    <div className={styles.wrap}>
      <svg viewBox="0 0 112 100" className={styles.svg} aria-hidden="true">
        {[0.25, 0.5, 0.75, 1].map((f) => (
          <polygon key={f} points={ring(f)} className={styles.grid} />
        ))}
        {AXES.map((_, i) => (
          <line key={i} x1={CX} y1={CY} x2={at(i, R).split(',')[0]} y2={at(i, R).split(',')[1]} className={styles.spoke} />
        ))}
        <polygon points={shape} className={styles.shape} style={{ fill: color, stroke: color }} />
        {AXES.map(([k], i) => {
          const [x, y] = at(i, (R * Math.max(0, Math.min(100, stats[k]))) / 100).split(',')
          return <circle key={k} cx={x} cy={y} r={1.6} style={{ fill: color }} />
        })}
        {AXES.map(([, zh, en], i) => {
          const [x, y] = at(i, R + 8).split(',')
          return (
            <text key={zh} x={x} y={y} className={styles.axisLabel} dominantBaseline="middle">
              {pickCompact({ zh: zh[0], en: en[0] })}
            </text>
          )
        })}
      </svg>
      {/* 读屏器唯一读得到的那一份 —— 图形是 aria-hidden 的 */}
      <ul className={styles.readout}>
        {AXES.map(([k, zh, en]) => (
          <li key={k}>
            <span className={styles.readoutLabel}>{t(zh, en)}</span>
            <b>{stats[k]}</b>
          </li>
        ))}
      </ul>
    </div>
  )
}
