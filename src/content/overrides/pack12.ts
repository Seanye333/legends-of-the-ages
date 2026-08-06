import type { CardDef } from '../../engine/types'

// 第十二卡包 · 碾压(Trample)。
//
// 新关键词 碾压:攻击武将时,超过其当前生命的伤害穿透到敌方主公。
// 它专治「拿小兵垫刀」—— 守护能挡住攻击,挡不住溢出。于是高攻大身材第一次有了
// 无视换血的终结意义:一个 11 攻的飞将军撞进 3 血守护,还有 8 点糊在脸上。
//
// 两条边界(都写进了引擎注释与讲堂):铁壁完整挡下则无穿透;剧毒不叠加穿透 ——
// 穿的是「你打了多少」,不是「它死没死」。
//
// 全部落在非预组卡上,sim-balance(只测预组)不受影响;但它给霸道/割据 Boss 抽卡池
// 添了几张强卡,所以加完必须重跑 sim-campaign 确认曲线没被顶出闸门。

export const PACK12_CARDS: CardDef[] = [
  {
    id: 'gen-heg-juggernaut',
    collectorNo: 9981,
    name: { zh: '破陣重騎', en: 'Breach Juggernaut' },
    type: 'general',
    doctrine: 'hegemonic',
    dynasty: 'qun',
    rarity: 'epic',
    archetype: 'warrior',
    cost: 7,
    attack: 7,
    health: 6,
    keywords: ['trample'],
    // 高攻的碾压终结器:你要么用大身材挡(换掉它),要么放它一马、脸上继续挨穿透。
    text: {
      zh: '碾壓。陣列在前,一碾而過。',
      en: 'Trample. What stands in the line is simply run over.',
    },
  },
  {
    id: 'strat-sep-crush',
    collectorNo: 9982,
    name: { zh: '勢如破竹', en: 'Like Splitting Bamboo' },
    type: 'stratagem',
    doctrine: 'separatist',
    dynasty: 'qun',
    rarity: 'common',
    archetype: 'warrior',
    cost: 2,
    keywords: [],
    // 点燃碾压:把一个大攻武将现开成穿透终结器,守护再厚也拦不住溢出。
    spell: {
      ops: [
        { op: 'buffStats', attack: 2, health: 0, target: 'chosenFriendlyGeneral' },
        { op: 'grantKeyword', keyword: 'trample', target: 'chosenFriendlyGeneral' },
      ],
    },
    text: {
      zh: '給一個友方武將 +2 攻並獲得碾壓。',
      en: 'Give a friendly general +2 Attack and Trample.',
    },
  },
]

// 【2026-08-06:这两条原本各自还写了一份 text,已删掉】
// 它们只是要给这两位加「碾壓」,但**顺手把 text 整段重写了**,而重写的那一版
// 把 signature-skills 里的战吼说明弄丢了:
//
//   signature-skills  「碾壓。戰吼:對一名敵方武將造成 3 點傷害。飛將軍在…」  ← 完整
//   pack12(更晚合并) 「碾壓。飛將軍在,溢出之勢無人可擋。」                ← 战吼没了
//
// 而战吼本身还在(它来自 signature-skills,pack12 没动过它)。于是这两张卡
// **打出去凭空多三点伤害,卡面上一个字都没写**。`CardFace` 渲染的只有 `def.text`,
// 没有「从脚本生成描述」那一层,所以玩家就是看不到。
//
// 修法是**把 text 删掉**而不是补写:正确的那一份已经在 signature-skills 里了,
// 这一层本来就只该管 keywords。碾壓 二字也不必自己写 —— `withKeywordText`
// 会把文案里缺的关键词自动补在最前面(见 content/cards.ts)。
//
// (原注释里写的「李廣 9 费 11/7」「太史慈 7 费 9/6」也早就不成立了 ——
//  signature-skills 把两位都改成了 5/4。一并去掉,免得下一个人照着它推理。)
export const PACK12_OVERRIDES: Record<string, Partial<CardDef>> = {
  // 霸道 · 李廣:飛將軍。碾压是这套里最狠的终结器 —— 一记撞穿守护,剩下的全上脸。
  'hist-li-guang': {
    keywords: ['trample'],
  },
  // 霸道 · 太史慈:碾压载体,把「垫刀」这条路直接堵死。
  'taishi-ci': {
    keywords: ['trample'],
  },
}
