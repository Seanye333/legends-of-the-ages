import { describe, expect, it } from 'vitest'
import { SOUND_PARITY } from './soundParity'

// 这道闸门配合 `Record<SfxName, string>` 的穷尽性一起用:
// 类型保证「每个音效都填了一格」,这里保证「填的不是空话」。
describe('静音优先', () => {
  it('每个音效都声明了非听觉通道,且不是空的', () => {
    for (const [name, channel] of Object.entries(SOUND_PARITY)) {
      expect(channel.trim().length, `音效 ${name} 的视觉通道是空的`).toBeGreaterThan(6)
    }
  })

  it('通道描述不能是「没有」这类占位词', () => {
    // 填表的人偷懒时最容易写的就是这几个词。写了等于没写,不如让测试拦下来。
    const lazy = ['无', '没有', '暂无', 'n/a', 'none', 'todo']
    for (const [name, channel] of Object.entries(SOUND_PARITY)) {
      const low = channel.toLowerCase()
      for (const w of lazy) {
        expect(low.includes(w), `音效 ${name} 的视觉通道写了占位词「${w}」`).toBe(false)
      }
    }
  })
})
