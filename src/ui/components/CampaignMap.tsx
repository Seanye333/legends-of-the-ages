import type { CSSProperties } from 'react'
import type { BossDef } from '../../content/campaign'
import { DOCTRINE_COLORS } from '../doctrineColors'
import { Portrait } from './Portrait'
import { usePickCompact, useT } from '../i18n'
import { playSfx } from '../sound'
import styles from './CampaignMap.module.css'

interface CampaignMapProps {
  bosses: readonly BossDef[]
  isCleared: (id: string) => boolean
  isUnlocked: (id: string) => boolean
  onPick: (b: BossDef) => void
}

// 冒险舆图。
//
// 【为什么要有】
// 「群雄逐鹿」讲的是一路打过去,而它此前是一条竖列表 ——
// 关与关之间只有一根 2×9px 的短竖条,读不出「行军」这件事。
//
// 【为什么是并存的第二视图,不是替换】
// 竖列表在手机上仍然是更好用的那个:24 关能滚、能读全名、能读称号。
// 舆图给的是**另一个问题的答案** ——「我走到哪了、还剩多少」。
// 两者并存,列表仍是默认(端到端用例也依赖那个结构)。
//
// 【为什么是蛇形不是自由布点】
// 位置必须由下标唯一决定,否则每次渲染的地图都不一样,玩家建立不起空间记忆。
// 蛇形(六个一行、逐行折返)天然读作一条行军路线,而且行数随关数自适应。
export function CampaignMap({ bosses, isCleared, isUnlocked, onPick }: CampaignMapProps) {
  const t = useT()
  const pickCompact = usePickCompact()

  const PER_ROW = 6
  const rows = Math.ceil(bosses.length / PER_ROW)
  // 百分比坐标 —— 容器怎么缩放,路线都还是那条路线
  const posOf = (i: number) => {
    const row = Math.floor(i / PER_ROW)
    const col = i % PER_ROW
    // 偶数行从左往右,奇数行折返 —— 这是「蛇形」的全部
    const c = row % 2 === 0 ? col : PER_ROW - 1 - col
    // 上下再按下标错开一点,让路线有起伏而不是一条直尺(用下标推,不用随机)
    const wobble = ((i * 7) % 5) - 2
    return {
      x: 8 + (c / (PER_ROW - 1)) * 84,
      y: ((row + 0.5) / rows) * 100 + wobble * 0.9,
    }
  }

  const pts = bosses.map((_, i) => posOf(i))
  const line = (from: number, to: number) =>
    pts
      .slice(from, to + 1)
      .map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`)
      .join(' ')

  // 「走过的路」**逐段**判定:第 i→i+1 段两头都通关了才算走过。
  //
  // 第一版是「画到最后一个已通关的下标为止」,而傳承轮次里通关顺序可能有缺口
  // (试炼、跳关),那样会把中间没走过的路一起画成金线 ——
  // 一张地图最不能骗人的就是「我走到哪了」。
  const doneSegs: [number, number][] = []
  for (let i = 0; i + 1 < bosses.length; i++) {
    if (!isCleared(bosses[i].id) || !isCleared(bosses[i + 1].id)) continue
    const last = doneSegs[doneSegs.length - 1]
    if (last && last[1] === i) last[1] = i + 1 // 与上一段相连就并成一条
    else doneSegs.push([i, i + 1])
  }

  return (
    <div className={styles.wrap}>
      <svg className={styles.paths} viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
        {/* 未走的路先画,走过的压在上面 */}
        <polyline className={styles.pathTodo} points={line(0, bosses.length - 1)} />
        {doneSegs.map(([a, z]) => (
          <polyline key={`${a}-${z}`} className={styles.pathDone} points={line(a, z)} />
        ))}
      </svg>
      {bosses.map((b, i) => {
        const p = pts[i]
        const done = isCleared(b.id)
        const open = isUnlocked(b.id)
        const next = open && !done
        return (
          <button
            key={b.id}
            className={`${styles.node} ${done ? styles.done : ''} ${!open ? styles.locked : ''} ${
              next ? styles.next : ''
            }`}
            style={
              {
                left: `${p.x}%`,
                top: `${p.y}%`,
                '--doctrine': DOCTRINE_COLORS[b.doctrine],
              } as CSSProperties
            }
            disabled={!open}
            aria-label={`${i + 1} · ${pickCompact(b.name)}`}
            onClick={() => {
              playSfx('buttonTap')
              onPick(b)
            }}
          >
            <span className={styles.face}>
              <Portrait id={b.heroId} nameZh={b.name.zh} doctrine={b.doctrine} />
            </span>
            <span className={styles.no}>{i + 1}</span>
            {done && (
              <span className={styles.flag} aria-hidden="true">
                ✓
              </span>
            )}
            {next && (
              <span className={styles.here} aria-hidden="true">
                ⚑
              </span>
            )}
          </button>
        )
      })}
      <div className={styles.legend}>
        {t(
          `已破 ${bosses.filter((b) => isCleared(b.id)).length} / ${bosses.length}`,
          `Cleared ${bosses.filter((b) => isCleared(b.id)).length} / ${bosses.length}`,
        )}
      </div>
    </div>
  )
}
