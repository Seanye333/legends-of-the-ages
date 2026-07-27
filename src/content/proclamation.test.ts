import { describe, expect, it } from 'vitest'
import { proclamation } from './proclamation'
import { COLLECTIBLE_CARDS } from './cards'
import { HEROES } from './overrides/heroes'

describe('战前檄文', () => {
  // 宿敌是最强的一档:机制上他们本来就互相加成,叙事上这是最该说的一句
  it('两人是宿敌时直接点出那一战', () => {
    const p = proclamation('zhuge-liang', 'sima-yi')!
    expect(p.zh).toContain('五丈原')
    expect(p.en).toContain('Wuzhang')
  })

  it('反过来也认得出 —— 檄文不该分先后手', () => {
    expect(proclamation('sima-yi', 'zhuge-liang')!.zh).toContain('五丈原')
  })

  it('同势力是同室操戈', () => {
    expect(proclamation('guan-yu', 'zhang-fei')!.zh).toContain('同室操戈')
  })

  it('跨时代把年代差直接说出来 —— 这是本作独有的场面', () => {
    const p = proclamation('cao-cao', 'hist-yue-fei')!
    expect(p.zh).toContain('隔世相逢')
    expect(p.zh).toContain('宋元')
  })

  // 踩过:LORE.era 存的是**称号**(「蜀汉昭烈帝」/「大贤良师」),不是年代。
  // 拿它比时代会把同为三国的刘备与张角判成「隔世相逢」。
  it('同一时代块的不同势力是同世之争,不是隔世相逢', () => {
    const p = proclamation('liu-bei', 'zhang-jiao')!
    expect(p.zh).toContain('同生於三國兩晉')
    expect(p.zh).not.toContain('隔世')
  })

  it('确定性:同样两个人永远同一句', () => {
    expect(proclamation('liu-bei', 'cao-cao')).toEqual(proclamation('liu-bei', 'cao-cao'))
  })

  it('不认识的 id 返回 null,不抛', () => {
    expect(proclamation('nobody', 'cao-cao')).toBeNull()
  })

  // 十二位可选主公两两对战都要有话说 —— 缺一对就是那个组合开局一片空白
  it('十二位主公的任意两两组合都出得来檄文', () => {
    for (const a of HEROES) {
      for (const b of HEROES) {
        if (a.id === b.id) continue
        expect(proclamation(a.id, b.id), `${a.id} vs ${b.id}`).not.toBeNull()
      }
    }
  })

  it('关底 Boss 也用武将卡 id,同样出得来', () => {
    const sample = COLLECTIBLE_CARDS.filter((c) => c.type === 'general').slice(0, 20)
    for (const c of sample) expect(proclamation('liu-bei', c.id)).not.toBeNull()
  })
})
