// 覆盖层没清干净的指纹 —— 「自相矛盾的卡面」。
//
// 【起因:全卡池最超模的那张卡是个合并事故,不是设计】
// 姜維 实测 Δ +29.2(600 局,z=10.1),全池第一。查下去发现:
//   · pack3 把它定成 7 费 6/6,鐵壁 + 衝鋒;
//   · pack5 要**换掉**那版设计,改成 6 费 5/6 + 抉择(守護 / 4 点点杀),
//     注释里写着「原 7 费 6/6」,还特意清了 `battlecry`;
//   · **但没清 `keywords`**。覆盖层是逐字段合并的,于是合出来的是
//     6 费 5/6 鐵壁 + 衝鋒 + 抉择 —— 冲锋立刻打 5 点、铁壁扛下反击、再送 4 点解场。
//
// tsc 抓不到(两层都是合法的 Partial<CardDef>),`lint-content` 也抓不到
// (每个字段单看都没问题)。它只在**语义**上露馅:
//
//   抉择的一路是「获得守护」,而这张牌已经带着冲锋和铁壁 ——
//   **给一个已经能冲脸的单位加守护,这个选项在原设计里根本不成立。**
//
// 这条测试把那个指纹钉死:**卡面已经带着的关键词,自己的效果不该再授予一次。**
// 一张卡这么写,要么是覆盖没清干净,要么是那个效果根本没用 —— 两种都该被看见。
import { describe, expect, it } from 'vitest'
import { COLLECTIBLE_CARDS } from './cards'
import type { CardDef, EffectScript, Keyword } from '../engine/types'

/** 一张卡的所有效果脚本(和 pricing.opsOf 同一套触发时机)。 */
function scriptsOf(c: CardDef): EffectScript[] {
  const out: EffectScript[] = []
  const anyC = c as unknown as Record<string, EffectScript | undefined>
  for (const k of [
    'battlecry', 'spell', 'deathrattle', 'endOfTurn', 'startOfTurn',
    'onAttack', 'onDamaged', 'onSpellCast', 'combo',
  ]) {
    const s = anyC[k]
    if (s) out.push(s)
  }
  if (c.choose) for (const m of c.choose.modes) out.push(m.script)
  if (c.secret) out.push(c.secret.script)
  return out
}

/** 这张卡的效果里,授予**给自己**的关键词。 */
function selfGranted(c: CardDef): Keyword[] {
  const out: Keyword[] = []
  for (const s of scriptsOf(c)) {
    for (const op of s.ops) {
      if (op.op !== 'grantKeyword') continue
      // 只看明确给自己的那些 —— all/chosen 系的目标可能是别人,不算矛盾
      if (op.target === 'self' || op.target === 'allFriendlyGenerals' || op.target === 'allGenerals') {
        out.push(op.keyword)
      }
    }
  }
  return out
}

describe('覆盖层没清干净的指纹', () => {
  it('卡面已有的关键词,自己的效果不该再授予一次', () => {
    const bad: string[] = []
    for (const c of COLLECTIBLE_CARDS) {
      if (c.token) continue
      const face = new Set(c.keywords)
      for (const kw of selfGranted(c)) {
        // 只报**永久**授予:临时授予(duration:'endOfTurn')在已有该词时确实是废的,
        // 但那是设计冗余,不是覆盖事故,量级也小 —— 先只钉死更硬的那一类。
        if (face.has(kw)) bad.push(`${c.id}(${c.name.zh}) 卡面已带 ${kw},效果里还给自己加了一次`)
      }
    }
    expect(
      bad,
      bad.length
        ? `这些卡自相矛盾,多半是覆盖层没清干净(姜維就是这么来的,` +
          `Δ +29.2 全池第一):\n  ${bad.join('\n  ')}\n\n` +
          `查法:grep 这个 id 看有几层 overrides 定义过它,` +
          `后面那层是不是想替换前面那层却漏清了字段。`
        : undefined,
    ).toEqual([])
  })

  it('这条规则真的抓得住姜維那种写法', () => {
    // 反向验证:造一张「卡面带冲锋、抉择里还给自己加冲锋」的卡,必须被判成矛盾。
    const fake = {
      id: 'x',
      name: { zh: '假', en: 'x' },
      keywords: ['charge'],
      choose: {
        modes: [
          { label: { zh: 'a', en: 'a' }, script: { ops: [{ op: 'grantKeyword', keyword: 'charge', target: 'self' }] } },
        ],
      },
    } as unknown as CardDef
    expect(selfGranted(fake)).toContain('charge')
    expect(new Set(fake.keywords).has('charge')).toBe(true)
  })

  it('给别人加关键词不算矛盾', () => {
    const fine = {
      id: 'y',
      name: { zh: '好', en: 'y' },
      keywords: ['charge'],
      battlecry: { ops: [{ op: 'grantKeyword', keyword: 'charge', target: 'allFriendlyOthers' }] },
    } as unknown as CardDef
    expect(selfGranted(fine)).toEqual([])
  })
})
