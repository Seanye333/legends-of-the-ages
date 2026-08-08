import { describe, expect, it } from 'vitest'
import { battlesByEra, ERA_OF, type Era } from './eras'
import { CARDS_BY_ID, COLLECTIBLE_CARDS } from './cards'
import { BATTLE_EXCLUSIONS } from './overrides/battle-fixes'

// 战役按时代归组 —— 时代长卷上那一排小木牌。
//
// 【为什么用众数,而不是「第一个参战者的时代」】
// 一场仗的名单可能跨时代:合肥·逍遙津 的名单里混进了包拯与李鴻章 ——
// 生成层认的是「生平原文点到这四个字」,而「合肥」是个地名。
// 取第一个人的时代等于让排序决定归属;取众数才把这类噪声压掉。
//
// 【为什么平票取最早】
// 平票时随便挑一个,同一份数据两次渲染会给出不同的时代 —— 那种不确定
// 在界面上表现为「这场仗有时在先秦有时在秦汉」,而没人查得出为什么。
describe('战役按时代归组', () => {
  it('真卡池里六个时代都排得出仗来 —— 有一块是空的,长卷上就有一块没有木牌', () => {
    const out = battlesByEra(COLLECTIBLE_CARDS)
    for (const era of Object.keys(out) as Era[]) {
      expect(out[era].length, `${era} 一场仗都没有`).toBeGreaterThan(0)
    }
  })

  it('**按众数归属**,不是按第一个参战者', () => {
    // 三个三国的人 + 一个明清的人,那一仗该归三国
    const cards = [
      { battles: ['某役'], dynasty: 'ming' as const },
      { battles: ['某役'], dynasty: 'wei' as const },
      { battles: ['某役'], dynasty: 'shu' as const },
      { battles: ['某役'], dynasty: 'wu' as const },
    ]
    const out = battlesByEra(cards)
    expect(out['three-kingdoms'].map((b) => b.name)).toContain('某役')
    expect(out['ming-qing'].map((b) => b.name)).not.toContain('某役')
  })

  it('平票取最早 —— 否则同一份数据两次渲染可能给出不同的时代', () => {
    const cards = [
      { battles: ['平票役'], dynasty: 'ming' as const },
      { battles: ['平票役'], dynasty: 'wei' as const },
    ]
    const a = battlesByEra(cards)
    const b = battlesByEra([...cards].reverse())
    expect(a['three-kingdoms'].map((x) => x.name)).toEqual(['平票役'])
    expect(b['three-kingdoms'].map((x) => x.name)).toEqual(['平票役'])
  })

  it('人多的排前面,而且排序是全序 —— 同人数按名字定序', () => {
    const cards = [
      { battles: ['小'], dynasty: 'wei' as const },
      { battles: ['小'], dynasty: 'wei' as const },
      { battles: ['大'], dynasty: 'wei' as const },
      { battles: ['大'], dynasty: 'wei' as const },
      { battles: ['大'], dynasty: 'wei' as const },
    ]
    expect(battlesByEra(cards)['three-kingdoms'].map((b) => b.name)).toEqual(['大', '小'])
  })

  it('没有 battles 的卡不产生任何一场仗', () => {
    const out = battlesByEra([{ dynasty: 'wei' as const }])
    expect(Object.values(out).flat()).toEqual([])
  })

  it('每个朝代都映射得到时代 —— 漏一个,那批卡的仗会静默归错', () => {
    for (const c of COLLECTIBLE_CARDS) {
      expect(ERA_OF[c.dynasty], `${c.dynasty} 没有时代映射`).toBeDefined()
    }
  })
})

// 假匹配修正(overrides/battle-fixes.ts)。
//
// 这张表是**手查**的,而手查的表在这个仓库有一种烂法:数据换了一批,
// 表里的 id 全都对不上号,于是它一条也没排除掉 —— 而且不报错。
// 下面第一条守的就是这个:表里的每一对都得**真的曾经存在过**。
describe('战役假匹配修正', () => {
  it('**表里的每一条都真的排除掉了东西** —— 对不上号的表等于没有表', () => {
    for (const [battle, ids] of Object.entries(BATTLE_EXCLUSIONS)) {
      for (const id of ids) {
        const card = CARDS_BY_ID[id]
        expect(card, `${battle} 的排除项 ${id} 不在卡池里`).toBeDefined()
        expect(card.battles ?? [], `${id} 仍然挂着「${battle}」`).not.toContain(battle)
      }
      // 排除完之后那场仗不能整个消失 —— 那说明这条排除写过头了
      const left = COLLECTIBLE_CARDS.filter((c) => c.battles?.includes(battle))
      expect(left.length, `「${battle}」被排干净了`).toBeGreaterThan(0)
    }
  })

  it('该留的三条留住了 —— 众数清洗会删错的正是它们', () => {
    // 慕容垂 真的在淝水(前秦军中);于謙 是土木堡唯一对的那个;朱棣 打的是明初北征
    expect(CARDS_BY_ID['hist-murong-chui'].battles).toContain('淝水之戰')
    expect(CARDS_BY_ID['hist-yu-qian'].battles).toContain('土木堡之變')
    expect(CARDS_BY_ID['hist-yongle'].battles).toContain('漠北之戰')
  })

  it('六个时代都排得出仗 —— 明清那一块此前是空的,那正是这张表的由来', () => {
    const out = battlesByEra(COLLECTIBLE_CARDS)
    expect(out['ming-qing'].length).toBeGreaterThan(0)
  })
})
