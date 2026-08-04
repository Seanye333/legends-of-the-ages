import { describe, expect, it } from 'vitest'
import { LORE, TRAIT_NAMES } from './generated/lore.gen'
import { LORE_OVERRIDES } from './overrides/lore-quotes'
import { CARDS_BY_ID, COLLECTIBLE_CARDS } from './cards'

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

  // 结局、著作、绰号和籍贯是同一条标准:显示出来的必须是原文里那个词。
  // 结局尤其要守 —— 它是从**传的末尾两句**里抠的,一旦有人把窗口放宽到全篇,
  // 吕后传里的「殺韓信、彭越」就会让吕后自己变成「被杀」。
  it('结局 / 著作 / 绰号都是生平原文里的原话', () => {
    const orphans: string[] = []
    for (const id of GENERALS) {
      const bio = LORE[id].bio?.zh ?? ''
      for (const f of ['fate', 'alias', 'garrison', 'defected'] as const) {
        const v = LORE[id][f]?.zh
        if (v && !bio.includes(v)) orphans.push(`${CARDS_BY_ID[id].name.zh}.${f}「${v}」在传里找不到`)
      }
      const w = LORE[id].works?.zh
      if (w && !bio.includes(w.replace(/[《》]/g, ''))) {
        orphans.push(`${CARDS_BY_ID[id].name.zh}.works「${w}」在传里找不到`)
      }
    }
    expect(orphans.slice(0, 10)).toEqual([])
  })

  it('结局只从传的末尾抠 —— 别人的死不算他的', () => {
    // 抽查:凡是判了结局的,那个词必须出现在**最后两句**里
    const bad: string[] = []
    for (const id of GENERALS) {
      const v = LORE[id].fate?.zh
      if (!v) continue
      const parts = (LORE[id].bio?.zh ?? '').split(/[。;!?]/).filter((x) => x.trim())
      if (!parts.slice(-2).join('。').includes(v)) bad.push(`${CARDS_BY_ID[id].name.zh}:「${v}」不在传的末尾`)
    }
    expect(bad.slice(0, 10)).toEqual([])
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

// 覆盖率基线。
//
// 【为什么要钉住】
// 这些数字是一轮轮抠出来的:籍贯 34.9% → 40.1% 靠改抽法,性格 42.8% → 43.8%
// 靠补词表,生平 95.7% → 96.0% 靠手写八条。而它们**掉下去不会有任何提示** ——
// 改一个正则、动一次源数据、删一条覆盖,少掉两百条档案照样全绿。
// `npm run audit-generals` 看得见,但盘点脚本要有人主动去跑。
//
// 钉的是**下限不是等值**:内容只会越补越多,涨了不该红。
// 下限比当前值留 1–2 个百分点的余量,免得源数据小幅波动就误报。
describe('档案覆盖率基线', () => {
  const G = COLLECTIBLE_CARDS.filter((c) => c.type === 'general')
  const merged = (id: string) => ({ ...LORE[id], ...LORE_OVERRIDES[id] })
  const rate = (has: (l: ReturnType<typeof merged>) => boolean) =>
    G.filter((c) => has(merged(c.id))).length / G.length

  const FLOORS: [string, (l: ReturnType<typeof merged>) => boolean, number][] = [
    ['生平', (l) => Boolean(l.bio?.zh), 0.94],
    ['表字', (l) => Boolean(l.courtesy?.zh), 0.51],
    ['籍贯', (l) => Boolean(l.home?.zh), 0.38],
    ['生卒年', (l) => Boolean(l.life?.zh), 0.48],
    ['五维', (l) => Boolean(l.stats), 0.95],
    ['性格', (l) => Boolean(l.traits?.length), 0.41],
    ['尊号', (l) => Boolean(l.era?.zh), 0.24],
    ['名言', (l) => Boolean(l.quote?.zh), 0.10],
    ['出战台词', (l) => Boolean(l.line?.zh), 0.12],
    ['结局', (l) => Boolean(l.fate?.zh), 0.11],
    ['著作', (l) => Boolean(l.works?.zh), 0.06],
    ['镇守地', (l) => Boolean(l.garrison?.zh), 0.08],
  ]

  for (const [name, has, floor] of FLOORS) {
    it(`${name}覆盖率不低于 ${(floor * 100).toFixed(0)}%`, () => {
      const r = rate(has)
      expect(r, `${name} 实测 ${(r * 100).toFixed(1)}%`).toBeGreaterThanOrEqual(floor)
    })
  }

  it('家族覆盖率不低于 18%', () => {
    const r = G.filter((c) => c.clan).length / G.length
    expect(r, `实测 ${(r * 100).toFixed(1)}%`).toBeGreaterThanOrEqual(0.18)
  })
})
