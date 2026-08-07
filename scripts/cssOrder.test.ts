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
    const css =
      '._a_zedng_1{color:red}._b_o3bay_2{color:blue}@media (min-width:900px){._a_zedng_1{color:tan}}'
    const spans = scopedSpans(css)
    expect([...spans.keys()].sort()).toEqual(['o3bay', 'zedng'])
    const a = spans.get('zedng')!.get('a')!
    expect(a.first).toBe(0)
    expect(a.last).toBeGreaterThan(a.first)
    expect(spans.get('o3bay')!.get('b')!.first).toBeGreaterThan(0)
  })

  it('记下每个类设过的属性', () => {
    const spans = scopedSpans('._a_zedng_1{padding:4px;color:red}')
    expect([...spans.get('zedng')!.get('a')!.props].sort()).toEqual(['color', 'padding'])
  })

  it('**带伪类的规则一概不算** —— 它特异度更高,顺序左右不了它', () => {
    // `.btnChip:hover` 是 (0,2,0),本地的 `.kindBtn` 是 (0,1,0),前者永远赢。
    // 把它算进来只会报出一堆根本不会发生的「危险」。
    const spans = scopedSpans('._a_zedng_1{color:red}._a_zedng_1:hover{padding:9px}')
    const a = spans.get('zedng')!.get('a')!
    expect([...a.props]).toEqual(['color'])
    expect(a.last).toBe(a.first)
  })

  it('后代选择器整条不算 —— 也不许把它当成一个「类名」', () => {
    // 踩过:本地名用 `.+?` 匹配时,`._a_zedng_1:hover ._b_zedng_2` 会被
    // 整段吞成一个本地名,于是这个 hash 名下多出源文件里没有的名字,
    // 连锁反应是整个模块认不出来、**静默跳过**。
    const spans = scopedSpans('._a_zedng_1{color:red}._a_zedng_1:hover ._b_zedng_2{color:tan}')
    expect([...spans.get('zedng')!.keys()]).toEqual(['a'])
  })

  it('逗号选择器里的每个类都记上', () => {
    const spans = scopedSpans('._a_zedng_1,._b_zedng_2{color:red}')
    expect([...spans.get('zedng')!.keys()].sort()).toEqual(['a', 'b'])
  })

  it('url() 里的分号不当成声明分隔符', () => {
    const spans = scopedSpans('._a_zedng_1{background:url(data:image/svg+xml;base64,AAA);color:red}')
    expect([...spans.get('zedng')!.get('a')!.props].sort()).toEqual(['background', 'color'])
  })

  it('空规则不产出', () => {
    expect(scopedSpans('._a_zedng_1{}').size).toBe(0)
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

  it('两个候选覆盖数不同时取覆盖多的那个', () => {
    // 真实踩到的一次:ScreenFallback 只声明 {screen, seal},而 TitleScreen 声明 64 个
    // 且正好包含这两个 —— 找 TitleScreen 时,小文件那个 hash 也过了子集这一层。
    const s = scopedSpans('._screen_aaaaa_1{a:b}._seal_aaaaa_2{a:b}._screen_bbbbb_1{a:b}._seal_bbbbb_2{a:b}._masthead_bbbbb_3{a:b}')
    expect(hashFor(s, new Set(['screen', 'seal', 'masthead', 'tagline']))).toBe('bbbbb')
    // 反过来找小文件时,大文件那个 hash 根本过不了子集这一层
    expect(hashFor(s, new Set(['screen', 'seal']))).toBe('aaaaa')
  })

  it('覆盖数并列时才不猜', () => {
    // 两个 hash 的名字都是这份文件的子集,**而且一样多** —— 认哪个都是瞎猜
    const s = scopedSpans('._head_aaaaa_1{a:b}._backBtn_aaaaa_2{a:b}._grid_bbbbb_1{a:b}._gap_bbbbb_2{a:b}')
    expect(hashFor(s, new Set(['head', 'backBtn', 'grid', 'gap']))).toBe('ambiguous')
  })

  it('候选更少的一个不会把结果拖成 ambiguous', () => {
    // 这里 zedng 覆盖 2 个、o3bay 覆盖 1 个 —— 不是并列,取 zedng
    expect(hashFor(spans, new Set(['head', 'backBtn', 'grid']))).toBe('zedng')
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
    // 媒体查询里那条落在本地规则之后一样会盖掉 —— 只看首条会漏掉这种
    const css =
      '._btnGhost_zedng_2{padding:9px 16px}' +
      '._screen_o3bay_1{a:b}._plainBtn_o3bay_2{padding:4px 11px}' +
      '@media (min-width:900px){._btnGhost_zedng_2{padding:12px}}'
    const v = checkChunkOrder([{ file: 'a.css', css }], MODS)
    expect(v.issues.map((i) => i.kind)).toEqual(['order'])
  })

  it('顺序反了但**两边没设同一个属性** —— 不报错,但要单独记下来', () => {
    // 真实情形:各屏 composes 基件之后往往只加基件没管的那几条(尺寸、字号)。
    // 这时谁先谁后不影响任何一个像素,报成错只是噪声 ——
    // 但它是个**隐雷**(谁以后加一条同属性的覆盖就会静默失效),不能完全看不见。
    const css =
      '._screen_o3bay_1{a:b}._plainBtn_o3bay_2{font-size:12px}' +
      '._btnGhost_zedng_2{padding:9px 16px}'
    const v = checkChunkOrder([{ file: 'a.css', css }], MODS)
    expect(v.issues).toEqual([])
    expect(v.checked).toBe(1) // 比对过了,只是没问题
    expect(v.inverted).toEqual([{ chunk: 'a.css', localClass: 'plainBtn', kitClass: 'btnGhost' }])
  })

  it('顺序正的时候 inverted 是空的', () => {
    expect(checkChunkOrder([{ file: 'a.css', css: GOOD }], MODS).inverted).toEqual([])
  })

  it('报出来的时候要点名是哪几个属性撞了', () => {
    const v = checkChunkOrder([{ file: 'a.css', css: BAD }], MODS)
    expect(v.issues[0].msg).toContain('padding')
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
    // 两个 hash 的名字都是 SCREEN 声明集合的子集,而且**一样多**
    const css = '._grid_zzzzz_1{a:b}._screen_zzzzz_2{a:b}._screen_o3bay_1{a:b}._plainBtn_o3bay_2{a:b}'
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
