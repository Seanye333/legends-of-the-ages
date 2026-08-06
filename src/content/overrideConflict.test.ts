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

  // ---------- 第二类指纹:卡面有这个机制,而文案一个字都没提 ----------
  //
  // 【为什么这是玩家能直接看见的错,不只是数据卫生】
  // `CardFace` 渲染的**只有 `def.text`** —— 这个仓库没有「从脚本生成描述」那一层。
  // 所以 text 就是玩家看到的全部。太史慈的战吼是「对随机一名敌将造成 3 点伤害」,
  // 而它的卡面只写着「碾壓。神射之勇,一往無前。」—— 打出去凭空多三点伤害。
  //
  // 这一类和上面那条同源:后一层覆盖重写了 `text`(或手写风味文案盖掉了生成文案),
  // 而**前一层留下的机制字段还在**。陳群 就是这么来的:pack8 重写了 text 只写战吼,
  // 没清 pack3 的 `aura`,于是它带着一个玩家看不见的全场光环 —— Δ +23.0,全池第二。
  //
  // 【为什么是名单而不是直接判红】
  // 现存 25 条。它们要一张一张补文案(照卡池里另外 1327 张战吼卡的写法),
  // 那是内容活,不是这次能顺手做完的。名单钉在这里的作用是**只减不增**:
  // 新写的卡再犯同一个错会当场红。补完一条就从名单里删一条,归零那天把名单删掉。
  const MECHANIC_WORDS: Record<string, string[]> = {
    // 光环有三种写法:直接叫「光環」、白话「你的其他武將…」、以及阵型卡的「陣型」
    aura: ['光環', '光环', '你的其他武將', '你的其他武将', '其他友方武將', '其他友方武将', '陣型', '阵型'],
    battlecry: ['戰吼', '战吼'],
    // 亡语有个风味别名「遺計」(郭嘉/陶謙/于吉),是有意为之,不算漏写
    deathrattle: ['亡語', '亡语', '遺計', '遗计'],
    combo: ['連擊', '连击'],
    choose: ['抉擇', '抉择'],
    secret: ['伏兵'],
  }

  // 已知待补的文案(`卡id:机制`)。**只减不增。**
  const KNOWN_TEXT_GAPS = new Set([
    'budugen:battlecry', 'du-yu:aura', 'du-yu:battlecry', 'gou-fu:battlecry',
    'hist-cao-can:battlecry', 'hist-cao-xueqin:deathrattle', 'hist-goujian:battlecry',
    'hist-jin-wen-gong:battlecry', 'hist-lanlingwang:battlecry', 'hist-lanlingwang:combo',
    'hist-li-guang:battlecry', 'hist-mu-guiying:aura', 'hist-murong-ke:battlecry',
    'hist-qin-mugong:battlecry', 'hist-wang-meng:battlecry', 'hist-xin-qiji:battlecry',
    'hist-zhang-xun:battlecry', 'hist-zheng-banqiao:battlecry', 'li-ru:battlecry',
    'ling-tong:battlecry', 'lu-kang:deathrattle', 'taishi-ci:battlecry',
    'tian-kai:deathrattle', 'wu-anguo:deathrattle', 'yang-hu:aura',
  ])

  it('卡面上有的机制,文案里必须提到(名单只减不增)', () => {
    const found: string[] = []
    for (const c of COLLECTIBLE_CARDS) {
      if (c.token) continue
      const t = c.text?.zh ?? ''
      const anyC = c as unknown as Record<string, unknown>
      for (const [field, words] of Object.entries(MECHANIC_WORDS)) {
        if (!anyC[field]) continue
        if (!words.some((w) => t.includes(w))) found.push(`${c.id}:${field}`)
      }
    }
    const added = found.filter((k) => !KNOWN_TEXT_GAPS.has(k)).sort()
    const fixed = [...KNOWN_TEXT_GAPS].filter((k) => !found.includes(k)).sort()
    expect(
      added,
      added.length
        ? `这些卡会做一件卡面上没写的事(CardFace 只渲染 def.text,没有从脚本生成描述那一层):\n` +
          `  ${added.join('\n  ')}\n\n` +
          `补一句文案,照卡池里其它同机制卡的写法。如果是覆盖层没清干净,` +
          `就去清掉那个字段(姜維/嵇康/陳群 都是那么来的)。`
        : undefined,
    ).toEqual([])
    // 补好了就把名单收窄 —— 否则这份名单会永远停在今天的样子
    expect(fixed, fixed.length ? `这几条已经补好了,请从 KNOWN_TEXT_GAPS 里删掉:\n  ${fixed.join('\n  ')}` : undefined).toEqual([])
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
