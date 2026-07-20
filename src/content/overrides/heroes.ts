import type { HeroDef, HeroPowerDef } from '../../engine/types'
import { START_HP } from '../../engine/types'

// 六主义主公,一主义一位。id 必须存在于武将花名册(立绘自动跟随)。
// 王道刘备、霸道曹操为既定;其余四位选型理由:
// - 礼教 孔子:礼教之宗,克己复礼——礼教主义的定义者本人。
// - 名利 司马懿:鹰视狼顾,隐忍一生只为名位权柄,名利路线的极致。
// - 割据 孙权:坐断东南战未休,凭长江割据一方的代表人物。
// - 隐逸 老子:道家始祖,出关而隐,隐逸主义的源头。
//
// ---- 主公技 ----
// 全部 2 费、每回合一次 —— 这是炉石验证了很多年的基线,别轻易动。
// 六个技能刻意落在六条**不同的资源轴**上,而不是「都是造成 X 点伤害,只有数字不同」:
//   王道=回复 / 霸道=点杀 / 礼教=换牌 / 名利=铺场 / 割据=护甲 / 隐逸=保护。
// 这样六个主义在还没发一张牌的时候就已经是六种打法了。
// 改数值必跑 `npm run sim-balance`:主公技每回合都能用,是全局触发频率最高的效果,
// 一点数值差在三十回合的对局里会被放大成压倒性优势。
const POWERS: Record<string, HeroPowerDef> = {
  'liu-bei': {
    id: 'hp-rende',
    name: { zh: '仁德', en: 'Benevolence' },
    text: { zh: '為一個友方角色恢復 3 點生命。', en: 'Restore 3 Health to a friendly character.' },
    cost: 2,
    script: { ops: [{ op: 'heal', amount: 3, target: 'chosenFriendly' }] },
  },
  'cao-cao': {
    id: 'hp-weicai',
    name: { zh: '唯才是舉', en: 'Merit Above All' },
    text: { zh: '造成 1 點傷害。', en: 'Deal 1 damage.' },
    cost: 2,
    script: { ops: [{ op: 'damage', amount: 1, target: 'chosenAny' }] },
  },
  'hist-confucius': {
    id: 'hp-youjiao',
    name: { zh: '有教無類', en: 'Teaching Without Class' },
    text: {
      zh: '抽一張牌,你的主公受到 2 點傷害。',
      en: 'Draw a card. Your hero takes 2 damage.',
    },
    cost: 2,
    script: {
      ops: [
        { op: 'draw', count: 1 },
        { op: 'damage', amount: 2, target: 'friendlyHero' },
      ],
    },
  },
  'sima-yi': {
    id: 'hp-yingshi',
    name: { zh: '鷹視狼顧', en: 'Wolf’s Gaze' },
    text: { zh: '召喚一個 1/1 的死士。', en: 'Summon a 1/1 Retainer.' },
    cost: 2,
    script: { ops: [{ op: 'summon', defId: 'token-si-shi', count: 1 }] },
  },
  'sun-quan': {
    id: 'hp-zhiheng',
    name: { zh: '制衡', en: 'Equilibrium' },
    text: { zh: '獲得 3 點護甲。', en: 'Gain 3 Armor.' },
    cost: 2,
    script: { ops: [{ op: 'gainArmor', amount: 3 }] },
  },
  'hist-laozi': {
    id: 'hp-wuwei',
    name: { zh: '無為', en: 'Non-Action' },
    text: { zh: '使一名友方武將獲得鐵壁。', en: 'Give a friendly general Divine Shield.' },
    cost: 2,
    script: {
      ops: [{ op: 'grantKeyword', keyword: 'divineShield', target: 'chosenFriendlyGeneral' }],
    },
  },
}

export const HEROES: HeroDef[] = [
  {
    id: 'liu-bei',
    name: { zh: '劉備', en: 'Liu Bei' },
    doctrine: 'royal',
    hp: START_HP,
    power: POWERS['liu-bei'],
  },
  {
    id: 'cao-cao',
    name: { zh: '曹操', en: 'Cao Cao' },
    doctrine: 'hegemonic',
    hp: START_HP,
    power: POWERS['cao-cao'],
  },
  {
    id: 'hist-confucius',
    name: { zh: '孔子', en: 'Confucius' },
    doctrine: 'ritual',
    hp: START_HP,
    power: POWERS['hist-confucius'],
  },
  {
    id: 'sima-yi',
    name: { zh: '司馬懿', en: 'Sima Yi' },
    doctrine: 'fame',
    hp: START_HP,
    power: POWERS['sima-yi'],
  },
  {
    id: 'sun-quan',
    name: { zh: '孫權', en: 'Sun Quan' },
    doctrine: 'separatist',
    hp: START_HP,
    power: POWERS['sun-quan'],
  },
  {
    id: 'hist-laozi',
    name: { zh: '老子', en: 'Laozi' },
    doctrine: 'reclusion',
    hp: START_HP,
    power: POWERS['hist-laozi'],
  },
]

export const HEROES_BY_ID: Record<string, HeroDef> = Object.fromEntries(
  HEROES.map((h) => [h.id, h]),
)
