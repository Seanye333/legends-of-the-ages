// 斩杀谜题:给定残局,玩家须在本回合内找出一条 lethal 击杀对手。
//
// 每道题都是手工设计、用真实卡池的卡摆出的确定残局(走 GameConfig.scenario)。
// heroId/主公技由 heroes 字段查 HEROES_BY_ID 得到 —— 与远征/乱斗一致,残局本身只管场面。
// **正确性由 lethalContent.test.ts 用求解器逐题守门**:每题必须「有解」(solveLethal 非空)
// 且「非平凡」(trivialFaceLethal 为假 —— 不能只把现成场面砸脸就赢)。改题先跑那个测试。
//
// 所有题都刻意避开随机效果,故 seed 无关紧要。
import type { LocalizedText, PuzzleScenario, GameConfig } from '../engine/types'
import { HEROES_BY_ID } from './overrides/heroes'

export interface LethalPuzzle {
  id: string
  title: LocalizedText
  situation: LocalizedText // 一句话情境
  hint: LocalizedText // 一句话提示(点方向,不直接给解)
  difficulty: 1 | 2 | 3 // 一星直球 / 二星需一层转折 / 三星需组合多张资源
  heroes: [string, string] // [我方 heroId, 敌方 heroId]
  scenario: PuzzleScenario
}

// 从谜题定义组出一个可对局的 GameConfig(测试与 UI 共用,单一真相源)。
export function puzzleGameConfig(puzzle: LethalPuzzle, seed = 1): GameConfig {
  return {
    seed,
    heroIds: puzzle.heroes,
    deckIds: [[], []],
    first: puzzle.scenario.activePlayer,
    heroPowers: [HEROES_BY_ID[puzzle.heroes[0]]?.power, HEROES_BY_ID[puzzle.heroes[1]]?.power],
    scenario: puzzle.scenario,
  }
}

export const LETHAL_PUZZLES: LethalPuzzle[] = [
  // ---------- 一星:一层直球,各教一个基本手段 ----------
  {
    id: 'lp-windfury',
    title: { zh: '風助火勢', en: 'Fan the Flames' },
    situation: { zh: '夏侯惇孤军压境,敌主帅尚有 12 血。', en: 'Xiahou Dun stands alone; the enemy has 12 HP.' },
    hint: { zh: '一次攻击不够 —— 让它打两次。', en: 'One swing is not enough — let it strike twice.' },
    difficulty: 1,
    heroes: ['liu-bei', 'cao-cao'],
    scenario: {
      activePlayer: 0,
      players: [
        { heroHp: 20, mana: 2, board: [{ defId: 'xiahou-dun' }], hand: ['strat-jie-dongfeng'] },
        { heroHp: 12, mana: 0, board: [], hand: [] },
      ],
    },
  },
  {
    id: 'lp-charge',
    title: { zh: '白袍衝陣', en: 'Charge of the Vanguard' },
    situation: { zh: '你空有满费,手里握着西楚霸王。', en: 'Full mana in hand, and the Hegemon of Chu waiting.' },
    hint: { zh: '有些猛将,上场即可挥刀。', en: 'Some warriors can strike the turn they arrive.' },
    difficulty: 1,
    heroes: ['hist-laozi', 'sun-quan'],
    scenario: {
      activePlayer: 0,
      players: [
        { heroHp: 20, mana: 5, board: [], hand: ['hist-xiang-yu'] },
        { heroHp: 8, mana: 0, board: [], hand: [] },
      ],
    },
  },
  {
    id: 'lp-heropower',
    title: { zh: '唯才補刀', en: 'The Finishing Touch' },
    situation: { zh: '乐进、廖化齐出仍差一口气,敌主帅 9 血。', en: 'Le Jin and Liao Hua fall just short. Enemy at 9.' },
    hint: { zh: '别忘了每回合都能用的那一手。', en: "Don't forget the hand you can play every turn." },
    difficulty: 1,
    heroes: ['cao-cao', 'liu-bei'],
    scenario: {
      activePlayer: 0,
      players: [
        { heroHp: 20, mana: 2, board: [{ defId: 'le-jin' }, { defId: 'liao-hua' }], hand: [] },
        { heroHp: 9, mana: 0, board: [], hand: [] },
      ],
    },
  },

  // ---------- 二星:一层转折 ----------
  {
    id: 'lp-breakwall',
    title: { zh: '破壁一擊', en: 'Breach the Wall' },
    situation: { zh: '张士诚立于阵前守护,身后主帅仅 6 血。', en: 'Zhang Shicheng guards the line; behind him, 6 HP.' },
    hint: { zh: '先拆墙,再登门。', en: 'Tear down the wall before you knock.' },
    difficulty: 2,
    heroes: ['liu-bei', 'sun-quan'],
    scenario: {
      activePlayer: 0,
      players: [
        { heroHp: 20, mana: 0, board: [{ defId: 'gao-shun' }, { defId: 'zhang-liao' }], hand: [] },
        { heroHp: 6, mana: 0, board: [{ defId: 'hist-zhang-shicheng' }], hand: [] },
      ],
    },
  },
  {
    id: 'lp-buffreach',
    title: { zh: '偷天換日', en: 'Steal the Sky' },
    situation: { zh: '马超差两点就能一击致命,敌主帅 8 血。', en: 'Ma Chao is two short of lethal. Enemy at 8.' },
    hint: { zh: '给他补上那两点攻击。', en: 'Lend him the two attack he lacks.' },
    difficulty: 2,
    heroes: ['sun-quan', 'guo-jia'],
    scenario: {
      activePlayer: 0,
      players: [
        { heroHp: 20, mana: 3, board: [{ defId: 'ma-chao' }], hand: ['strat-tou-liang-huan-zhu'] },
        { heroHp: 8, mana: 0, board: [], hand: [] },
      ],
    },
  },
  {
    id: 'lp-gowide',
    title: { zh: '揭竿百萬', en: 'Rally the Millions' },
    situation: { zh: '五路义军刚集结、都还没缓过劲,敌主帅 5 血。', en: 'Five bands just mustered, none ready to move. Enemy at 5.' },
    hint: { zh: '打不动手,不代表使不上劲 —— 人多就是伤害。', en: 'They cannot swing, but their number is the weapon.' },
    difficulty: 2,
    heroes: ['sima-yi', 'hist-laozi'],
    scenario: {
      activePlayer: 0,
      players: [
        {
          heroHp: 20,
          mana: 4,
          board: [
            { defId: 'zuo-ci', exhausted: true },
            { defId: 'zhang-zhongjing', exhausted: true },
            { defId: 'cui-zhouping', exhausted: true },
            { defId: 'pang-degong', exhausted: true },
            { defId: 'huang-chengyan', exhausted: true },
          ],
          hand: ['strat-sep-warcry'],
        },
        { heroHp: 5, mana: 0, board: [], hand: [] },
      ],
    },
  },
  {
    id: 'lp-massbuff',
    title: { zh: '三軍用命', en: 'The Whole Army Obeys' },
    situation: { zh: '三员小将攻势平平,合力也只有 6 点,敌主帅 12 血。', en: 'Three minor officers muster only 6 attack. Enemy at 12.' },
    hint: { zh: '一道令下,全军皆强。', en: 'One command lifts the entire line.' },
    difficulty: 2,
    heroes: ['hist-confucius', 'cao-cao'],
    scenario: {
      activePlayer: 0,
      players: [
        {
          heroHp: 20,
          mana: 3,
          board: [{ defId: 'wu-pu' }, { defId: 'ruan-xian' }, { defId: 'hist-tian-pian' }],
          hand: ['strat-hao-ling'],
        },
        { heroHp: 12, mana: 0, board: [], hand: [] },
      ],
    },
  },

  // ---------- 三星:需要组合多张资源 ----------
  {
    id: 'lp-twowalls',
    title: { zh: '雙牆夾擊', en: 'Two Walls' },
    situation: { zh: '刘璋与段干木两道守护,身后主帅只剩 5 血。', en: 'Two guards, Liu Zhang and Duangan Mu; 5 HP behind them.' },
    hint: { zh: '算清谁去拆墙、谁去登门。', en: 'Decide who breaks the walls and who breaks through.' },
    difficulty: 3,
    heroes: ['hist-laozi', 'liu-bei'],
    scenario: {
      activePlayer: 0,
      players: [
        {
          heroHp: 20,
          mana: 0,
          board: [{ defId: 'hist-xiang-yu' }, { defId: 'gao-shun' }, { defId: 'ma-chao' }],
          hand: [],
        },
        {
          heroHp: 5,
          mana: 0,
          board: [{ defId: 'liu-zhang' }, { defId: 'hist-duangan-mu' }],
          hand: [],
        },
      ],
    },
  },
  {
    id: 'lp-combo',
    title: { zh: '風火連斬', en: 'Twin Winds' },
    situation: { zh: '赵云一骑当先,但敌主帅厚达 16 血。', en: 'Zhao Yun leads the charge, but the enemy has 16 HP.' },
    hint: { zh: '既要更重的一刀,也要更多的刀。', en: 'You need a heavier blow — and more of them.' },
    difficulty: 3,
    heroes: ['sun-quan', 'sima-yi'],
    scenario: {
      activePlayer: 0,
      players: [
        {
          heroHp: 20,
          mana: 5,
          board: [{ defId: 'zhao-yun' }],
          hand: ['strat-tou-liang-huan-zhu', 'strat-jie-dongfeng'],
        },
        { heroHp: 16, mana: 0, board: [], hand: [] },
      ],
    },
  },
  {
    id: 'lp-threeway',
    title: { zh: '絕地反擊', en: 'Last Gambit' },
    situation: { zh: '乐进在场,手中一道锦囊,主公技尚存 —— 敌主帅 10 血。', en: 'Le Jin on board, a stratagem in hand, hero power ready. Enemy at 10.' },
    hint: { zh: '场面、锦囊、主公技,一样都不能省。', en: 'Board, stratagem, hero power — spend all three.' },
    difficulty: 3,
    heroes: ['hist-zhu-xi', 'cao-cao'],
    scenario: {
      activePlayer: 0,
      players: [
        { heroHp: 20, mana: 5, board: [{ defId: 'le-jin' }], hand: ['strat-weiwei-jiuzhao'] },
        { heroHp: 10, mana: 0, board: [], hand: [] },
      ],
    },
  },

  // ---------- 第二批:更多招式 ----------
  {
    id: 'lp-massrush',
    title: { zh: '雷霆突進', en: 'Thunder Advance' },
    situation: { zh: '三员新募之将尚未缓过神,敌主帅 9 血。', en: 'Three freshly-mustered officers, not yet ready. Enemy at 9.' },
    hint: { zh: '一道军令,让全军当场能战。', en: 'One command lets the whole line strike now.' },
    difficulty: 2,
    heroes: ['hist-laozi', 'sun-quan'],
    scenario: {
      activePlayer: 0,
      players: [
        {
          heroHp: 20,
          mana: 4,
          board: [
            { defId: 'yuan-shang', exhausted: true },
            { defId: 'niu-fu', exhausted: true },
            { defId: 'cai-mao', exhausted: true },
          ],
          hand: ['strat-hegemon-blitz'],
        },
        { heroHp: 9, mana: 0, board: [], hand: [] },
      ],
    },
  },
  {
    id: 'lp-windping',
    title: { zh: '風怒點殺', en: 'Windfury Finish' },
    situation: { zh: '马超一骑,配上唯才是举的点杀 —— 敌主帅 13 血。', en: 'Ma Chao alone, plus a hero-power ping. Enemy at 13.' },
    hint: { zh: '多打的那一下之外,还差一点点。', en: 'Even the extra swing leaves you just short.' },
    difficulty: 3,
    heroes: ['cao-cao', 'liu-bei'],
    scenario: {
      activePlayer: 0,
      players: [
        { heroHp: 20, mana: 4, board: [{ defId: 'ma-chao' }], hand: ['strat-jie-dongfeng'] },
        { heroHp: 13, mana: 0, board: [], hand: [] },
      ],
    },
  },
  {
    id: 'lp-pofu',
    title: { zh: '破釜沉舟', en: 'Burn the Boats' },
    situation: { zh: '赵云差三点,而你不惜代价 —— 敌主帅 9 血。', en: 'Zhao Yun is three short, and you will pay any price. Enemy at 9.' },
    hint: { zh: '拼一把 —— 自伤换来的攻击也是攻击。', en: 'Go all in — attack bought with your own blood still kills.' },
    difficulty: 2,
    heroes: ['sun-quan', 'sima-yi'],
    scenario: {
      activePlayer: 0,
      players: [
        { heroHp: 20, mana: 3, board: [{ defId: 'zhao-yun' }], hand: ['strat-pofu-chenzhou'] },
        { heroHp: 9, mana: 0, board: [], hand: [] },
      ],
    },
  },
  {
    id: 'lp-beishui',
    title: { zh: '背水一戰', en: 'Back to the River' },
    situation: { zh: '高顺在场,一道锦囊能再添两分力 —— 敌主帅 9 血。', en: 'Gao Shun on board, one stratagem lends two more. Enemy at 9.' },
    hint: { zh: '给他加上那两点。', en: 'Grant him the two attack he needs.' },
    difficulty: 2,
    heroes: ['guo-jia', 'cao-cao'],
    scenario: {
      activePlayer: 0,
      players: [
        { heroHp: 20, mana: 3, board: [{ defId: 'gao-shun' }], hand: ['strat-beishui-yizhan'] },
        { heroHp: 9, mana: 0, board: [], hand: [] },
      ],
    },
  },
  {
    id: 'lp-doubleburn',
    title: { zh: '火上澆油', en: 'Twin Flames' },
    situation: { zh: '手中两道火计,空无一兵 —— 敌主帅 7 血。', en: 'Two firebolts in hand, not a soldier in sight. Enemy at 7.' },
    hint: { zh: '不靠场面 —— 两道锦囊足矣。', en: 'No board needed — two stratagems suffice.' },
    difficulty: 2,
    heroes: ['hist-laozi', 'liu-bei'],
    scenario: {
      activePlayer: 0,
      players: [
        { heroHp: 20, mana: 7, board: [], hand: ['strat-weiwei-jiuzhao', 'strat-andu-chencang'] },
        { heroHp: 7, mana: 0, board: [], hand: [] },
      ],
    },
  },
  {
    id: 'lp-gowide2',
    title: { zh: '三軍壓城', en: 'The Host Descends' },
    situation: { zh: '四员小将齐出,合力平平 —— 敌主帅 17 血。', en: 'Four minor officers, unremarkable alone. Enemy at 17.' },
    hint: { zh: '一道军令,四人皆强。', en: 'One command lifts all four at once.' },
    difficulty: 2,
    heroes: ['sima-yi', 'hist-laozi'],
    scenario: {
      activePlayer: 0,
      players: [
        {
          heroHp: 20,
          mana: 3,
          board: [
            { defId: 'wu-pu' },
            { defId: 'ruan-xian' },
            { defId: 'hist-tian-pian' },
            { defId: 'zuo-ci' },
          ],
          hand: ['strat-hao-ling'],
        },
        { heroHp: 17, mana: 0, board: [], hand: [] },
      ],
    },
  },
]

export const LETHAL_PUZZLES_BY_ID: Record<string, LethalPuzzle> = Object.fromEntries(
  LETHAL_PUZZLES.map((p) => [p.id, p]),
)
