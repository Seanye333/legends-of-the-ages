import { describe, expect, it } from 'vitest'
import { LORE, TRAIT_NAMES } from './generated/lore.gen'
import { CARDS_BY_ID } from './cards'

// 武将档案的**出处闸门**。
//
// 【为什么需要它】
// 档案里的字段分两种来源:从生平原文抠的,和从姊妹仓库名册字段读的。
// 后者踩过一次大坑:名册有个 `hometownCityId`,名字看着就是籍贯,
// 实际是那个游戏**战棋地图上的驻地** —— 关羽记成濮陽、刘备记成北平
// (那是他投公孙瓒的地方)、荀彧记成许昌(那是他后来任职的地方)。
// 两者都有的 623 人里只有 20% 对得上,而错的那 1,100 多条照样进了列传、
// 进了图鉴、还被稽古拿去出题「谁是潁川人」。
//
// 这类错**不会崩、不会红**,只会在玩家查史料时露馅。唯一拦得住的办法是
// 断言「显示出来的东西必须在原文里找得到」—— 照抄可以,推断不行。
const GENERALS = Object.keys(LORE).filter((id) => CARDS_BY_ID[id])

describe('武将档案的出处', () => {
  it('籍贯必须是生平原文里的原话(照抄,不许推断)', () => {
    const orphans: string[] = []
    for (const id of GENERALS) {
      const home = LORE[id].home?.zh
      if (!home) continue
      const bio = LORE[id].bio?.zh ?? ''
      if (!bio.includes(home)) orphans.push(`${CARDS_BY_ID[id].name.zh}(${id}): 籍贯「${home}」在传里找不到`)
    }
    expect(orphans.slice(0, 10)).toEqual([])
  })

  it('籍贯规模没有悄悄归零 —— 换了抽法也得还有三成人有', () => {
    const n = GENERALS.filter((id) => LORE[id].home).length
    expect(n).toBeGreaterThan(600)
  })

  // 源头有 17 条「生平」其实是交叉引用(「參見「hist-xu-da」(明初徐達)。」)。
  // 徐達是冒险第二章的关底 —— 他的列传上就印着这一行坏指针。
  // 这类内容不会崩、不会红,只是**读起来像个 bug**,而它确实是。
  it('生平里没有坏指针 —— 交叉引用要么解开要么空着', () => {
    const bad = GENERALS.filter((id) => /^參見|^参见/.test(LORE[id].bio?.zh?.trim() ?? ''))
    expect(bad.map((id) => `${CARDS_BY_ID[id].name.zh}: ${LORE[id].bio!.zh.slice(0, 20)}`)).toEqual([])
  })

  it('表字是一到三个字,不会把整句话抠进来', () => {
    const bad: string[] = []
    for (const id of GENERALS) {
      const cz = LORE[id].courtesy?.zh
      if (!cz) continue
      if (cz.length < 1 || cz.length > 3) bad.push(`${CARDS_BY_ID[id].name.zh}: 「${cz}」`)
      // 表字里不该出现标点或「字」本身
      if (/[,,。;;字]/.test(cz)) bad.push(`${CARDS_BY_ID[id].name.zh}: 「${cz}」含标点`)
    }
    expect(bad.slice(0, 10)).toEqual([])
  })

  it('性格特质都能翻出译名 —— 否则列传上显示的是 id', () => {
    const missing = new Set<string>()
    for (const id of GENERALS) for (const tr of LORE[id].traits ?? []) if (!TRAIT_NAMES[tr]) missing.add(tr)
    expect([...missing]).toEqual([])
  })

  // 性格是从生平原文用正则抠的,失败模式有两种,而且都不会红:
  //   · **抠得太松** —— 一条单字正则(「仁」「義」「忠」)把半个卡池都吃了,
  //     于是「性格」变成人人都有的装饰。踩过:黃忠的传里必然有「忠」、
  //     曹仁的传里必然有「仁」,每个人先从自己的名字里领一条性格。
  //   · **抠得太少** —— 词表塌成十来种,两千人共用几个标签。
  // 两头各钉一根桩,中间那片才是「细致」。
  it('性格没有哪一条吃掉半个卡池(单字正则失控的信号)', () => {
    const n = new Map<string, number>()
    for (const id of GENERALS) for (const tr of LORE[id].traits ?? []) n.set(tr, (n.get(tr) ?? 0) + 1)
    const tagged = GENERALS.filter((id) => LORE[id].traits?.length).length
    const worst = [...n.entries()].sort((a, b) => b[1] - a[1])[0]
    expect(worst[1] / tagged, `${TRAIT_NAMES[worst[0]]?.zh} 占了 ${worst[1]}/${tagged}`).toBeLessThan(0.25)
  })

  it('性格词表铺得开 —— 至少一百种在用,每人至多四条', () => {
    const kinds = new Set<string>()
    for (const id of GENERALS) {
      const tr = LORE[id].traits ?? []
      expect(tr.length, id).toBeLessThanOrEqual(4)
      for (const t of tr) kinds.add(t)
    }
    expect(kinds.size).toBeGreaterThan(100)
  })

  it('五维都在 0–100,条形图不会画出格', () => {
    for (const id of GENERALS) {
      const s = LORE[id].stats
      if (!s) continue
      for (const [k, v] of Object.entries(s)) {
        expect(v, `${id}.${k}`).toBeGreaterThanOrEqual(0)
        expect(v, `${id}.${k}`).toBeLessThanOrEqual(100)
      }
    }
  })

  it('中文档案里不许混进英文单词(名言那条闸门的同款)', () => {
    const bad: string[] = []
    for (const id of GENERALS) {
      for (const field of ['home', 'courtesy', 'era'] as const) {
        const v = LORE[id][field]?.zh
        if (v && /[A-Za-z]{2,}/.test(v)) bad.push(`${id}.${field}: 「${v}」`)
      }
    }
    expect(bad.slice(0, 10)).toEqual([])
  })
})
