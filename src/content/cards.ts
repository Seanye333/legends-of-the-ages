import type { CardDef, CardLibrary, Keyword, LocalizedText } from '../engine/types'
import { CLAN_ATTACK, CLAN_HEALTH } from '../engine/types'
import { GENERATED_CARDS } from './generated/cards.gen'
import { SIGNATURE_OVERRIDES } from './overrides/signature'
import { SIGNATURE_SKILLS } from './overrides/signature-skills'
import { STRATAGEMS } from './overrides/stratagems'
import { PACK2_CARDS } from './overrides/pack2'
import { PACK3_CARDS, PACK3_OVERRIDES } from './overrides/pack3'
import { PACK4_CARDS, PACK4_OVERRIDES } from './overrides/pack4'
import { PACK5_CARDS, PACK5_OVERRIDES } from './overrides/pack5'
import {
  PACK6_TOKENS,
  PACK6_DYNASTY_CARDS,
  PACK6_DYNASTY_OVERRIDES,
} from './overrides/pack6-dynasty'
import { PACK6_DOCTRINE_CARDS, PACK6_DOCTRINE_OVERRIDES } from './overrides/pack6-doctrine'
import { PACK6_LEGEND_OVERRIDES } from './overrides/pack6-legends'
import { PACK7_TOKENS, PACK7_CARDS, PACK7_OVERRIDES } from './overrides/pack7'
import { PACK8_TOKENS, PACK8_CARDS, PACK8_OVERRIDES } from './overrides/pack8'
import { FLAVOR_OVERRIDES } from './overrides/flavor'
import { PACK9_CARDS, PACK9_OVERRIDES } from './overrides/pack9-neutral'
import { PACK10_CARDS, PACK10_OVERRIDES } from './overrides/pack10'
import { PACK11_CARDS, PACK11_OVERRIDES } from './overrides/pack11'
import { PACK12_CARDS, PACK12_OVERRIDES } from './overrides/pack12'
import { PACK13_CARDS, PACK13_OVERRIDES } from './overrides/pack13'
import { TUNING1_OVERRIDES } from './overrides/tuning1'
import { PACK14_CARDS } from './overrides/pack14'
import { PACK15_CARDS } from './overrides/pack15'
import { PACK16_CARDS } from './overrides/pack16'
import { PACK17_CARDS } from './overrides/pack17'
import { BOND_OVERRIDES } from './overrides/bonds'
import { RIVAL_OVERRIDES } from './overrides/rivals'
import { TITLE_OVERRIDES } from './overrides/titles'
import { deriveTroop } from './troops'
import { PACK18_CARDS } from './overrides/pack18'
import { PACK19_CARDS, PACK19_TROOP_PINS, LESSON_STAT_PINS } from './overrides/pack19'
import { PACK20_CARDS } from './overrides/pack20'
import { PACK21_CARDS } from './overrides/pack21'
import { PACK22_CARDS } from './overrides/pack22'
import { PACK23_CARDS } from './overrides/pack23'
import { PACK24_CARDS, PACK24_OVERRIDES } from './overrides/pack24'
import { PACK25_CARDS, PACK25_TOKENS } from './overrides/pack25'
import { PACK26_CARDS } from './overrides/pack26'
import { CAMPAIGN_TOKENS } from './overrides/campaign-tokens'
import { HISTORY_TOKENS } from './history-tokens'

// 抉择 ⊥ 战吼/锦囊/连击 —— reducer 的脚本优先级依赖这条互斥(见 content.test 那两条闸门)。
//
// 覆盖是**浅合并**,于是两层可以各出一半:生成层播了 `choose`、手写层给了 `combo`,
// 合并完两个都在,互斥就破了。真出过 —— 荆轲(播 choose + 手写 combo)、
// 钟会(手写 choose + 播 battlecry)。
//
// 判给手写层:签名卡的效果与定价是手调出来的,生成层那一半必须让位。
// 只清互斥组这三个字段,不动其余覆盖语义(有些卡包就是刻意在生成效果之上叠光环的)。
function reconcileExclusive(merged: CardDef, ov: Partial<CardDef>): CardDef {
  const drop = (card: CardDef, fields: (keyof CardDef)[]): CardDef => {
    const out = { ...card }
    for (const f of fields) delete out[f]
    return out
  }
  if (ov.choose) return drop(merged, ['battlecry', 'spell', 'combo'])
  if ((ov.battlecry || ov.spell || ov.combo) && merged.choose) return drop(merged, ['choose'])
  return merged
}

// 卡面文本 = 关键词 + 效果 + 风味,是个**合成串**;而覆盖是整段替换 `text`。
// 于是靠后的层一改文案,靠前的层给的关键词就从卡面上消失了 —— 关键词还在,只是没人看得见:
//   · 張郃 —— pack3 给「鐵壁」并写进文本,pack6 换成冲锋流文案,鐵壁 从卡面蒸发;
//   · 秦穆公 / 曹參 / 王猛 —— flavor.ts 用纯风味句覆盖,守護/突襲 一起没了。
// 这是**合并层**的毛病,不是哪个文件写错了:没有哪一层有义务知道别层加了什么关键词。
//
// 所以在合并之后重新补一遍关键词前缀 —— 最终卡面带哪些关键词,文本开头就写哪些。
// 幂等(已写过就不再写),顺序跟 Keyword 声明序,读起来稳定。
// 导出:content.test 此前**另抄了一份**同样的表。抄本在这次把「連擊」
// 改名成「風怒」时没跟着改 —— 于是闸门报出三张卡「带 windfury 但文本里
// 没有連擊」,而真相是抄本过期了。一张表只该有一个来源。
// 类型是 `Record<Keyword,…>` 而不是 `Record<string,…>`:后者漏一个**不报错**,
// 只是那个词条从此在卡面上消失(缴械/攻城差点就这么漏掉)。让 tsc 管住它。
export const KEYWORD_LABEL: Record<Keyword, { zh: string; en: string }> = {
  charge: { zh: '衝鋒', en: 'Charge' },
  rush: { zh: '突襲', en: 'Rush' },
  guard: { zh: '守護', en: 'Guard' },
  windfury: { zh: '風怒', en: 'Windfury' },
  duel: { zh: '單挑', en: 'Duel' },
  lifesteal: { zh: '吸血', en: 'Lifesteal' },
  poison: { zh: '劇毒', en: 'Poisonous' },
  divineShield: { zh: '鐵壁', en: 'Divine Shield' },
  stealth: { zh: '潛行', en: 'Stealth' },
  trample: { zh: '碾壓', en: 'Trample' },
  disarm: { zh: '繳械', en: 'Disarm' },
  siege: { zh: '攻城', en: 'Siege' },
}

/**
 * 风味文案**追加**在规则说明后面,而不是替换掉它。
 *
 * 见 MERGED_CARDS 里那段注释:`FLAVOR_OVERRIDES` 只有 `text` 一个字段,
 * 走普通 spread 的话「补一句风味」= 「删掉规则说明」。
 *
 * 幂等:已经含有那句风味就不再追加(卡池在测试里会被反复构造)。
 */
function withFlavorText(card: CardDef, flavor: Pick<CardDef, 'text'> | undefined): CardDef {
  if (!flavor?.text) return card
  const zh = card.text?.zh ?? ''
  const en = card.text?.en ?? ''
  if (zh.includes(flavor.text.zh)) return card
  return {
    ...card,
    text: {
      zh: `${zh}${flavor.text.zh}`,
      en: [en, flavor.text.en].filter(Boolean).join(' '),
    },
  }
}

function withKeywordText(card: CardDef): CardDef {
  if (card.keywords.length === 0) return card
  const zh = card.text?.zh ?? ''
  const en = card.text?.en ?? ''
  const missing = card.keywords.filter((k) => KEYWORD_LABEL[k] && !zh.includes(KEYWORD_LABEL[k].zh))
  if (missing.length === 0) return card
  return {
    ...card,
    text: {
      zh: `${missing.map((k) => `${KEYWORD_LABEL[k].zh}。`).join('')}${zh}`,
      en: `${missing.map((k) => `${KEYWORD_LABEL[k].en}.`).join(' ')}${en ? ` ${en}` : ''}`,
    },
  }
}

// 羁绊与宿敌**在卡面上是隐形的** —— 它们不是关键词,也没有哪一层覆盖会去写文案。
// 上线时 31 条羁绊全都只在结算里生效,玩家从卡面上一个字都看不到;
// 而这两条机制的全部意义就是「让人看见历史关系」,看不见等于没做。
//
// 所以在合并之后统一补一段。和 withKeywordText 同一个思路:
// **补在合并处**,而不是要求每张覆盖表自己写 —— 覆盖是整段替换 text,
// 谁后写谁就会把前面那层的说明抹掉(memory: override-merge-hazards)。
//
// 成员名要查全卡池,所以这一步必须在数组建好之后跑,不能塞进 map 链的前面。
function statText(attack: number, health: number): { zh: string; en: string } {
  if (attack !== 0 && health !== 0) return { zh: `+${attack}/+${health}`, en: `+${attack}/+${health}` }
  if (health === 0) return { zh: `+${attack} 攻擊`, en: `+${attack} Attack` }
  return { zh: `+${health} 生命`, en: `+${health} Health` }
}

function withBondRivalText(card: CardDef, nameOf: Record<string, LocalizedText>): CardDef {
  const lines: { zh: string; en: string }[] = []
  const label = (id: string, lang: 'zh' | 'en') => nameOf[id]?.[lang] ?? id
  if (card.bond) {
    const b = card.bond
    const s = statText(b.attack, b.health)
    lines.push({
      zh: `羈絆 · ${b.name.zh}:與${b.members.map((m) => label(m, 'zh')).join('、')}同時在場時,各 ${s.zh}。`,
      en: `Bond · ${b.name.en}: while ${b.members.map((m) => label(m, 'en')).join(' and ')} are also on the field, each gains ${s.en}.`,
    })
  }
  if (card.rival) {
    const r = card.rival
    const s = statText(r.attack, r.health)
    lines.push({
      zh: `宿敵 · ${r.name.zh}:敵方場上有${label(r.foe, 'zh')}時,雙方各 ${s.zh}。`,
      en: `Rival · ${r.name.en}: while ${label(r.foe, 'en')} is on the enemy field, both gain ${s.en}.`,
    })
  }
  // 家族没有锚点,文案里也就不点名成员(曹氏 27 人,列出来没人读)。
  // 但**必须写清族人数**:同姓不等于同族(張遼不是張飛的族人),
  // 玩家只有看见「27 人」才会去点开看名单,而不是照着姓氏猜。
  if (card.clan) {
    const c = card.clan
    const s = statText(CLAN_ATTACK, CLAN_HEALTH)
    lines.push({
      zh: `家族 · ${c.name.zh}(${c.size} 人):另有族人在場時,同族各 ${s.zh}。`,
      en: `Clan · ${c.name.en} (${c.size}): while a kinsman is also on your field, each member gains ${s.en}.`,
    })
  }
  if (lines.length === 0) return card
  const zh = card.text?.zh ?? ''
  const en = card.text?.en ?? ''
  // 幂等:已经补过就不再补(卡池在测试里会被反复构造)
  const fresh = lines.filter((l) => !zh.includes(l.zh))
  if (fresh.length === 0) return card
  return {
    ...card,
    text: {
      zh: [zh, ...fresh.map((l) => l.zh)].filter(Boolean).join(''),
      en: [en, ...fresh.map((l) => l.en)].filter(Boolean).join(' '),
    },
  }
}

/**
 * 调平层 —— 数值,不是内容(见 overrides/tuning1.ts)。
 *
 * 【为什么挂在**全池**这一层,而不是上面那个合并循环里】
 * 那个循环只跑 `GENERATED_CARDS`。`packN` 里**直接定义**的卡
 * (`PACK21_CARDS` 之类)是后面整段拼进来的,**根本不经过它** ——
 * 调平层写在循环里的话,对这些卡完全无效,而且无声无息:
 * 类型是对的、lint 是绿的、快照也不会红(因为它压根没变)。
 * 实测踩到:十一张里有两张(神機營 / 候時而動)就是这样,一开始只生效了九张。
 *
 * 挂在这里之后它对**每一张**卡都说了算,不管那张卡是怎么进池的。
 */
function applyTuning(card: CardDef): CardDef {
  const tn = TUNING1_OVERRIDES[card.id]
  if (!tn) return card
  return reconcileExclusive({ ...card, ...tn }, tn)
}

/**
 * 第二十四卡包给**已有的四张卡**加条件(見 overrides/pack24.ts 尾部)。
 * 和调平层同一个理由挂在全池这一层:那四张是 `STRATAGEMS` 里直接定义的,
 * 根本不经过上面那个只跑生成层的合并循环。
 */
function applyPack24(card: CardDef): CardDef {
  const ov = PACK24_OVERRIDES[card.id]
  if (!ov) return card
  return reconcileExclusive({ ...card, ...ov }, ov)
}

// 全卡池 = (生成默认值 ⊕ 各卡包覆盖) + 手工锦囊 + 第二~六卡包
// 覆盖顺序:后者赢。各覆盖表刻意不与签名集重叠(只挑签名之外的花名册)。
const MERGED_CARDS: CardDef[] = [
  ...GENERATED_CARDS.map((card) => {
    const fl = FLAVOR_OVERRIDES[card.id]
    const sig = SIGNATURE_OVERRIDES[card.id]
    const sk = SIGNATURE_SKILLS[card.id]
    const p3 = PACK3_OVERRIDES[card.id]
    const p4 = PACK4_OVERRIDES[card.id]
    const p5 = PACK5_OVERRIDES[card.id]
    const p6d = PACK6_DYNASTY_OVERRIDES[card.id]
    const p6c = PACK6_DOCTRINE_OVERRIDES[card.id]
    const p6l = PACK6_LEGEND_OVERRIDES[card.id]
    const p7 = PACK7_OVERRIDES[card.id]
    const p8 = PACK8_OVERRIDES[card.id]
    const p9 = PACK9_OVERRIDES[card.id]
    const p10 = PACK10_OVERRIDES[card.id]
    const p11 = PACK11_OVERRIDES[card.id]
    const p12 = PACK12_OVERRIDES[card.id]
    const p13 = PACK13_OVERRIDES[card.id]
    const bd = BOND_OVERRIDES[card.id]
    const rv = RIVAL_OVERRIDES[card.id]
    // 尊号层放在最后:它只改 name.en,不该被任何机制层盖回去
    const ti = TITLE_OVERRIDES[card.id]
    if (!fl && !sig && !sk && !p3 && !p4 && !p5 && !p6d && !p6c && !p6l && !p7 && !p8 && !p9 && !p10 && !p11 && !p13 && !p12 && !bd && !rv && !ti)
      return card
    // 【风味层单独处理,不进这个 spread】(2026-08-06)
    // `FLAVOR_OVERRIDES` 是 `Pick<CardDef, 'text'>` —— 它**只有 text**,
    // 而 text 是整段替换的。于是「给这个传奇补一句风味」会顺手把
    // **生成层写好的规则说明整段删掉**:
    //
    //   生成层  「戰吼:發現一張武將牌。」        ← 规则
    //   风味层  「蕭規曹隨,清靜而治。」          ← 只剩风味,规则没了
    //
    // 而 `CardFace` 渲染的只有 `def.text`(没有从脚本生成描述那一层),
    // 于是曹參 打出去凭空发现一张牌,卡面上一个字都没写。
    // 晉文公 / 秦穆公 / 王猛 同样中招 —— 四张都是这么来的。
    //
    // 改成**追加**而不是替换,和 withBondRivalText 一个路子(那段注释里
    // 写的正是这条:补在合并处,别让后写的人抹掉先写的)。
    const ov = { ...sig, ...sk, ...p3, ...p4, ...p5, ...p6d, ...p6c, ...p6l, ...p7, ...p8, ...p9, ...p10, ...p11, ...p12, ...p13, ...bd, ...rv, ...ti }
    return withFlavorText(reconcileExclusive({ ...card, ...ov }, ov), fl)
  }),
  ...STRATAGEMS,
  ...PACK2_CARDS,
  ...PACK3_CARDS,
  ...PACK4_CARDS,
  ...PACK5_CARDS,
  ...PACK6_TOKENS,
  ...PACK6_DYNASTY_CARDS,
  ...PACK6_DOCTRINE_CARDS,
  ...PACK7_TOKENS,
  ...PACK7_CARDS,
  ...PACK8_TOKENS,
  ...PACK8_CARDS,
  ...PACK9_CARDS,
  ...PACK10_CARDS,
  ...PACK11_CARDS,
  ...PACK12_CARDS,
  ...PACK13_CARDS,
  ...PACK14_CARDS,
  ...PACK15_CARDS,
  ...PACK16_CARDS,
  ...PACK17_CARDS,
  ...PACK18_CARDS,
  ...PACK19_CARDS,
  ...PACK20_CARDS,
  ...PACK21_CARDS,
  ...PACK22_CARDS,
  ...PACK23_CARDS,
  ...PACK24_CARDS,
  ...PACK25_TOKENS,
  ...PACK25_CARDS,
  ...PACK26_CARDS,
  ...CAMPAIGN_TOKENS,
  ...HISTORY_TOKENS,
].map(applyPack24).map(applyTuning).map(withKeywordText)

const NAME_BY_ID: Record<string, LocalizedText> = Object.fromEntries(
  MERGED_CARDS.map((c) => [c.id, c.name]),
)

// 环境锦囊的卡面文案**从规则本身生成**。
// 规则里已经写清楚了它干什么(FieldRule.text),再让卡面单独写一遍,
// 就多出一处会和规则走样的地方 —— 上一版羁绊/宿敌吃过一模一样的亏。
function withFieldText(card: CardDef): CardDef {
  const op = card.spell?.ops.find((o) => o.op === 'setField')
  if (!op || op.op !== 'setField') return card
  if (card.text?.zh) return card
  return { ...card, text: op.rule.text }
}

// 兵种在**最后**派生:它读的是最终卡面(关键词与效果都合并完了)。
// 放在前面的话,pack 覆盖给的冲锋/守护就还没进来,推出来的兵种和卡面对不上。
export const CARDS: CardDef[] = MERGED_CARDS.map((raw) => {
  // 讲堂教具的身材钉死(见 LESSON_STAT_PINS)。**放在最前面** ——
  // 兵种是从攻血推导的,钉身材必须发生在推导之前,否则钉了也白钉。
  const pin = LESSON_STAT_PINS[raw.id]
  // `choose: undefined` 在覆盖表里是**有意义的**:抉择与战吼互斥,
  // 播种给的抉择必须被显式清掉,浅合并的 spread 做不到这件事。
  const c = pin ? ({ ...raw, ...pin } as CardDef) : raw
  if (pin && pin.choose === undefined) delete (c as { choose?: unknown }).choose
  const withText = withFieldText(withBondRivalText(c, NAME_BY_ID))
  // 内容层写死的兵种优先(衍生物按名字定,比按数值猜准)
  // 钉死的兵种优先于推导(见 PACK19_TROOP_PINS 的说明)
  const troop = withText.troop ?? PACK19_TROOP_PINS[withText.id] ?? deriveTroop(withText)
  return troop ? { ...withText, troop } : withText
})

export const CARDS_BY_ID: CardLibrary = Object.fromEntries(CARDS.map((c) => [c.id, c]))

// 可收集卡池:衍生物(token)只能被召唤,不进卡包、不可构筑、不进图鉴统计
export const COLLECTIBLE_CARDS: CardDef[] = CARDS.filter((c) => !c.token)

export const SIGNATURE_IDS = Object.keys(SIGNATURE_OVERRIDES)

// 卡池里**重名**的卡(中文名相同的两张及以上)。
//
// 这不是 bug 清单,而是一个必须承认的事实:花名册里既有真正的同名异人
// (蜀漢馬忠 / 東吳馬忠;東漢賈逵 / 曹魏賈逵;蜀漢李密 / 隋末李密),
// 也有导入期两批花名册重叠留下的同一个人(杜預、嵇康、阮籍 等在三国册里记作「群」、
// 在两晋册里记作「晋」)。
//
// **不做自动合并。** 分辨这两类需要逐个的史料判断,而合并的代价是不可逆的:
// 卡 id 一旦从卡池消失,玩家收藏里的那张就静默蒸发了。
// 所以这里只做一件事 —— 把重名的卡在界面上标出朝代,让「賈逵 · 魏」和
// 「賈逵 · 西漢」各自成立。真正该合并的那些,等有人愿意逐条过一遍史料再说。
//
// content.test.ts 钉住了当前数量,防止它悄悄变多。
export const AMBIGUOUS_NAMES: ReadonlySet<string> = (() => {
  const seen = new Map<string, number>()
  for (const c of COLLECTIBLE_CARDS) seen.set(c.name.zh, (seen.get(c.name.zh) ?? 0) + 1)
  return new Set([...seen.entries()].filter(([, n]) => n > 1).map(([name]) => name))
})()

// 该不该在卡名旁边标朝代
export function needsDynastyTag(card: CardDef): boolean {
  return AMBIGUOUS_NAMES.has(card.name.zh)
}
