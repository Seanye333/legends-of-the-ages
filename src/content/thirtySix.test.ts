import { describe, expect, it } from 'vitest'
import { CARDS, CARDS_BY_ID } from './cards'
import { PACK18_CARDS } from './overrides/pack18'

// 三十六计:全中国人都叫得出的一套**完整**清单 —— 「完整收录」这句话要立得住,
// 就得有条闸门守着。少一计、或哪张被改名,这里立刻红。
export const THIRTY_SIX = [
  '瞞天過海', '圍魏救趙', '借刀殺人', '以逸待勞', '趁火打劫', '聲東擊西',
  '無中生有', '暗度陳倉', '隔岸觀火', '笑裡藏刀', '李代桃僵', '順手牽羊',
  '打草驚蛇', '借屍還魂', '調虎離山', '欲擒故縱', '拋磚引玉', '擒賊擒王',
  '釜底抽薪', '混水摸魚', '金蟬脫殼', '關門捉賊', '遠交近攻', '假道伐虢',
  '偷梁換柱', '指桑罵槐', '假痴不癲', '上屋抽梯', '樹上開花', '反客為主',
  '美人計', '空城計', '反間計', '苦肉計', '連環計', '走為上',
]

describe('三十六计', () => {
  it('三十六计全部收录,一计不缺', () => {
    const have = new Set(CARDS.map((c) => c.name.zh))
    const missing = THIRTY_SIX.filter((n) => !have.has(n))
    expect(missing, `缺 ${missing.length} 计`).toEqual([])
  })

  it('每一计都是锦囊(不是武将/装备重名)', () => {
    for (const n of THIRTY_SIX) {
      const hit = CARDS.find((c) => c.name.zh === n)!
      expect(hit.type, n).toBe('stratagem')
    }
  })

  it('第十八卡包:id 唯一、collectorNo 唯一、都带脚本', () => {
    const ids = PACK18_CARDS.map((c) => c.id)
    expect(new Set(ids).size).toBe(ids.length)
    const nos = PACK18_CARDS.map((c) => c.collectorNo)
    expect(new Set(nos).size).toBe(nos.length)
    for (const c of PACK18_CARDS) {
      expect(c.spell?.ops.length, c.id).toBeGreaterThan(0)
      expect(CARDS_BY_ID[c.id], c.id).toBeDefined()
    }
  })

  it('引用的衍生物真实存在且确为 token', () => {
    for (const c of PACK18_CARDS) {
      for (const op of c.spell?.ops ?? []) {
        if (op.op !== 'summon') continue
        const t = CARDS_BY_ID[op.defId]
        expect(t, `${c.id} → ${op.defId}`).toBeDefined()
        expect(t.token ?? false, op.defId).toBe(true)
      }
    }
  })
})
