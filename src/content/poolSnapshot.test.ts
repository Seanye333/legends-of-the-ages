// 卡池快照闸门 —— 「有东西悄悄变了」的兜底。
//
// 【它守的是哪一段】
// `check-generated` 守的是**生成层**:重跑 import-content,产物必须逐字节一致。
// 但它需要姊妹仓库 `../ThreeKingdomMastersIOS`,在别人的机器和 CI 上都不存在 ——
// 那时候它跳过。而且它管不到覆盖层:`src/content/overrides/**` 是手写的,
// 生成脚本根本不碰。
//
// 于是「最终打出来的那副卡池」没有任何东西守着。已知会从这个缺口漏过去的:
//   · `Record<string, T>` 覆盖表撞键 —— tsc 不报错,后写的整条盖掉先写的(坑 2);
//   · 改一个共用的构造函数 / 常量,一次动几百张卡的效果;
//   · 生成层漂移,而这台机器上没有素材源,check-generated 只能跳过。
// 这几类的共同点是**不崩、不红、只是有东西不一样了** —— 本仓库最贵的一类 bug。
//
// 【为什么存可读的字段串,不存一个总哈希】
// 总哈希红了只会说「变了」,而这里真正要回答的是「**哪几张、变了什么**」。
// 快照里每张卡一行 `费用/攻/血 稀有度 主义 类型 [关键词] fx:<哈希>` ——
// git diff 直接就是一份改动清单,评审时看得见「谁被动了」。
// 效果脚本太长,压成 8 位哈希:它变了会点名到卡,再去看那张卡即可。
//
// 【改动了怎么办】
// 这**不是**「不许改卡池」。故意的改动就 `npm run pool-snapshot` 重生成,
// 然后**把快照的 diff 一起提交** —— 那份 diff 就是这次改了什么的证据。
// 摘要逻辑在 src/content/poolSnapshot.ts,写快照的脚本和这里用的是同一份
// (两边各写一遍的话,有一天它们会悄悄分叉,而那正好是这道闸门要防的事)。
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { COLLECTIBLE_CARDS } from './cards'
import { digest, poolDigests } from './poolSnapshot'
import type { CardDef } from '../engine/types'

// Windows 下 `new URL('./x', import.meta.url).pathname` 会给出 `/C:/…`,fs 读不了。
// 走 fileURLToPath + join —— 这个坑这一轮已经踩过三次(browserSafe / errorCoverage / achievement)。
const SNAPSHOT = join(dirname(fileURLToPath(import.meta.url)), 'pool-snapshot.json')

const current = poolDigests()

describe('卡池快照', () => {
  it('和已提交的快照一致(故意改了就 npm run pool-snapshot,并把 diff 一起提交)', () => {
    const saved: Record<string, string> = JSON.parse(readFileSync(SNAPSHOT, 'utf8'))

    // 分三类报,而不是丢一个巨大的对象 diff ——
    // 两千四百张的对象比较,vitest 打出来的东西没人读得完。
    const added = Object.keys(current).filter((id) => !(id in saved))
    const removed = Object.keys(saved).filter((id) => !(id in current))
    const changed = Object.keys(current)
      .filter((id) => id in saved && saved[id] !== current[id])
      .map((id) => `${id}\n    旧 ${saved[id]}\n    新 ${current[id]}`)

    const show = (label: string, list: string[]) =>
      list.length === 0
        ? ''
        : `\n${label}(${list.length}):\n  ${list.slice(0, 25).join('\n  ')}` +
          (list.length > 25 ? `\n  …另外 ${list.length - 25} 条` : '')

    const report = show('新增', added) + show('删除', removed) + show('改动', changed)

    expect(
      report,
      report
        ? `卡池和已提交的快照对不上。${report}\n\n` +
          `故意的改动:npm run pool-snapshot,然后把 pool-snapshot.json 的 diff 一起提交 ——\n` +
          `那份 diff 就是改动清单。悄悄更新快照等于把这道闸门关掉。`
        : undefined,
    ).toBe('')
  })

  it('快照里的卡和卡池数量对得上', () => {
    const saved: Record<string, string> = JSON.parse(readFileSync(SNAPSHOT, 'utf8'))
    expect(Object.keys(saved).length).toBe(Object.keys(current).length)
  })

  it('摘要只认影响对局的字段 —— 改名字不该让闸门红', () => {
    // 没有这一条的话,只要有人补一句风味文案,快照就红一次。
    // 红得太容易的闸门会被无脑更新,那时候它守不住任何东西。
    const c = COLLECTIBLE_CARDS.find((x) => !x.token)!
    const renamed = { ...c, name: { zh: '改了名字', en: 'Renamed' }, flavor: { zh: '新风味', en: 'x' } }
    expect(digest(renamed as CardDef)).toBe(digest(c))
  })

  it('摘要认得出身材、关键词和效果的改动', () => {
    const c = COLLECTIBLE_CARDS.find((x) => !x.token && x.type === 'general')!
    expect(digest({ ...c, cost: c.cost + 1 } as CardDef)).not.toBe(digest(c))
    expect(digest({ ...c, attack: (c.attack ?? 0) + 1 } as CardDef)).not.toBe(digest(c))
    expect(digest({ ...c, keywords: [...c.keywords, 'guard'] } as CardDef)).not.toBe(digest(c))
    expect(
      digest({ ...c, battlecry: { ops: [{ op: 'draw', count: 9 }] } } as unknown as CardDef),
    ).not.toBe(digest(c))
  })

  // 标签本身不做任何事,但**有卡在数它们** —— 贴一个 `defector` 就是在改
  // 一批卡的战力。这条测试是 2026-08-08 补的:降将那一趟给 65 张卡贴了标签,
  // 而快照的 diff 只有 3 行(三张新卡),闸门一声不吭。
  it('部族标签算改动 —— 一个标签只要有人数它,它就是数值', () => {
    const c = COLLECTIBLE_CARDS.find((x) => !x.token && x.type === 'general' && !x.defector)!
    expect(digest({ ...c, defector: true } as CardDef)).not.toBe(digest(c))
    expect(digest({ ...c, troop: 'navy' } as CardDef)).not.toBe(digest(c))
    expect(digest({ ...c, battles: ['赤壁之戰'] } as CardDef)).not.toBe(digest(c))
  })

  it('关键词换个书写顺序不算改动', () => {
    const c = COLLECTIBLE_CARDS.find((x) => !x.token && x.keywords.length >= 2)!
    expect(digest({ ...c, keywords: [...c.keywords].reverse() } as CardDef)).toBe(digest(c))
  })

  it('快照是按 id 排序的 —— 否则 diff 会因为遍历顺序变化而炸开', () => {
    const ids = Object.keys(current)
    expect(ids).toEqual([...ids].sort((a, b) => a.localeCompare(b)))
  })
})
