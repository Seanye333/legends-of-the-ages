// 新手教程:条件驱动的引导步骤。
// 设计原则 —— 不脚本化「第几回合做什么」(调度与 AI 有随机性,硬脚本必然崩),
// 而是每一步给一个「何时出现」与「何时算完成」的谓词,玩家怎么打都跟得上。
import type { GameEvent, GameState } from '../engine/types'
import { useCollection } from '../app/collectionStore'
import { PRECON_DECKS } from '../content/decks'
import type { StartMatchArgs } from '../app/matchStore'

export interface TutorialStep {
  id: string
  title: { zh: string; en: string }
  body: { zh: string; en: string }
  // 出现条件(未给 = 一直可出现)
  when?: (state: GameState) => boolean
  // 自动完成条件(未给 = 需玩家点「明白了」)
  until?: (state: GameState, seen: SeenFlags) => boolean
}

// 整局累计过的事件特征(单批事件会被冲掉,这里做累积)
export interface SeenFlags {
  attacked: boolean
  dueled: boolean
  playedGeneral: boolean
  playedStratagem: boolean
  equipped: boolean
}

export const EMPTY_SEEN: SeenFlags = {
  attacked: false,
  dueled: false,
  playedGeneral: false,
  playedStratagem: false,
  equipped: false,
}

export function accumulateSeen(seen: SeenFlags, events: GameEvent[]): SeenFlags {
  let next = seen
  const mark = (key: keyof SeenFlags) => {
    if (!next[key]) next = { ...next, [key]: true }
  }
  for (const ev of events) {
    if (ev.type === 'AttackResolved' && ev.attacker === 0) mark('attacked')
    if (ev.type === 'DuelFought' && ev.challenger === 0) mark('dueled')
    if (ev.type === 'GeneralSummoned' && ev.player === 0) mark('playedGeneral')
    if (ev.type === 'EffectTriggered' && ev.player === 0 && ev.kind === 'spell') mark('playedStratagem')
    if (ev.type === 'EquipmentAttached' && ev.player === 0) mark('equipped')
  }
  return next
}

const myTurn = (s: GameState) => s.phase === 'main' && s.activePlayer === 0

export const TUTORIAL_STEPS: TutorialStep[] = [
  {
    id: 'welcome',
    title: { zh: '欢迎入局', en: 'Welcome' },
    body: {
      zh: '这是一场教学对局。你执刘备,目标只有一个:把对方主公的 30 点生命打到 0。左下角是你的主帅,上方是敌方主帅。',
      en: 'A practice match. You play Liu Bei. One goal: bring the enemy hero from 30 to 0. Your hero sits bottom-left, the enemy above.',
    },
  },
  {
    id: 'mulligan',
    title: { zh: '第一步:调度', en: 'Step 1: Mulligan' },
    body: {
      zh: '开局先调度:点掉贵的牌把它们换走,留下低费卡才能早开局。选完点「确认」。',
      en: 'Tap the expensive cards to swap them away — keep cheap ones so you can act early. Then confirm.',
    },
    when: (s) => s.phase === 'mulligan',
    until: (s) => s.phase !== 'mulligan',
  },
  {
    id: 'mana',
    title: { zh: '法力与费用', en: 'Mana' },
    body: {
      zh: '每回合法力上限 +1(最多 10),回合开始时回满。卡牌左上角的数字就是它的费用 —— 费用不够的牌是暗的,点不动。',
      en: 'Your mana cap grows by 1 each turn (max 10) and refills at the start of your turn. The number on a card’s top-left is its cost; cards you can’t afford stay dimmed.',
    },
    when: (s) => myTurn(s) && s.turn >= 1,
  },
  {
    id: 'play',
    title: { zh: '打出武将', en: 'Play a general' },
    body: {
      zh: '点一张亮着的武将牌把他派上场。武将有「攻击力 / 生命值」两个数值,上场当回合通常不能行动(所谓「疲劳」)。',
      en: 'Tap a lit general card to deploy them. Generals have attack and health; most can’t act the turn they arrive.',
    },
    when: myTurn,
    until: (_s, seen) => seen.playedGeneral,
  },
  {
    id: 'endturn',
    title: { zh: '结束回合', en: 'End your turn' },
    body: {
      zh: '没牌可出、没仗可打时,点右侧的「结束回合」交给对手。对手行动完自动轮回你。',
      en: 'When you’re done, hit End Turn on the right. Control returns to you after the opponent acts.',
    },
    when: myTurn,
    until: (s) => s.turn >= 3,
  },
  {
    id: 'attack',
    title: { zh: '发起攻击', en: 'Attack' },
    body: {
      zh: '先点自己场上带绿光的武将(表示可攻击),再点敌方武将或敌方主帅即可开打。攻击武将时双方同时互相造成伤害。',
      en: 'Tap one of your generals with a green glow, then tap an enemy general or the enemy hero. Attacking a general means both sides trade damage.',
    },
    when: (s) => myTurn(s) && s.players[0].board.some((c) => !c.exhausted && c.attack > 0),
    until: (_s, seen) => seen.attacked,
  },
  {
    id: 'guard',
    title: { zh: '守护', en: 'Guard' },
    body: {
      zh: '敌方场上出现带【守】的武将时,你必须先解决他,才能攻击其他目标或敌方主帅。你自己的守护武将同理保护着你。',
      en: 'While the enemy has a general with Guard, you must deal with them before hitting anything else — and your own Guards protect you the same way.',
    },
    when: (s) => s.players[1].board.some((c) => c.keywords.includes('guard')),
  },
  {
    id: 'duel',
    title: { zh: '单挑', en: 'Duel' },
    body: {
      zh: '带【单】的武将打出时,可以直接点一名敌将强制对决:双方按攻击力互击,攻高者先手 —— 一击致命就不吃反伤。这是本作的招牌机制。',
      en: 'A general with Duel can challenge an enemy general on arrival. Both strike by attack value; the stronger strikes first, and a lethal first blow takes no counter. This is the signature mechanic.',
    },
    when: (s) => s.players[0].hand.some((c) => c.keywords.includes('duel')),
  },
  {
    id: 'inspect',
    title: { zh: '看不懂就长按', en: 'Long-press to inspect' },
    body: {
      zh: '任何一张牌或场上武将,长按(手机)或按住(鼠标)就能看到全身立绘、效果说明与关键词图例。',
      en: 'Long-press any card or general on the board to see the full art, its text, and what each keyword does.',
    },
    when: (s) => myTurn(s) && s.turn >= 4,
  },
  {
    id: 'finish',
    title: { zh: '接下来靠你了', en: 'Over to you' },
    body: {
      zh: '规则你已经全会了。把敌方主帅打到 0 点即获胜 —— 胜利还能拿卡包。祝武运昌隆!',
      en: 'That’s all the rules. Drop the enemy hero to 0 to win — and win a card pack while you’re at it. Good hunting!',
    },
    when: (s) => myTurn(s) && s.turn >= 6,
  },
]

// 教学对局:固定种子 + 刘备/曹操预组,保证每次开局手感一致。
export const TUTORIAL_SEED = 20260719

export function tutorialMatchArgs(): StartMatchArgs {
  const mine = PRECON_DECKS[0]
  const foe = PRECON_DECKS[1]
  return {
    heroIds: [mine.heroId, foe.heroId],
    deckIds: [mine.cardIds.slice(), foe.cardIds.slice()],
    seed: TUTORIAL_SEED,
  }
}

// 是否该主动邀请玩家走教程:没打过任何一局的新账号
export function shouldOfferTutorial(): boolean {
  if (tutorialDone()) return false
  const { wins, losses } = useCollection.getState()
  return wins + losses === 0
}

const DONE_KEY = 'qiangu-tutorial-done'

export function tutorialDone(): boolean {
  try {
    return localStorage.getItem(DONE_KEY) === '1'
  } catch {
    return false
  }
}

export function markTutorialDone(): void {
  try {
    localStorage.setItem(DONE_KEY, '1')
  } catch {
    /* 忽略 */
  }
}
