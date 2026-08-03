import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { RELATION_EDGES } from '../content/generated/lore.gen'

// 关系类型是**三处手写清单**共用的一个词汇表:
//   1. 生成层的 REL_RULES(哪种写法算哪种关系)
//   2. CardInspect 的 REL_KIND(译名)—— 已经钉成 Record<RelEdge['kind'],…>,tsc 管得住
//   3. CardInspect.module.css 的 .rel_*(颜色)—— **CSS 没有类型**,漏了不报错,
//      表现是那一类关系变成默认色:不崩、不红,只是「这一类看起来和别的一样」
//
// 第 3 处就是这个文件存在的理由。顺带也验一遍:实际数据里出现的每一种
// kind 都在译名表里 —— 生成层加了一种而 UI 忘了补,界面上会渲染成 undefined。
const CSS = readFileSync(new URL('./components/CardInspect.module.css', import.meta.url), 'utf8')
const TSX = readFileSync(new URL('./components/CardInspect.tsx', import.meta.url), 'utf8')

const KINDS = [...new Set(RELATION_EDGES.map((e) => e.kind))].sort()

describe('史料关系的类型词汇表', () => {
  it('实际数据里的类型有规模 —— 关系网空了不能静默通过', () => {
    expect(RELATION_EDGES.length).toBeGreaterThan(2000)
    expect(KINDS.length).toBeGreaterThanOrEqual(5)
  })

  it('每一种关系都有译名', () => {
    const missing = KINDS.filter((k) => !new RegExp(`^\\s*${k}:\\s*\\{\\s*zh:`, 'm').test(TSX))
    expect(missing).toEqual([])
  })

  it('每一种关系都有自己的颜色 —— 少一条只会悄悄变成默认色', () => {
    const missing = KINDS.filter((k) => !CSS.includes(`.rel_${k}`))
    expect(missing).toEqual([])
  })

  it('闸门自检:检测器认得出「缺一条」', () => {
    const fake = '.rel_kin { color: #fff; }'
    expect(['kin', 'mentor'].filter((k) => !fake.includes(`.rel_${k}`))).toEqual(['mentor'])
  })
})
