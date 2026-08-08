import type { CardDef } from '../../engine/types'

// 第三十卡包 · 夷三族 —— 把家族这条轴的**负面**那一半接上。
//
// 【背景】
// 家族已经做好很久了(155 个族,同族 ≥2 人在场各 +0/+1),但它只有正收益:
// 凑族人是纯赚的,对手没有任何理由让你别凑。
// 而结局字段里有 **168 个人是被族诛的** —— 现成的、这个题材独有的负向叙事,
// 一直没接机制。
//
// 【引擎侧只加了一个目标:`clanOfChosenEnemy`】
// 它是卡池里第一个**由「选中的那一个」派生出「一组」**的目标 ——
// 此前 chosen* 一律一对一、all* 一律不给选,而这条要的正是中间那一态:
// **你挑谁是决定,挑完打中几个由场面说了算。**
//
// 这也正好是它的定价形状:
//   下限 —— 对面没有同族在场时,这就是一张普通的单体解场(155 族之外的人占多数)
//   上限 —— 曹氏 27 人、夏侯氏 8 人,真凑起来一张牌能带走三四个
// 于是它天然是一张**对家族流的针对牌**,而不是一张无差别的强解 ——
// 这正是家族那条轴此前缺的对手一侧。
//
// 【最终实测(600 局,对照组区间 −4.8 ~ +6.7)】
//   夷三族 +4.7 · 連坐吏 +3.7(第一版 4 费 +9.5,纯涨一格费用收住)
//
// 值得记一笔:两张都**没有**因为「上限很吓人」而被削。
// 曹氏 27 人听起来很大,但那是**卡池里**的族人数,不是**场上**的 ——
// 真正打中三个以上需要对手主动把三个同族摆在一起,而那正是家族流在做的事。
// 换句话说这两张的强度是**对手构筑的函数**,不是它们自己的:
// 打普通牌组时它就是一张单体解场(带内),打家族流时它才是族灭。
// 这种「针对牌」此前一张都没有 —— 家族那条轴上线以来只有正收益。
export const PACK30_CARDS: CardDef[] = [
  {
    id: 'strat-yi-san-zu',
    collectorNo: 10425,
    name: { zh: '夷三族', en: 'The Three Kindreds' },
    type: 'stratagem',
    doctrine: 'hegemonic',
    dynasty: 'qin',
    rarity: 'epic',
    archetype: 'strategist',
    cost: 5,
    keywords: [],
    spell: { ops: [{ op: 'destroy', target: 'clanOfChosenEnemy' }] },
    text: {
      zh: '消滅一名敵方武將,以及敵方場上所有與他同族的人。秦法:誅三族者,先黥、劓,斬左右趾,笞殺之。',
      en: "Destroy an enemy general and every enemy general of the same house. Under Qin law, the sentence of the three kindreds began with the brand and ended with the rod.",
    },
  },
  {
    id: 'gen-lian-zuo-li',
    collectorNo: 10426,
    name: { zh: '連坐吏', en: 'Clerk of Collective Guilt' },
    type: 'general',
    doctrine: 'ritual',
    dynasty: 'qin',
    rarity: 'rare',
    archetype: 'strategist',
    // 第一版 4 费实测 +9.5(带外)。纯涨一格费用,身材不动 —— 一次只动一个旋钮。
    cost: 5,
    attack: 3,
    health: 4,
    keywords: [],
    // 战吼版走**伤害**不走消灭:一张带身材的牌不该同时带无条件的族灭,
    // 而 3 点伤害打在一门老小身上,该死的死、撑得住的留着 —— 那也更像连坐。
    battlecry: { ops: [{ op: 'damage', amount: 3, target: 'clanOfChosenEnemy' }] },
    text: {
      zh: '戰吼:對一名敵方武將及敵方場上所有與他同族的人造成 3 點傷害。商君之法,什伍相牧司連坐。',
      en: 'Battlecry: deal 3 damage to an enemy general and every enemy general of the same house. Lord Shang bound them in fives and tens, each answerable for the rest.',
    },
  },
]
