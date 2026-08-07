// cssOrder 的自检 —— 每条判据**两个方向**各验一遍。
//
// 这道闸门守的是「覆盖会不会静默失效」,而它自己失效同样是静默的:
// 判据写错了它就永远绿。所以这里刻意**不喂真产物** ——
// 今天的 dist 恰好顺序全对,拿它当样本只能证明「不该红时不红」,
// 证不了「该红时会红」。合成数据两边都能钉住。
import { describe, expect, it } from 'vitest'
import {
  checkChunkOrder,
  composeLinks,
  declaredNames,
  hashFor,
  keyframeNames,
  scopedSpans,
  type SourceModule,
} from './cssOrder'

describe('keyframeNames', () => {
  it('认出 @keyframes', () => {
    expect(keyframeNames('@keyframes pulse { from { opacity: 0 } }')).toEqual(['pulse'])
  })

  it('认出带前缀的', () => {
    expect(keyframeNames('@-webkit-keyframes spin { }')).toEqual(['spin'])
  })

  it('注释里的不算', () => {
    expect(keyframeNames('/* @keyframes old {} */ .a { color: red }')).toEqual([])
  })

  it('没有动画时是空的', () => {
    expect(keyframeNames('.a { color: red }')).toEqual([])
  })
})

describe('declaredNames', () => {
  it('类名和动画名都算进来', () => {
    // 不把动画名算进去,带动画的模块在 chunk 里就认不出来 —— 那是个静默跳过
    const css = '.wrap { animation: pulse 1s } @keyframes pulse { from { opacity: 0 } }'
    expect(declaredNames(css)).toEqual(['pulse', 'wrap'])
  })
})

describe('composeLinks', () => {
  it('抽出本地类 + 公共类 + 路径', () => {
    const css = `.backBtn { composes: backBtn from '../uiKit.module.css'; }`
    expect(composeLinks(css)).toEqual([
      { localClass: 'backBtn', kitClass: 'backBtn', kitFile: '../uiKit.module.css' },
    ])
  })

  it('本地名和公共名不同也认', () => {
    const css = `.progress { composes: headRight from '../uiKit.module.css'; }`
    expect(composeLinks(css)).toEqual([
      { localClass: 'progress', kitClass: 'headRight', kitFile: '../uiKit.module.css' },
    ])
  })

  it('一条 composes 引多个类', () => {
    const css = `.x { composes: btnGhost head from '../uiKit.module.css'; }`
    expect(composeLinks(css).map((l) => l.kitClass)).toEqual(['btnGhost', 'head'])
  })

  it('逗号选择器上的 composes 算在每个本地类上', () => {
    const css = `.a,\n.b { composes: btnGhost from './k.module.css'; }`
    expect(composeLinks(css).map((l) => l.localClass)).toEqual(['a', 'b'])
  })

  it('双引号路径也认', () => {
    const css = `.a { composes: k from "./k.module.css"; }`
    expect(composeLinks(css)).toHaveLength(1)
  })

  it('没有 composes 的块不产出关系', () => {
    expect(composeLinks('.a { color: red } .b { padding: 2px }')).toEqual([])
  })

  it('注释掉的 composes 不算', () => {
    expect(composeLinks(`.a { /* composes: k from './k.module.css'; */ color: red }`)).toEqual([])
  })

  it('非裸类选择器不当成一条关系', () => {
    // `.a .b` / `.a:hover` 上写 composes 本来就不合法,认它只会造出假关系
    const css = `.a .b { composes: k from './k.module.css'; }`
    expect(composeLinks(css)).toEqual([])
  })

  it('同一块里同时有 composes 和别的声明', () => {
    const css = `.plainBtn { composes: btnGhost from '../uiKit.module.css'; padding: 4px 11px; }`
    expect(composeLinks(css)).toEqual([
      { localClass: 'plainBtn', kitClass: 'btnGhost', kitFile: '../uiKit.module.css' },
    ])
  })
})

describe('scopedSpans', () => {
  it('按 hash 归堆并记首末偏移', () => {
    const css = '._a_zedng_1{color:red}._b_o3bay_2{color:blue}._a_zedng_9:hover{color:tan}'
    const spans = scopedSpans(css)
    expect([...spans.keys()].sort()).toEqual(['o3bay', 'zedng'])
    const a = spans.get('zedng')!.get('a')!
    expect(a.first).toBe(0)
    expect(a.last).toBeGreaterThan(a.first)
    expect(spans.get('o3bay')!.get('b')!.first).toBeGreaterThan(0)
  })

  it('本地名里带数字也切得对', () => {
    const spans = scopedSpans('._tier2_ab12c_7{color:red}')
    expect([...spans.get('ab12c')!.keys()]).toEqual(['tier2'])
  })

  it('没有作用域类名时是空的', () => {
    expect(scopedSpans('.plain{color:red}').size).toBe(0)
  })
})

describe('hashFor', () => {
  const spans = scopedSpans('._head_zedng_1{a:b}._backBtn_zedng_2{a:b}._grid_o3bay_3{a:b}')

  it('名字全出自这份文件就认它', () => {
    expect(hashFor(spans, new Set(['head', 'backBtn', 'title']))).toBe('zedng')
  })

  it('文件不在这一块里返回 null', () => {
    expect(hashFor(spans, new Set(['nothing', 'here']))).toBe(null)
  })

  it('同时像两个文件时不猜', () => {
    // 两个 hash 的名字都是这份文件的子集 —— 认哪个都是瞎猜
    expect(hashFor(spans, new Set(['head', 'backBtn', 'grid']))).toBe('ambiguous')
  })
})

// ---- 判定本体 ----

const KIT: SourceModule = {
  file: 'src/ui/uiKit.module.css',
  names: ['head', 'backBtn', 'title', 'btnGhost'],
  links: [],
}
const SCREEN: SourceModule = {
  file: 'src/ui/screens/PracticeScreen.module.css',
  names: ['screen', 'plainBtn', 'grid'],
  links: [{ localClass: 'plainBtn', kitClass: 'btnGhost', kitFile: '../uiKit.module.css' }],
}
const MODS = [KIT, SCREEN]

/** 公共块在前 —— 今天打包器就是这么排的 */
const GOOD =
  '._head_zedng_1{a:b}._btnGhost_zedng_2{padding:9px 16px}' +
  '._screen_o3bay_1{a:b}._plainBtn_o3bay_2{padding:4px 11px}'

/** 公共块在后 —— 覆盖会全部失效 */
const BAD =
  '._screen_o3bay_1{a:b}._plainBtn_o3bay_2{padding:4px 11px}' +
  '._head_zedng_1{a:b}._btnGhost_zedng_2{padding:9px 16px}'

describe('checkChunkOrder', () => {
  it('公共块排在前面 —— 不报', () => {
    const v = checkChunkOrder([{ file: 'a.css', css: GOOD }], MODS)
    expect(v.issues).toEqual([])
    expect(v.checked).toBe(1)
    expect(v.chunksWithLinks).toBe(1)
  })

  it('公共块排在后面 —— 必须报 order', () => {
    const v = checkChunkOrder([{ file: 'a.css', css: BAD }], MODS)
    expect(v.issues).toHaveLength(1)
    expect(v.issues[0].kind).toBe('order')
    expect(v.issues[0].localClass).toBe('plainBtn')
    expect(v.issues[0].kitClass).toBe('btnGhost')
    expect(v.issues[0].chunk).toBe('a.css')
  })

  it('公共类的**末条**规则也要在前面', () => {
    // uiKit 的 :hover 落在本地规则之后一样会盖掉 —— 只看首条会漏掉这种
    const css =
      '._btnGhost_zedng_2{padding:9px 16px}' +
      '._screen_o3bay_1{a:b}._plainBtn_o3bay_2{padding:4px 11px}' +
      '._btnGhost_zedng_9:hover{padding:9px 16px}'
    const v = checkChunkOrder([{ file: 'a.css', css }], MODS)
    expect(v.issues.map((i) => i.kind)).toEqual(['order'])
  })

  it('公共类在产物里没了 —— 报 missing-kit', () => {
    const css = '._head_zedng_1{a:b}._screen_o3bay_1{a:b}._plainBtn_o3bay_2{padding:4px}'
    const v = checkChunkOrder([{ file: 'a.css', css }], MODS)
    expect(v.issues.map((i) => i.kind)).toEqual(['missing-kit'])
  })

  it('模块不在这一块里 —— 跳过,不报也不算数', () => {
    const v = checkChunkOrder([{ file: 'a.css', css: '._foo_11dst_1{a:b}' }], MODS)
    expect(v.issues).toEqual([])
    expect(v.checked).toBe(0)
    expect(v.chunksWithLinks).toBe(0)
  })

  it('本地规则被压没了 —— 跳过(只剩 composes、没有自己的声明)', () => {
    const css = '._head_zedng_1{a:b}._btnGhost_zedng_2{a:b}._screen_o3bay_1{a:b}'
    const v = checkChunkOrder([{ file: 'a.css', css }], MODS)
    expect(v.issues).toEqual([])
    expect(v.checked).toBe(0)
  })

  it('认不出是谁的时候报 ambiguous,而不是挑一个', () => {
    // 两个 hash 的名字都是 SCREEN 声明集合的子集
    const css = '._grid_zzzzz_1{a:b}._screen_o3bay_1{a:b}._plainBtn_o3bay_2{a:b}'
    const v = checkChunkOrder([{ file: 'a.css', css }], MODS)
    expect(v.issues.map((i) => i.kind)).toEqual(['ambiguous'])
  })

  it('同一份文件内部的 composes 不看顺序', () => {
    const self: SourceModule = {
      file: 'src/ui/x.module.css',
      names: ['a', 'b'],
      links: [{ localClass: 'b', kitClass: 'a', kitFile: './x.module.css' }],
    }
    const v = checkChunkOrder([{ file: 'a.css', css: '._b_q1w2e_1{a:b}._a_q1w2e_2{a:b}' }], [self])
    expect(v.issues).toEqual([])
    expect(v.checked).toBe(0)
  })

  it('多个 chunk 里只有一块排错 —— 精确指出是哪一块', () => {
    const v = checkChunkOrder(
      [
        { file: 'ok.css', css: GOOD },
        { file: 'broken.css', css: BAD },
      ],
      MODS,
    )
    expect(v.issues.map((i) => i.chunk)).toEqual(['broken.css'])
    expect(v.checked).toBe(2)
    expect(v.chunksWithLinks).toBe(2)
  })
})
