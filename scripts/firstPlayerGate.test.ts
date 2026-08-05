import { describe, expect, it } from 'vitest'
import { judgeFirstPlayer } from './firstPlayerGate'

// 闸门自检:该红时红、不该红时不红。样板见 campaignGate.test.ts。
//
// 这道闸门的特殊之处:它量的是**对称配置**,所以「正确答案」是已知的 50%,
// 不需要任何设计判断就能验证。也正因如此它同时是所有对镜类模拟的仪器自检。
describe('先手优势闸门', () => {
  it('对称(50% 附近)不许红', () => {
    expect(judgeFirstPlayer([50, 49, 51, 50.5, 49.5, 50], 400).problems).toEqual([])
  })

  it('轻微先手优势(52% 左右)可以接受 —— 卡牌游戏普遍如此', () => {
    expect(judgeFirstPlayer([52, 51, 53, 52, 51.5, 52.5], 400).problems).toEqual([])
  })

  it('2026-08-04 实测的那一组必须红', () => {
    // 自我对镜先手 71–76% —— 而当时没有任何一道现有闸门是红的
    const v = judgeFirstPlayer([71, 75.5, 75, 72, 75, 73], 400)
    expect(v.problems).toHaveLength(1)
    expect(v.problems[0]).toMatch(/后手补偿不足/)
  })

  it('补偿过头(后手反而占优)也要红', () => {
    const v = judgeFirstPlayer([38, 36, 39, 37, 38, 36], 400)
    expect(v.problems).toHaveLength(1)
    expect(v.problems[0]).toMatch(/补偿过头/)
  })

  it('样本太小就不该乱下结论', () => {
    // 12 局/套、合计 72 局时标准误约 5.8pp,58% 离 55% 只有 0.5 个标准误
    expect(judgeFirstPlayer([58, 58, 58, 58, 58, 58], 12).problems).toEqual([])
    // 同样的点估计,样本足够时就是显著的
    expect(judgeFirstPlayer([58, 58, 58, 58, 58, 58], 400).problems).toHaveLength(1)
  })

  it('各套之间差异过大时要在解读里点出来', () => {
    // 一套 52 一套 68:先手优势与卡组构筑耦合
    const v = judgeFirstPlayer([52, 68, 55, 60, 53, 66], 400)
    expect(v.report.join('\n')).toMatch(/与卡组构筑耦合/)
  })

  it('空输入不炸', () => {
    expect(() => judgeFirstPlayer([], 400)).not.toThrow()
  })
})
