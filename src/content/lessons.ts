import type { LethalPuzzle } from './lethalPuzzles'

// 講堂實練 —— 兵法讲堂第一次能上手。
//
// 讲堂现在是一本**只能读的手册**:五十多条词条讲清楚了规则,但玩家读完
// 「陣型只加左右紧邻的两名友军」之后,仍然要等到某一局真的抽到那张牌
// 才知道它到底怎么用。而第十九、二十卡包一口气加了兵种/阵型/战场/传承四条新轴,
// 每一条都比关键词难懂一档。
//
// 实练借的是**斩杀谜题那整条管线**:残局构造器给局面、solveLethal 当验证器、
// 谜题模式的对局通道负责「结束回合即判负、不记战绩」。所以这里只是一批
// LethalPuzzle,外加一个 `mechanic` 字段把它挂到讲堂对应的词条上。
//
// 出题原则:**这一题的唯一解必须用到那条机制**。
// 阵型那题如果把旗官摆在最右边就差 2 点伤害 —— 差的那 2 点就是这一课。
export interface Lesson extends LethalPuzzle {
  mechanic: string // 对应 codex.ts 里的 entry id
}

export const LESSONS: Lesson[] = [
  {
    id: 'lesson-formation',
    mechanic: 'formation',
    title: { zh: '實練 · 陣型', en: 'Drill · Formation' },
    situation: {
      zh: '两队铁骑在前,旗官在手。敌主帅 8 血,你只打得出 4 点。',
      en: 'Two units of cavalry, a standard bearer in hand, and an enemy at 8 HP you can only hit for 4.',
    },
    hint: {
      zh: '旗官只照顾左右紧邻的两个 —— 所以他站在哪儿,是这一题的全部。',
      en: 'The bearer helps only those immediately beside him. Where he stands is the whole puzzle.',
    },
    difficulty: 1,
    heroes: ['liu-bei', 'cao-cao'],
    scenario: {
      activePlayer: 0,
      players: [
        {
          heroHp: 20,
          mana: 4,
          board: [{ defId: 'token-tie-qi' }, { defId: 'token-tie-qi' }],
          hand: ['gen-formation-standard'],
        },
        { heroHp: 8, mana: 0, board: [], hand: [] },
      ],
    },
  },
  {
    id: 'lesson-field',
    mechanic: 'field',
    title: { zh: '實練 · 戰場', en: 'Drill · Field' },
    situation: {
      zh: '两队铁骑摆在平原上,敌主帅 8 血。手里那张牌不打人,它改的是地形。',
      en: 'Two units of cavalry on open ground, an enemy at 8 HP, and a card that damages no one — it changes the ground.',
    },
    hint: {
      zh: '战场对双方同时生效 —— 但这一手对面场上没人,便宜全是你的。',
      en: 'A field affects both sides — but the enemy has nothing on the board right now.',
    },
    difficulty: 1,
    heroes: ['liu-bei', 'cao-cao'],
    scenario: {
      activePlayer: 0,
      players: [
        {
          heroHp: 20,
          mana: 3,
          board: [{ defId: 'token-tie-qi' }, { defId: 'token-tie-qi' }],
          hand: ['strat-field-steppe'],
        },
        { heroHp: 8, mana: 0, board: [], hand: [] },
      ],
    },
  },
  {
    id: 'lesson-troop',
    mechanic: 'troop',
    title: { zh: '實練 · 兵種', en: 'Drill · Troops' },
    situation: {
      zh: '三名弓弩在阵,敌将结阵挡在前面。万箭齐发的伤害由你的弓弩数量决定。',
      en: 'Three archers in line and a guard in the way. The volley scales with how many archers you have.',
    },
    hint: {
      zh: '先算清楚你有几个弓弩 —— 那个数字乘以二,就是能射出去的伤害。',
      en: 'Count your archers first: twice that number is what the volley deals.',
    },
    difficulty: 2,
    heroes: ['liu-bei', 'cao-cao'],
    scenario: {
      activePlayer: 0,
      players: [
        {
          heroHp: 20,
          mana: 4,
          board: [{ defId: 'wang-xiu' }, { defId: 'sun-qian' }, { defId: 'yuan-shang' }],
          hand: ['strat-troop-volley'],
        },
        // 这三名弓弩的攻击共 6 点,所以对面 6 血。
        // 教具卡的身材在 overrides/pack19.ts 的 LESSON_STAT_PINS 里**钉死** ——
        // 它们是生成卡,一次播种改动就会把身材换掉,这一课当场无解(闸门抓到过)。
        { heroHp: 6, mana: 0, board: [{ defId: 'token-danyang-bing' }], hand: [] },
      ],
    },
  },
  // ---- 第二批:第四/五卡包那几条轴 ----
  // 上面三课恰好是第十九、二十包最新的三条,而伏兵、连击、过载、抉择、发现
  // ——**六条更早、也更常见的机制**——一课都没有。讲堂有 32 条机制词条,
  // 实练只覆盖 3 条,等于这个系统上线之后就没再铺过。
  // 【为什么没有伏兵那一课】
  // 试过,被 lethalContent.test 那道闸门挡回来了:「lesson-secret 无解」。
  // 想想是对的 —— 伏兵在**对手回合**才触发,而实练借的是斩杀谜题的管线:
  // 你一结束回合就判负,对手根本没有回合。也就是说这个框架天然教不了
  // 任何「等对手动」的机制(伏兵、亡语的部分用法、回合结束触发)。
  // 要教它们得另起一套「两回合谜题」,那是另一个工程。
  {
    id: 'lesson-combo',
    mechanic: 'combo',
    title: { zh: '實練 · 連擊', en: 'Drill · Combo' },
    situation: {
      zh: '一名铁骑已经能冲脸,但一名 4 血守卫挡在前面。田忌的战吼打 1 点 —— 除非这回合先打过别的牌。',
      en: 'Your cavalry can swing, but a 4-HP guard blocks the way. Tian Ji\u2019s battlecry deals 1 — unless you played another card first this turn.',
    },
    hint: {
      zh: '连击看的是**这回合此前打过牌没有**,不是打了什么牌。顺序反了就差 3 点,守卫拆不掉。',
      en: 'Combo only asks whether you played anything earlier this turn — not what. Wrong order and you are 3 short of clearing the guard.',
    },
    difficulty: 2,
    heroes: ['liu-bei', 'cao-cao'],
    scenario: {
      activePlayer: 0,
      players: [
        {
          heroHp: 20,
          mana: 8,
          board: [{ defId: 'token-tie-qi' }, { defId: 'token-tie-qi' }],
          hand: ['hist-tian-ji', 'token-tie-qi'],
        },
        // 守卫必须先拆掉才能打脸 —— 而拆它正好要靠连击那 4 点。
        // 田忌的战吼只打**敌将**(chosenEnemyGeneral),打不到脸,
        // 所以这一题的斩杀线是「先出牌 → 连击拆守卫 → 铁骑冲脸」。
        { heroHp: 4, mana: 0, board: [{ defId: 'token-danyang-bing' }], hand: [] },
      ],
    },
  },
  {
    id: 'lesson-overload',
    mechanic: 'overload',
    title: { zh: '實練 · 過載', en: 'Drill · Overload' },
    situation: {
      zh: '铁骑已在阵,一名守卫挡路,敌主帅 4 血。彭越能一发拆掉守卫 —— 代价是下回合少一格法力。',
      en: 'Cavalry ready, a guard in the way, the enemy at 4 HP. Peng Yue clears the guard — at the cost of a crystal next turn.',
    },
    hint: {
      zh: '过载扣的是**下回合**的法力。而这一题里没有下回合 —— 该付就付。',
      en: 'Overload is a debt paid next turn. In this puzzle there is no next turn — so pay it.',
    },
    difficulty: 1,
    heroes: ['liu-bei', 'cao-cao'],
    scenario: {
      activePlayer: 0,
      players: [
        {
          heroHp: 20,
          mana: 6,
          board: [{ defId: 'token-tie-qi' }, { defId: 'token-tie-qi' }],
          hand: ['hist-peng-yue'],
        },
        // 彭越的战吼同样只打敌将(chosenEnemyGeneral),打不到脸 ——
        // 所以这一课的斩杀线是「付过载拆守卫 → 两队铁骑 4 点打脸」。
        { heroHp: 4, mana: 0, board: [{ defId: 'token-danyang-bing' }], hand: [] },
      ],
    },
  },
]

export const LESSONS_BY_ID: Record<string, Lesson> = Object.fromEntries(
  LESSONS.map((l) => [l.id, l]),
)

export function lessonForMechanic(mechanic: string): Lesson | undefined {
  return LESSONS.find((l) => l.mechanic === mechanic)
}
