import { describe, expect, it } from 'vitest'
import { toSimplified, variantKeys } from './zhVariant'

describe('繁 → 简', () => {
  it('多对一是安全的:發 与 髮 都作「发」', () => {
    expect(toSimplified('發')).toBe('发')
    expect(toSimplified('髮')).toBe('发')
    expect(toSimplified('隻')).toBe('只')
  })

  it('卡面规则词', () => {
    expect(toSimplified('戰吼:對一名敵將造成 3 點傷害')).toBe('战吼:对一名敌将造成 3 点伤害')
    expect(toSimplified('從牌庫抽一張武將牌')).toBe('从牌库抽一张武将牌')
    expect(toSimplified('亡語:召喚一個 1/1 的死士')).toBe('亡语:召唤一个 1/1 的死士')
  })

  it('表里没有的字原样透出 —— 失败模式是「没转」,不是「转错」', () => {
    // 冷僻人名用字多半繁简同形,不该被动到
    expect(toSimplified('荀彧')).toBe('荀彧')
    expect(toSimplified('ABC 123')).toBe('ABC 123')
  })

  it('已经是简体的文本过一遍是恒等的 —— 界面文案照样能走这条路', () => {
    for (const s of ['结束回合', '名将图鉴', '开始对战', '每日三题']) {
      expect(toSimplified(s)).toBe(s)
    }
  })

  it('表里没有把某个字映射成它自己以外的繁体', () => {
    // 值域必须全是「不再需要转换」的:转两遍应当和转一遍相同(幂等)
    for (const k of variantKeys()) {
      const once = toSimplified(k)
      expect(toSimplified(once), `${k} → ${once} 不是幂等的`).toBe(once)
    }
  })
})
