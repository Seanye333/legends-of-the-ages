import type { CardDef } from '../../engine/types'

// 羁绊(結義 / 君臣 / 師徒)—— 把**真实历史关系**变成构筑动机。
//
// 卡池是 2300 位真实人物,他们之间有真实存在的关系:这是编造世界观的 CCG
// 永远拿不到的素材。羁绊让构筑有了叙事 —— 你不是在配曲线,是在**重组一段历史**。
//
// 实现挂在**锚点卡**的 `bond` 字段上(与 aura 同源,引擎只读 lib,不 import 内容层)。
// members 是「除锚点外还需在场的卡」;凑齐了,锚点与全体成员一起吃增益。
// 走光环的附魔路径 → 成员被杀/被策反/回手时羁绊自动断裂、增益自动收回,
// **不能**写成一次性 buffStats(那没有撤销路径)。
//
// 定价:羁绊要求同时在场多张指定卡,是很硬的条件(还得抽到、还得活着),
// 所以给得比同费光环大方一档;但刻意避开「+攻很高」的组合,免得变成斩杀跳板。

export const BOND_OVERRIDES: Record<string, Partial<CardDef>> = {
  // 桃園結義:三人齐聚,全体 +2/+2。本作最有辨识度的一条。
  'liu-bei': {
    bond: { id: 'bond-taoyuan', members: ['guan-yu', 'zhang-fei'], attack: 2, health: 2 },
  },
  // 臥龍鳳雛:得一可安天下 —— 两人同场,彼此 +2/+2。
  'zhuge-liang': {
    bond: { id: 'bond-wolong', members: ['pang-tong'], attack: 2, health: 2 },
  },
  // 江東二喬(孫策 · 周瑜):總角之好,共定江東。
  'sun-ce': {
    bond: { id: 'bond-jiangdong', members: ['zhou-yu'], attack: 1, health: 2 },
  },
  // 鬼谷門下(孫臏 · 龐涓):同門相殘 —— 只加攻,不加血,呼应那段互相算计的史事。
  'hist-sun-bin': {
    bond: { id: 'bond-guigu', members: ['hist-pang-juan'], attack: 2, health: 0 },
  },
  // 漢初三傑(張良 · 蕭何 · 韓信):运筹帷幄、镇国抚民、战必胜攻必取。
  'hist-zhang-liang': {
    bond: { id: 'bond-sanjie', members: ['hist-xiao-he', 'hist-han-xin'], attack: 2, health: 2 },
  },

  // ============================================================
  // 三国势力羁绊 —— 势力标签回填(魏 192 / 蜀 119 / 吴 144)之后才立得住:
  // 从前魏蜀吴各只有十来张,凑不出任何一条势力主题。
  //
  // 刻意都设计成**两名成员**(锚点 + 2 人 = 场上三人)。三人已是很硬的条件
  // (要抽到、要活着、要同时在场);再往上加人就只剩「赢了才凑得齐」的废卡。
  // ============================================================

  // 五虎上將(蜀):关张已在桃园结义,这条给另外三虎 —— 赵马黄。
  'zhao-yun': {
    bond: { id: 'bond-wuhu', members: ['ma-chao', 'huang-zhong'], attack: 2, health: 2 },
  },
  // 五子良將(魏):张辽 · 徐晃 · 于禁(乐进/张郃 不在池中或已归群)。
  'zhang-liao': {
    bond: { id: 'bond-wuzi', members: ['xu-huang', 'yu-jin'], attack: 2, health: 1 },
  },
  // 虎癡與惡來(魏):许褚 · 典韦,曹操的两大保镖 —— 只加身板,不加攻。
  'xu-chu': {
    bond: { id: 'bond-huchi', members: ['dian-wei'], attack: 0, health: 3 },
  },
  // 江東虎臣(吴):程普 · 黄盖 · 韩当,孙氏三代老臣。
  'cheng-pu': {
    bond: { id: 'bond-hucheng', members: ['huang-gai', 'han-dang'], attack: 1, health: 3 },
  },
  // 江東四英(吴):周瑜已在二乔,这条接周瑜之后的三任大都督 —— 鲁肃 · 陆逊。
  'lu-su': {
    bond: { id: 'bond-siying', members: ['lu-xun'], attack: 1, health: 2 },
  },
}
