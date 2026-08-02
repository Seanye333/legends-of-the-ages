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
  // ---- 第二批(2026-07)。13 条 = 13 周就完整循环,三个月后玩家开始看见重复。
  // 这七条刻意去用**从没被乱斗碰过**的三个 RunModifiers 字段:
  // startMorale / startSupply / vicePower —— 引擎早就支持,乱斗一条都没用过。
  {
    id: 'brawl-morale',
    name: { zh: '士氣如虹', en: 'Morale Unbroken' },
    text: { zh: '双方开局士气拉满 —— 一上来就是全军亢奋的状态。', en: 'Both sides start with full morale.' },
    modifiers: { startMorale: 3 },
  },
  {
    id: 'brawl-granary',
    name: { zh: '倉廩實', en: 'Full Granaries' },
    text: { zh: '双方开局屯粮八分满 —— 那些吃粮的牌这一局随便打。', en: 'Both sides start with ample supply.' },
    modifiers: { startSupply: 8 },
  },
  {
    id: 'brawl-vice',
    name: { zh: '副將隨行', en: 'Second in Command' },
    text: { zh: '双方各多一名副将(仁德)—— 两个主公技轮着用,但每回合仍只能用一个。', en: 'Both sides gain a vice-general power; still one hero power per turn.' },
    modifiers: {
      vicePower: {
        id: 'hp-rende',
        name: { zh: '仁德', en: 'Benevolence' },
        text: { zh: '一名友方武將 +1/+2。', en: 'Give a friendly general +1/+2.' },
        cost: 2,
        script: {
          ops: [{ op: 'buffStats', attack: 1, health: 2, target: 'chosenFriendlyGeneral' }],
        },
      },
    },
  },
  {
    id: 'brawl-lean',
    name: { zh: '兵微將寡', en: 'Thin Ranks' },
    text: { zh: '双方开局 40 血,但起手少一张、手牌贵 1 费 —— 打的是耐心。', en: 'Both start at 40 HP but with one fewer card and costlier hands — a war of patience.' },
    modifiers: { bonusHandSize: -1, handCostDelta: 1 },
    hpDelta: 10,
  },
  {
    id: 'brawl-warband',
    name: { zh: '部曲成群', en: 'Warband' },
    text: { zh: '双方开局各带两个乡勇与一个丹阳兵,并有 3 点护甲。', en: 'Both start with two levies, a Danyang guard and 3 Armor.' },
    modifiers: {
      startTokens: ['token-xiangyong', 'token-xiangyong', 'token-danyang-bing'],
      startArmor: 3,
    },
  },
  {
    id: 'brawl-longmarch',
    name: { zh: '長途奔襲', en: 'The Long March' },
    text: { zh: '换个赢法:撑过 16 回合即胜。双方屯粮拉满、主公技免费。', en: 'Different win condition: survive 16 turns. Full supply and free hero powers.' },
    modifiers: { startSupply: 10, heroPowerCostDelta: -2 },
    objective: { kind: 'survive', turns: 16 },
  },
  // ---- 第三批(2026-08):用第二十二/二十三卡包的新轴 ----
  // 乱斗是**双方同吃**,所以天然公平;而新轴在这里第一次以「规则」而不是
  // 「某张卡的效果」的形式出现 —— 同一条机制换个位置就是另一种玩法。
  {
    id: 'brawl-junling',
    name: { zh: '軍令如山', en: 'The Order Stands' },
    text: {
      zh: '双方开局各领一道军令:斩杀 3 名敌将 → 全场 +3/+3 并抽 2 张。谁先攒满谁翻盘。',
      en: 'Both sides start with a quest: kill 3 enemy generals → +3/+3 to your board and draw 2. First to finish swings the game.',
    },
    modifiers: {
      startQuest: {
        id: 'brawl-quest-junling',
        name: { zh: '軍令如山', en: 'The Order Stands' },
        goal: { kind: 'killGenerals', count: 3 },
        reward: {
          ops: [
            { op: 'buffStats', attack: 3, health: 3, target: 'allFriendlyGenerals' },
            { op: 'draw', count: 2 },
          ],
        },
      },
    },
  },
  {
    id: 'brawl-jueliang',
    name: { zh: '斷糧之戰', en: 'War of Attrition' },
    text: {
      zh: '换个赢法:双方牌库都很浅 —— 撑过 10 回合即胜,但疲劳来得比谁都快。',
      en: 'A different win: survive 10 turns — but both decks run dry fast and fatigue bites early.',
    },
    modifiers: { bonusHandSize: 3, startArmor: 6 },
    objective: { kind: 'survive', turns: 10 },
  },
  {
    id: 'brawl-aibing',
    name: { zh: '哀兵之陣', en: 'The Grieving Line' },
    text: {
      zh: '双方开局士气 -3(全场 -1 攻)、屯粮拉满、主公 45 血 —— 一场谁都砍不动谁的长局。',
      en: 'Both sides start at -3 Morale (generals at -1 attack) with full supply and 45 HP — a long grind where nobody hits hard.',
    },
    modifiers: { startMorale: -3, startSupply: 10 },
    hpDelta: 15,
  },
  {
    id: 'brawl-heirloom',
    name: { zh: '傳世之兵', en: 'Arms of the Ancestors' },
    text: { zh: '双方开局各带一个铁骑,起手多抽两张、手牌便宜 1 费 —— 名器该有人使。', en: 'Both start with a cavalry token, two extra cards and cheaper hands.' },
    modifiers: { startTokens: ['token-tie-qi'], bonusHandSize: 2, handCostDelta: -1 },
  },
]
