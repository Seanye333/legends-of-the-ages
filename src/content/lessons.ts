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
        { heroHp: 6, mana: 0, board: [{ defId: 'token-danyang-bing' }], hand: [] },
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
