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

export const PACK12_OVERRIDES: Record<string, Partial<CardDef>> = {
  // 霸道 · 李廣(9 费 11/7):飛將軍。11 攻碾压是这套里最狠的终结器 ——
  // 一记撞穿守护,剩下的全上脸。
  'hist-li-guang': {
    keywords: ['trample'],
    text: {
      zh: '碾壓。飛將軍在,溢出之勢無人可擋。',
      en: 'Trample. Where the Flying General strikes, the overflow cannot be held.',
    },
  },
  // 霸道 · 太史慈(7 费 9/6):中费的碾压载体,把「垫刀」这条路直接堵死。
  'taishi-ci': {
    keywords: ['trample'],
    text: {
      zh: '碾壓。神射之勇,一往無前。',
      en: 'Trample. The peerless marksman charges through.',
    },
  },
}
