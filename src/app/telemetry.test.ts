// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest'
import {
  clearDiagnostics,
  countMode,
  crashes,
  diagnosticsText,
  modeCounts,
  recordCrash,
} from './telemetry'

beforeEach(() => {
  localStorage.clear()
})

describe('本机埋点', () => {
  it('数得对,而且跨读取存活', () => {
    countMode('arena')
    countMode('arena')
    countMode('tower')
    expect(modeCounts()).toEqual({ arena: 2, tower: 1 })
  })

  // 埋点绝不能影响正常游戏:配额满 / 隐私模式下写入会抛,必须静默吞掉
  it('localStorage 写不进去时不抛', () => {
    const orig = Storage.prototype.setItem
    Storage.prototype.setItem = () => {
      throw new Error('QuotaExceededError')
    }
    expect(() => countMode('arena')).not.toThrow()
    Storage.prototype.setItem = orig
  })
})

describe('崩溃留档', () => {
  it('记下消息与栈,最新的在最前', () => {
    recordCrash(new Error('第一个'), 'MatchScreen')
    recordCrash(new Error('第二个'))
    const list = crashes()
    expect(list[0].message).toBe('第二个')
    expect(list[1].screen).toBe('MatchScreen')
  })

  it('只留最近 20 条 —— 一条 React 栈能有几十 KB', () => {
    for (let i = 0; i < 30; i++) recordCrash(new Error(`e${i}`))
    expect(crashes()).toHaveLength(20)
    expect(crashes()[0].message).toBe('e29')
  })

  it('非 Error 的抛出物也接得住', () => {
    recordCrash('字符串也能被 throw')
    expect(crashes()[0].message).toBe('字符串也能被 throw')
  })
})

describe('导出与清空', () => {
  it('导出的是纯文本,含模式计数与错误', () => {
    countMode('expedition')
    recordCrash(new Error('炸了'))
    const text = diagnosticsText()
    expect(text).toContain('expedition: 1')
    expect(text).toContain('炸了')
  })

  it('清空之后两边都空', () => {
    countMode('brawl')
    recordCrash(new Error('x'))
    clearDiagnostics()
    expect(modeCounts()).toEqual({})
    expect(crashes()).toEqual([])
  })
})
