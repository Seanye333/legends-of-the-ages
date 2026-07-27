import type { BattleObjective, LocalizedText, RunModifiers } from '../engine/types'

// 乱斗:一场怪规则的快速对局。规则**双方同吃**,所以是公平的混战 —— 纯图一乐,
// 也顺便让玩家在奇葩规则下重新认识自己的卡组。复用 RunModifiers,零引擎改动。
//
// hpDelta:双方主公血量增减(RunModifiers 里没有 HP,单列)。
//
// objective:换胜负条件的那一类乱斗(守成 / 斩将 / 护送)。这一层引擎早就有了
// (名局重现在用),乱斗只是第二个消费者 —— **规则怪不一定要靠数值怪**,
// 「这一局赢的方式不一样」比「这一局双方都多抽四张」新鲜得多。
// 目标是**不对称**的(座位 0 = 玩家),所以带目标的乱斗要用 playerOnly/oppOnly
// 单独摆目标单位,不能混进双方同吃的 modifiers。
export interface BrawlDef {
  id: string
  name: LocalizedText
  text: LocalizedText
  modifiers: RunModifiers // 双方同吃
  hpDelta?: number
  objective?: BattleObjective
  playerOnly?: RunModifiers // 只加在玩家侧(护送目标)
  oppOnly?: RunModifiers // 只加在对手侧(斩将目标)
}

export const BRAWLS: BrawlDef[] = [
  {
    id: 'brawl-chaos',
    name: { zh: '天下大亂', en: 'The Realm in Chaos' },
    text: { zh: '双方起手多抽四张牌。', en: 'Both players draw four extra opening cards.' },
    modifiers: { bonusHandSize: 4 },
  },
  {
    id: 'brawl-swift',
    name: { zh: '兵貴神速', en: 'Speed is the Soul of War' },
    text: { zh: '双方主公技免费。', en: 'Both Hero Powers are free.' },
    modifiers: { heroPowerCostDelta: -2 },
  },
  {
    id: 'brawl-fortress',
    name: { zh: '堅城對峙', en: 'Fortress Standoff' },
    text: { zh: '双方开局获得 10 点护甲。', en: 'Both players start with 10 Armor.' },
    modifiers: { startArmor: 10 },
  },
  {
    id: 'brawl-swarm',
    name: { zh: '群雄並起', en: 'Warlords Everywhere' },
    text: { zh: '双方开局各带三个 1/1 的乡勇。', en: 'Both players start with three 1/1 Village Levies.' },
    modifiers: { startTokens: ['token-xiangyong', 'token-xiangyong', 'token-xiangyong'] },
  },
  {
    id: 'brawl-cheap',
    name: { zh: '謀定後動', en: 'Plans Laid in Advance' },
    text: { zh: '双方起手手牌费用 -2。', en: 'Cards in both opening hands cost 2 less.' },
    modifiers: { handCostDelta: -2 },
  },
  {
    id: 'brawl-blitz',
    name: { zh: '破釜沉舟', en: 'Burn the Boats' },
    text: {
      zh: '双方开局 15 血、起手多抽两张 —— 速战速决。',
      en: 'Both heroes start at 15 HP and draw two extra cards. Make it quick.',
    },
    modifiers: { bonusHandSize: 2 },
    hpDelta: -15,
  },
  {
    id: 'brawl-titan',
    name: { zh: '巨闕在手', en: 'Colossus Unleashed' },
    text: {
      zh: '双方主公技免费、开局 5 护甲、起手多抽一张。',
      en: 'Both Hero Powers are free; both start with 5 Armor and an extra card.',
    },
    modifiers: { heroPowerCostDelta: -2, startArmor: 5, bonusHandSize: 1 },
  },
  {
    id: 'brawl-ironcav',
    name: { zh: '鐵騎洪流', en: 'Torrent of Iron' },
    text: { zh: '双方开局各带两个 2/2 的铁骑。', en: 'Both players start with two 2/2 Ironclad Cavalry.' },
    modifiers: { startTokens: ['token-tie-qi', 'token-tie-qi'] },
  },
  {
    id: 'brawl-imperial',
    name: { zh: '禁軍列陣', en: 'Guard in Formation' },
    text: {
      zh: '双方开局各带一个 3/3 禁军,并获得 5 点护甲。',
      en: 'Both players start with a 3/3 Imperial Guard and 5 Armor.',
    },
    modifiers: { startTokens: ['token-jin-jun'], startArmor: 5 },
  },
  {
    id: 'brawl-firestorm',
    name: { zh: '開局即決', en: 'Decided at the Gate' },
    text: {
      zh: '双方主公技免费、起手多抽三张 —— 一上来就是高潮。',
      en: 'Both Hero Powers are free and both draw three extra cards — it peaks from turn one.',
    },
    modifiers: { heroPowerCostDelta: -2, bonusHandSize: 3 },
  },

  // ---- 换胜负条件的一类 ----
  // 这三条不动数值,只动「怎么算赢」。对手是普通预组 AI,而 AI **不懂目标**
  // (它只会照常打脸),所以难度靠目标形态自己成立:守成看回合数,
  // 斩将的目标带守护逼你啃穿,护送的目标 0 攻高血、AI 懒得碰但会被 AOE 误伤。
  {
    id: 'brawl-siege',
    name: { zh: '孤城不落', en: 'The City Holds' },
    text: {
      zh: '换个赢法:不必斩敌主公 —— 撑过 12 回合即胜。双方开局 8 点护甲。',
      en: 'A different win: you need not kill the enemy hero. Survive 12 turns. Both start with 8 Armor.',
    },
    modifiers: { startArmor: 8 },
    objective: { kind: 'survive', turns: 12 },
  },
  {
    id: 'brawl-decapitate',
    name: { zh: '斬其主將', en: 'Take the Commander' },
    text: {
      zh: '换个赢法:敌阵中有一员主将(5/10 守护),斩了他就赢,主公血量无关。',
      en: 'A different win: a 5/10 Guard commander stands in the enemy line. Cut him down and win.',
    },
    modifiers: {},
    oppOnly: { startTokens: ['token-di-zhu-jiang'] },
    objective: {
      kind: 'assassinate',
      targetSide: 1,
      targetDefId: 'token-di-zhu-jiang',
      targetName: { zh: '敵軍主將', en: 'Enemy Commander' },
    },
  },
  {
    id: 'brawl-convoy',
    name: { zh: '糧道之爭', en: 'The Grain Road' },
    text: {
      zh: '换个赢法:你带一辆 0/8 粮车,车毁即负 —— 照常斩敌主公才算赢。',
      en: 'A different win: you escort a 0/8 grain cart. Lose it and you lose. Kill the enemy hero to win.',
    },
    modifiers: {},
    playerOnly: { startTokens: ['token-liang-che'] },
    objective: {
      kind: 'protect',
      targetSide: 0,
      targetDefId: 'token-liang-che',
      targetName: { zh: '糧車', en: 'Grain Cart' },
    },
  },
]
