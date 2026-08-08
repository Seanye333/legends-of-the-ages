import type { CardDef } from '../../engine/types'

// 第三十一卡包 · 定鼎 —— 顶费段的「一局一次」。
//
// 【查出来的缺口比 ROADMAP 写的更具体】
// ROADMAP 只说「9–10 费只有 70 张,一局最多出一张的牌本该是记忆点」。
// 数了一下才发现真正的空白是:**那 70 张全是武将,锦囊一张都没有。**
// 也就是说这个游戏里没有任何一张「攒到十费才打得出的大招」——
// 顶费段只有大身材,没有大场面。而 CCG 里最被记住的往往是后者。
//
// 【我在这里写过一段预判,实测把它整个推翻了 —— 留着当反例】
// 原话是:「十费的牌要能打出来对局得先撑到第十回合,而这把尺子的对局中位长度
// 远短于此,所以它量到的是『大多数局里它是一张卡在手里的废牌』。」
// 听起来很有道理,而第一轮实测是 **焚舟 +27.3 · 登壇拜將 +10.8**。
// 九费牌**根本不是废牌** —— 对局撑到那时候的比例足够高,高到一张单侧全场消灭
// 能把整套牌抬 27 个点。
// 教训和这个仓库反复吃到的是同一条:**「这一档天生难看」这种话必须先量再说**,
// 否则它会变成一张免死金牌,让整个高费段悄悄超模。
//
// 【三张走三个方向,刻意不重叠】
//   焚舟   —— 一次性清掉对面整个场面(此前全池没有单侧全场消灭)
//   登壇拜將 —— 把牌库里的将一次性铺上桌
//   傳國玉璽 —— 不解场也不铺场,把已经在场的这些人一起抬起来
//
// 【最终实测(600 局,对照组区间 −4.8 ~ +6.7)】
//   焚舟 +1.3 · 登壇拜將 −2.7 · 傳國玉璽 −3.3
//
// 焚舟 走了三版才收住,轨迹本身就是一条定价笔记:
//   消滅所有敵方武將 **+27.3** → 單側全場 5 點 **+18.7** → **雙方**全場 5 點 **+1.3**
// 前两版都是「单侧」,而在九费上单侧清场根本不是代价问题,是**形状**问题:
// 一张无条件把对面桌子掀掉的牌,贵到几费都还是无条件的。
// 改成双方同吃之后它才有了使用条件 —— 只有落后的一方会去按那个按钮。
export const PACK31_CARDS: CardDef[] = [
  {
    id: 'strat-fen-zhou',
    collectorNo: 10427,
    name: { zh: '焚舟', en: 'Burn the Fleet' },
    type: 'stratagem',
    doctrine: 'separatist',
    dynasty: 'wu',
    rarity: 'legendary',
    archetype: 'strategist',
    cost: 9,
    keywords: [],
    // 第一版是「消滅所有敵方武將」,实测 **+27.3** —— 单侧全场消灭在九费上照样超模。
    // 改成单侧全场 5 点仍然 **+18.7** —— aoeDamage 正是定价表低估最狠的那一档
    // (归组实测 +9.4,z=4.6),而基准 坐斷東南 又是六套里最缺解场的一套。
    // 第三版改成**双方同吃**:只有落后的一方才会去按这个按钮,
    // 那才是「火烈風猛,船往如箭」该有的样子 —— 它烧的从来不是一边。
    spell: { ops: [{ op: 'damageAll', amount: 5 }] },
    text: {
      zh: '對**雙方**所有武將造成 5 點傷害。時東南風急,蓋以十艦最著前,同時發火,火烈風猛,船往如箭,燒盡北船。',
      en: 'Deal 5 damage to every general on both sides. The southeast wind rose; ten ships went first and fired together, and the wind carried them like arrows into the northern fleet.',
    },
  },
  {
    id: 'strat-dengtan-baijiang',
    collectorNo: 10428,
    name: { zh: '登壇拜將', en: 'Raised to the Altar' },
    type: 'stratagem',
    doctrine: 'royal',
    dynasty: 'chu-han',
    rarity: 'legendary',
    archetype: 'strategist',
    cost: 9,
    keywords: [],
    // 第一版 3 名实测 +10.8(徵召本来就是定价表低估最狠的几档之一,归组 +8.8)
    spell: { ops: [{ op: 'recruit', count: 2 }] },
    text: {
      zh: '從我方牌庫隨機召喚 2 名武將。王必欲拜之,擇良日,齋戒,設壇場,具禮,乃可耳。',
      en: 'Summon two random generals from your deck. If my lord truly means to appoint him — pick a day, fast, raise an altar, and do it properly.',
    },
  },
  {
    id: 'strat-chuanguo-yuxi',
    collectorNo: 10429,
    name: { zh: '傳國玉璽', en: 'The Imperial Seal' },
    type: 'stratagem',
    doctrine: 'hegemonic',
    dynasty: 'qun',
    rarity: 'legendary',
    archetype: 'strategist',
    cost: 9,
    keywords: [],
    spell: {
      ops: [
        { op: 'buffStats', attack: 3, health: 3, target: 'allFriendlyGenerals' },
        { op: 'grantKeyword', keyword: 'guard', target: 'allFriendlyGenerals' },
      ],
    },
    text: {
      zh: '友方全體 +3/+3 並獲得守護。方圓四寸,上紐交五龍,傍缺一角,以金鑲之 —— 受命於天,既壽永昌。',
      en: 'Give all friendly generals +3/+3 and Guard. Four inches square, five dragons on the knob, one corner chipped and mended with gold: Mandated by Heaven, long life and prosperity.',
    },
  },
]
