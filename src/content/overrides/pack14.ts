import type { CardDef } from '../../engine/types'

// 第十四卡包 · 移形换位(swapStats)。
//
// 新 opcode swapStats:交换一个武将的攻击与最大生命。用附魔层的一条 delta 完成,
// 复用 GeneralBuffed 事件,不新增事件类型。伤害保留(挨过刀的换完还带着伤)。
//
// 它开了两条以前没有的线:
//   · 拆威胁 —— 一个 8/1 的猛攻怪换成 1/8,牙就没了,随手一换白赚一次交换差;
//   · 反客为主 —— 自己的 1/8 铁壁换成 8/1,守了半天突然一巴掌拍脸上。
//
// 全做成**隐宗**(不是任何冒险 Boss 的主义):既贴「移形换位」的诡谲气质,
// 也让它进不了 Boss 抽卡池 —— 免得贪心 AI 拿着交换牌乱换、把关卡难度搅乱。

export const PACK14_CARDS: CardDef[] = [
  {
    id: 'strat-rec-swap',
    collectorNo: 9993,
    name: { zh: '移形換位', en: 'Shifting Forms' },
    type: 'stratagem',
    doctrine: 'reclusion',
    dynasty: 'qun',
    rarity: 'common',
    archetype: 'strategist',
    cost: 3,
    keywords: [],
    // 拆威胁:把高攻怪的攻血对调,牙就没了。对 8/1 这种「一拳换一命」的怪最狠。
    spell: { ops: [{ op: 'swapStats', target: 'chosenEnemyGeneral' }] },
    text: {
      zh: '交換一個敵方武將的攻擊與生命。',
      en: 'Swap the Attack and Health of an enemy general.',
    },
  },
  {
    id: 'strat-rec-reverse',
    collectorNo: 9994,
    name: { zh: '反客為主', en: 'Turn the Tables' },
    type: 'stratagem',
    doctrine: 'reclusion',
    dynasty: 'qun',
    rarity: 'rare',
    archetype: 'strategist',
    cost: 2,
    keywords: [],
    // 反打:自己的高血低攻墙(1/8)换成 8/1,守了半天忽然一巴掌拍脸上。
    spell: { ops: [{ op: 'swapStats', target: 'chosenFriendlyGeneral' }] },
    text: {
      zh: '交換一個友方武將的攻擊與生命。',
      en: 'Swap the Attack and Health of a friendly general.',
    },
  },
]

export const PACK14_OVERRIDES: Record<string, Partial<CardDef>> = {}
