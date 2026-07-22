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
//   王道=增益 / 霸道=点杀 / 礼教=换牌 / 名利=铺场 / 割据=守墙 / 隐逸=控场。
// 这样六个主义在还没发一张牌的时候就已经是六种打法了。
// 改数值必跑 `npm run sim-balance`:主公技每回合都能用,是全局触发频率最高的效果,
// 一点数值差在三十回合的对局里会被放大成压倒性优势。
const POWERS: Record<string, HeroPowerDef> = {
  'liu-bei': {
    id: 'hp-rende',
    name: { zh: '仁德', en: 'Benevolence' },
    // +1/+1 打出来只有 40.6%,而且被名利的铺场流压到 25%。
    // 补的是血而不是攻:王道输在自家武将被 1 点法伤和小兵换掉,不是输在打不出伤害。
    text: { zh: '使一名友方武將獲得+1/+2。', en: 'Give a friendly general +1/+2.' },
    cost: 2,
    script: {
      ops: [{ op: 'buffStats', attack: 1, health: 2, target: 'chosenFriendlyGeneral' }],
    },
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
      zh: '抽一張牌,你的主公受到 1 點傷害。',
      en: 'Draw a card. Your hero takes 1 damage.',
    },
    cost: 2,
    script: {
      ops: [
        { op: 'draw', count: 1 },
        { op: 'damage', amount: 1, target: 'friendlyHero' },
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
    text: {
      zh: '召喚一個 0/4 的江東水寨(守護)。',
      en: 'Summon a 0/4 Jiangdong Stockade with Guard.',
    },
    cost: 2,
    script: { ops: [{ op: 'summon', defId: 'token-shui-zhai', count: 1 }] },
  },
  'hist-laozi': {
    id: 'hp-wuwei',
    name: { zh: '無為', en: 'Non-Action' },
    // 试过「获得铁壁」(太强,64%)和「获得潜行」(太弱,27%)。
    // 冻结落在两者之间,而且「不战而屈人之兵」比给自己套盾更像隐逸。
    text: { zh: '凍結一名敵方武將。', en: 'Freeze an enemy general.' },
    cost: 2,
    script: { ops: [{ op: 'freeze', target: 'chosenEnemyGeneral' }] },
  },

  // ---- 备选主公技(第六卡包:每个主义第二位主公) ----
  //
  // 设计原则:**每个备选主公技借用另一条轴上已经验证过的那一招**,不引入新的强度档。
  // 六个基准主公技都是 2 费、镜像约 50%(注释见上),把它们**换个主义**用,
  // 就给那个主义开了第二种打法:王道能玩控场、霸道能铺场、名利能过牌……
  // 而强度仍在证过的带里。改动必跑 hero-mirror 校验(scripts/sim-hero-mirror.ts)。
  //
  // 借用关系:王道→控场(隐逸)· 霸道→铺场(名利)· 礼教→增益(王道)·
  //           名利→过牌(礼教)· 割据→点杀(霸道)· 隐逸→守墙(割据)
  'hist-liu-xiu': {
    id: 'hp-rousao',
    name: { zh: '柔道', en: 'The Gentle Way' },
    text: { zh: '凍結一名敵方武將。', en: 'Freeze an enemy general.' },
    cost: 2,
    script: { ops: [{ op: 'freeze', target: 'chosenEnemyGeneral' }] },
  },
  'zhang-liao': {
    id: 'hp-xiaoyao',
    name: { zh: '威震逍遙津', en: 'Terror of Xiaoyao Ford' },
    // 召 1/1 在霸道攻势卡组里太软(镜像 25%);改召 2/1 冲锋的虎豹骑,能立刻换血/打脸。
    text: { zh: '召喚一個 2/1 衝鋒的虎豹騎。', en: 'Summon a 2/1 Tiger-Leopard Cavalry with Charge.' },
    cost: 2,
    script: { ops: [{ op: 'summon', defId: 'token-hubao-qi', count: 1 }] },
  },
  'hist-zhu-xi': {
    id: 'hp-cunli',
    name: { zh: '格物致知', en: 'Investigate to Know' },
    // 增益在礼教控场卡组里太弱(镜像 31%);礼教要的是解场,改成对一个敌将 2 点。
    // 点杀 2 在礼教控场里差一口气(37%);加 1 护甲,礼教靠磨,续航更契合。
    text: { zh: '造成 2 點傷害,你的主公獲得 1 點護甲。', en: 'Deal 2 damage and gain 1 Armor.' },
    cost: 2,
    script: {
      ops: [
        { op: 'damage', amount: 2, target: 'chosenAny' },
        { op: 'gainArmor', amount: 1 },
      ],
    },
  },
  'guo-jia': {
    id: 'hp-yiji',
    name: { zh: '遺計', en: 'The Final Scheme' },
    // 名利预组是铺场/节奏向:纯抽牌太软(27%)、抽+点杀又太强(69%)。
    // 落在中间的是纯点杀 1 —— 遗计算无遗策,一箭定乾坤。
    text: { zh: '造成 1 點傷害。', en: 'Deal 1 damage.' },
    cost: 2,
    script: { ops: [{ op: 'damage', amount: 1, target: 'chosenAny' }] },
  },
  'lu-meng': {
    id: 'hp-baiyi',
    name: { zh: '白衣渡江', en: 'Crossing in White' },
    text: { zh: '造成 1 點傷害。', en: 'Deal 1 damage.' },
    cost: 2,
    script: { ops: [{ op: 'damage', amount: 1, target: 'chosenAny' }] },
  },
  'hist-zhuangzi': {
    id: 'hp-xiaoyaoyou',
    name: { zh: '逍遙遊', en: 'Free and Easy Wandering' },
    // 被动守护墙在隐逸卡组里太消极(镜像 25→24%);隐逸要主动养刺客,
    // 改成给一个友军 +2/+2 与潜行 —— 一手养出能一击致命的刺客。
    text: { zh: '使一名友方武將獲得 +2/+2 與潛行。', en: 'Give a friendly general +2/+2 and Stealth.' },
    cost: 2,
    script: {
      ops: [
        { op: 'buffStats', attack: 2, health: 2, target: 'chosenFriendlyGeneral' },
        { op: 'grantKeyword', keyword: 'stealth', target: 'chosenFriendlyGeneral' },
      ],
    },
  },
}

// 备选主公:每个主义的第二位。同主义共享卡池,只换主公技(= 换打法)。
export const ALT_HEROES: HeroDef[] = [
  { id: 'hist-liu-xiu', name: { zh: '劉秀', en: 'Liu Xiu' }, doctrine: 'royal', hp: START_HP, power: POWERS['hist-liu-xiu'] },
  { id: 'zhang-liao', name: { zh: '張遼', en: 'Zhang Liao' }, doctrine: 'hegemonic', hp: START_HP, power: POWERS['zhang-liao'] },
  { id: 'hist-zhu-xi', name: { zh: '朱熹', en: 'Zhu Xi' }, doctrine: 'ritual', hp: START_HP, power: POWERS['hist-zhu-xi'] },
  { id: 'guo-jia', name: { zh: '郭嘉', en: 'Guo Jia' }, doctrine: 'fame', hp: START_HP, power: POWERS['guo-jia'] },
  { id: 'lu-meng', name: { zh: '呂蒙', en: 'Lu Meng' }, doctrine: 'separatist', hp: START_HP, power: POWERS['lu-meng'] },
  { id: 'hist-zhuangzi', name: { zh: '莊周', en: 'Zhuangzi' }, doctrine: 'reclusion', hp: START_HP, power: POWERS['hist-zhuangzi'] },
]

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

// 全部主公 = 六位基准 + 六位备选。HEROES_BY_ID 两者都收(引擎按 heroId 查主公技)。
export const ALL_HEROES: HeroDef[] = [...HEROES, ...ALT_HEROES]

export const HEROES_BY_ID: Record<string, HeroDef> = Object.fromEntries(
  ALL_HEROES.map((h) => [h.id, h]),
)
