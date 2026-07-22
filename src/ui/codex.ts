// 兵法讲堂的内容:关键词、机制、对局规则、难度档。
//
// 为什么是一份可翻的手册,而不是「教学第二课」:
// 教程是一次性的,而玩家需要查规则的时刻是**随机出现的** ——
// 抽到一张写着「連擊」的牌、被伏兵翻了一次、想不起守护到底强制什么。
// 一次性的第二课教完就没了,手册永远在那儿。
//
// 每条尽量挂一张卡池里的真卡当例子:规则描述再准确,不如给他看一张牌。
import type { CardDef, LocalizedText } from '../engine/types'
import { COLLECTIBLE_CARDS } from '../content/cards'

export interface CodexEntry {
  id: string
  term: LocalizedText
  rule: LocalizedText
  // 展开后的补充:容易搞错的地方、和别的规则怎么互动
  note?: LocalizedText
  // 例卡:从真实卡池里按谓词挑第一张,挑不到就不显示
  example?: (c: CardDef) => boolean
}

export interface CodexSection {
  id: string
  title: LocalizedText
  entries: CodexEntry[]
}

const kw = (k: string) => (c: CardDef) => c.keywords.includes(k as CardDef['keywords'][number])

export const CODEX: CodexSection[] = [
  {
    id: 'keywords',
    title: { zh: '关键词', en: 'Keywords' },
    entries: [
      {
        id: 'charge',
        term: { zh: '衝鋒 Charge', en: 'Charge' },
        rule: { zh: '登场当回合即可攻击,包括直接攻击敌方主公。', en: 'Can attack the turn it is played, including the enemy hero.' },
        note: {
          zh: '和突襲的唯一区别就是「能不能打脸」。冲锋是把手牌里的伤害直接变成脸上的伤害,所以定价最贵。',
          en: 'The only difference from Rush is whether it may hit the hero — which is why Charge costs the most.',
        },
        example: kw('charge'),
      },
      {
        id: 'rush',
        term: { zh: '突襲 Rush', en: 'Rush' },
        rule: { zh: '登场当回合即可攻击,但只能攻击敌方武将。', en: 'Can attack the turn it is played, but only enemy generals.' },
        example: kw('rush'),
      },
      {
        id: 'guard',
        term: { zh: '守護 Guard', en: 'Guard' },
        rule: { zh: '只要场上有守护武将,敌方就必须先攻击它。', en: 'While a Guard is on the field, the enemy must attack it first.' },
        note: {
          zh: '强制的是攻击,不是效果 —— 锦囊和战吼照样能越过守护点到后面的人。潜行的守护不产生强制(它根本不能被选中)。',
          en: 'It only forces attacks. Stratagems and battlecries still reach past it. A stealthed Guard forces nothing — it cannot be targeted at all.',
        },
        example: kw('guard'),
      },
      {
        id: 'windfury',
        term: { zh: '連擊 Windfury', en: 'Windfury' },
        rule: { zh: '每回合可以攻击两次。', en: 'May attack twice each turn.' },
        note: {
          zh: '注意和「連擊(Combo)」不是一回事 —— 那个说的是同一回合打出的第二张牌。',
          en: 'Not to be confused with Combo, which is about the second card you play in a turn.',
        },
        example: kw('windfury'),
      },
      {
        id: 'duel',
        term: { zh: '單挑 Duel', en: 'Duel' },
        rule: { zh: '打出时可以指定一名敌将,立刻对决一次。', en: 'On play, may challenge an enemy general to an immediate duel.' },
        note: {
          zh: '攻高者先手,一击致死就不吃反击;同攻则同时互击。不消耗攻击次数 —— 单挑完这一回合它还能再打一次。',
          en: 'The higher attack strikes first and takes no counter if it kills. Equal attack means simultaneous. It does not use the attack for the turn.',
        },
        example: kw('duel'),
      },
      {
        id: 'lifesteal',
        term: { zh: '吸血 Lifesteal', en: 'Lifesteal' },
        rule: { zh: '此武将造成伤害时,我方主公回复等量生命。', en: 'Damage it deals also heals your hero for the same amount.' },
        example: kw('lifesteal'),
      },
      {
        id: 'poison',
        term: { zh: '劇毒 Poison', en: 'Poison' },
        rule: { zh: '战斗中被它伤到的武将立即死亡。', en: 'Any general it damages in combat is destroyed.' },
        note: {
          zh: '穿不过铁壁:铁壁吃掉整次打击时,剧毒也一并被挡下。',
          en: 'It does not pierce a Divine Shield — if the shield absorbs the hit, the poison is absorbed with it.',
        },
        example: kw('poison'),
      },
      {
        id: 'divineShield',
        term: { zh: '鐵壁 Divine Shield', en: 'Divine Shield' },
        rule: { zh: '完整挡下一次伤害,然后消失。', en: 'Ignores the first damage it would take, then breaks.' },
        note: {
          zh: '挡的是一次,不是一点 —— 一次 10 点和一次 1 点挡下来是一样的。所以用小怪去点掉铁壁永远是对的。',
          en: 'It blocks one instance, not one point: a 10-damage hit and a 1-damage hit both just break it. Popping it with something small is always right.',
        },
        example: kw('divineShield'),
      },
      {
        id: 'stealth',
        term: { zh: '潛行 Stealth', en: 'Stealth' },
        rule: { zh: '不能被攻击也不能被指定为目标,直到它自己出手。', en: 'Cannot be attacked or targeted until it attacks.' },
        example: kw('stealth'),
      },
    ],
  },
  {
    id: 'mechanics',
    title: { zh: '机制', en: 'Mechanics' },
    entries: [
      {
        id: 'battlecry',
        term: { zh: '戰吼 Battlecry', en: 'Battlecry' },
        rule: { zh: '从手牌打出时触发一次。', en: 'Triggers once when played from hand.' },
        note: {
          zh: '只在从手牌打出时触发 —— 被召唤、被弹回后再上场都不算。',
          en: 'Only from hand. Summoned copies and re-played bounced minions do not re-trigger.',
        },
        example: (c) => c.battlecry !== undefined,
      },
      {
        id: 'deathrattle',
        term: { zh: '亡語 Deathrattle', en: 'Deathrattle' },
        rule: { zh: '此武将死亡时触发。', en: 'Triggers when this general dies.' },
        note: { zh: '被沉默之后不再触发。', en: 'Silence removes it.' },
        example: (c) => c.deathrattle !== undefined,
      },
      {
        id: 'aura',
        term: { zh: '光環 Aura', en: 'Aura' },
        rule: { zh: '只要来源在场,持续给范围内的武将加成。', en: 'A continuous buff to nearby generals while the source is on the field.' },
        note: {
          zh: '来源一离场加成立刻收回,而且可以因此死人 —— 靠光环撑着的 1 血单位会跟着一起走。这一点和「临时增益到期」不同,那个不会杀人。',
          en: 'When the source leaves, the buff is withdrawn immediately and this can kill — unlike a temporary buff expiring, which never does.',
        },
        example: (c) => c.aura !== undefined,
      },
      {
        id: 'secret',
        term: { zh: '伏兵 Secret', en: 'Secret' },
        rule: { zh: '打出后不结算,埋在主帅面板旁;由对手的动作触发才翻开。', en: 'Played face-down beside your hero. It resolves only when the opponent does something specific.' },
        note: {
          zh: '三类触发:敌方武将发起攻击时、敌方武将登场后、敌方使用锦囊后。一次动作最多翻一个,先埋的先触发。同名伏兵不能重复埋。对手只看得到你埋了几个,看不到是什么。',
          en: 'Three triggers: an enemy attacks, an enemy general is played, or an enemy stratagem resolves. One per action, oldest first. No duplicates. The opponent sees only the count.',
        },
        example: (c) => c.secret !== undefined,
      },
      {
        id: 'combo',
        term: { zh: '連擊 Combo', en: 'Combo' },
        rule: { zh: '本回合此牌之前已经打出过牌时,改用另一套效果。', en: 'If you already played a card this turn, this card uses a different effect instead.' },
        note: {
          zh: '是「改用」不是「叠加」。出牌顺序因此有了意义:同样两张牌,先后颠倒结果可能完全不同。',
          en: 'It replaces, not stacks. Play order matters: the same two cards in the other order can play out completely differently.',
        },
        example: (c) => c.combo !== undefined,
      },
      {
        id: 'overload',
        term: { zh: '過載 Overload', en: 'Overload' },
        rule: { zh: '现在超模,下回合开始时锁掉对应数量的水晶。', en: 'Overpowered now; locks that many crystals at the start of your next turn.' },
        note: {
          zh: '只锁一回合,不会累积到再下一回合。打出时不扣当回合的水晶 —— 借的是下一回合的。',
          en: 'Locked for one turn only, never compounding. It costs nothing this turn — you are borrowing from the next one.',
        },
        example: (c) => (c.overload ?? 0) > 0,
      },
      {
        id: 'choose',
        term: { zh: '抉擇 Choose One', en: 'Choose One' },
        rule: { zh: '一张牌两个模式,打出时当场选一个。', en: 'A card with two modes; pick one as you play it.' },
        note: {
          zh: '和連擊不同:連擊由「是不是第二张牌」自动决定,抉择永远是你现选。同样一张牌,选法不同,局势就不同。',
          en: 'Unlike Combo (decided automatically by play order), Choose One is always your call — the same card plays differently depending on the mode.',
        },
        example: (c) => c.choose !== undefined,
      },
      {
        id: 'discover',
        term: { zh: '發現 Discover', en: 'Discover' },
        rule: { zh: '亮出三张牌,挑一张加入手牌。', en: 'Reveal three cards; add one of them to your hand.' },
        note: {
          zh: '让每一局抽到的答案都不一样 —— 缺解场就找解场,缺大哥就找大哥。对手只看得到你在发现,看不到亮的是哪三张。',
          en: 'Every game plays out differently: find the answer you need. The opponent sees that you are discovering, but not the three cards.',
        },
        example: (c) => JSON.stringify(c).includes('"discover"'),
      },
      {
        id: 'reduceCost',
        term: { zh: '費用消減', en: 'Cost Reduction' },
        rule: { zh: '有些牌让你手牌里的某类牌变便宜(永久)。', en: 'Some cards make a category of cards in your hand cheaper — permanently.' },
        note: {
          zh: '这是 build-around 的地基:「使你手牌中所有锦囊/同势力/武将 -1 费」,一张牌能定义一整副的费用曲线。折后价在卡面变绿。',
          en: 'The backbone of build-around decks: one card can define your whole curve. Discounted cards show their price in green.',
        },
        example: (c) => JSON.stringify(c).includes('reduceCost'),
      },
      {
        id: 'generate',
        term: { zh: '牌生成', en: 'Card Generation' },
        rule: { zh: '有些牌凭空生成牌加入你的手牌。', en: 'Some cards create new cards directly into your hand.' },
        note: {
          zh: '价值/工具箱流的燃料:靠源源不断的牌把牌差滚成胜势。生成的牌手满会烧掉。',
          en: 'Fuel for value decks: keep the cards flowing and grind out an advantage. Generated cards burn if your hand is full.',
        },
        example: (c) => JSON.stringify(c).includes('addToHand'),
      },
      {
        id: 'dynasty',
        term: { zh: '勢力羈絆 Dynasty', en: 'Dynasty Synergy' },
        rule: { zh: '有些卡会数你场上「同势力」的武将,越多越强。', en: 'Some cards count your same-dynasty generals — the more you field, the stronger they get.' },
        note: {
          zh: '每张卡都有势力(魏/蜀/吴/春秋/唐…),这是主义之外的第二条构筑轴。三国势力池子小,靠「势力召集」的衍生物(虎豹骑/白毦兵/丹阳兵)撑起来;大池(春秋/唐)本身就够厚。围绕一个势力堆牌,羁绊 payoff 会滚雪球。',
          en: 'Every card has a dynasty — a second deckbuilding axis beyond doctrine. The Three Kingdoms pools are small, propped up by "muster" tokens; the big eras (Spring & Autumn, Tang) are deep on their own. Stack one dynasty and the payoffs snowball.',
        },
        example: (c) =>
          JSON.stringify(c).includes('friendlyDynasty') || JSON.stringify(c).includes('ifDynastyCount'),
      },
      {
        id: 'spellDamage',
        term: { zh: '法術傷害', en: 'Spell Damage' },
        rule: { zh: '在场时,我方锦囊造成的伤害增加。', en: 'While on the field, your stratagems deal extra damage.' },
        note: { zh: '只加成锦囊 —— 战吼和主公技吃不到。', en: 'Stratagems only. Battlecries and Hero Powers do not benefit.' },
        example: (c) => (c.spellDamage ?? 0) > 0,
      },
      {
        id: 'silence',
        term: { zh: '沉默 Silence', en: 'Silence' },
        rule: { zh: '清空一名武将的所有附魔与关键词,并封印它的亡语与光环。', en: 'Strips all buffs, keywords, deathrattles and auras from a general.' },
        note: {
          zh: '沉默永远不会直接杀死人:被沉默的单位血量会截断到至少 1。',
          en: 'Silence never kills on its own — health is clamped to at least 1.',
        },
      },
      {
        id: 'freeze',
        term: { zh: '凍結 Freeze', en: 'Freeze' },
        rule: { zh: '被冻结的武将跳过下一次行动。', en: 'A frozen general skips its next action.' },
        note: {
          zh: '解冻发生在持有者的回合结束时,不是回合开始 —— 否则在对手回合冻他,他一开局就化了,等于没冻。',
          en: 'It thaws at the end of its owner’s turn, not the start — otherwise freezing on the opponent’s turn would do nothing.',
        },
      },
    ],
  },
  {
    id: 'rules',
    title: { zh: '对局规则', en: 'Match Rules' },
    entries: [
      {
        id: 'mana',
        term: { zh: '法力水晶', en: 'Mana' },
        rule: { zh: '每回合上限 +1,最多 10;回合开始时补满。', en: 'Your maximum grows by one each turn up to ten, and refills at the start of your turn.' },
      },
      {
        id: 'board',
        term: { zh: '场面上限', en: 'Board Limit' },
        rule: { zh: '每方最多同时有 6 名武将在场,满了就打不出新武将。', en: 'Six generals per side. While full, you cannot play more.' },
      },
      {
        id: 'hand',
        term: { zh: '手牌上限', en: 'Hand Limit' },
        rule: { zh: '手牌上限 10 张,超出的抽牌会被直接烧掉。', en: 'Ten cards. Anything drawn beyond that is burned.' },
      },
      {
        id: 'fatigue',
        term: { zh: '疲勞', en: 'Fatigue' },
        rule: { zh: '牌库抽空后每次抽牌都会对自己造成伤害,而且逐次递增。', en: 'Once your deck is empty, each draw damages your own hero, increasing every time.' },
        note: {
          zh: '主帅面板上的 ▤ 是牌库余量,少于 5 会变色。长局的胜负经常是这个数字决定的,不是场面。',
          en: 'The ▤ counter on the hero plate is your deck size; it changes colour below five. Long games are often decided by this number, not the board.',
        },
      },
      {
        id: 'heroPower',
        term: { zh: '主公技', en: 'Hero Power' },
        rule: { zh: '每回合可用一次,六个主义各不相同。', en: 'Once per turn. Each of the six doctrines has its own.' },
        note: {
          zh: '它是全场触发频率最高的效果 —— 三十个回合累积下来,一点强度差会被放大成压倒性优势。',
          en: 'It is the most frequently used effect in the game; across thirty turns a small edge compounds into a decisive one.',
        },
      },
    ],
  },
  {
    id: 'difficulty',
    title: { zh: '敌手档位', en: 'Opponent Levels' },
    entries: [
      {
        id: 'recruit',
        term: { zh: '新兵', en: 'Recruit' },
        rule: { zh: '经常失误,而且看不见多步斩杀 —— 你血量再低它也未必抓得住。', en: 'Blunders often and cannot see multi-step lethal — it may miss the kill even when you are low.' },
      },
      {
        id: 'veteran',
        term: { zh: '宿将', en: 'Veteran' },
        rule: { zh: '偶尔失误,同样不算多步斩杀。默认档位。', en: 'Occasional blunders, still no lethal search. The default.' },
      },
      {
        id: 'general',
        term: { zh: '名将', en: 'General' },
        rule: { zh: '零失误、必算斩杀,而且会预判你下一回合能打它多少 —— 它不会在自己会被一波带走的场面上贪血。', en: 'No blunders, always finds lethal, and weighs what you can swing back next turn — it will not greedily take face damage when that lets you kill it.' },
      },
    ],
  },
]

// 给一条词条挑一张例卡。按 collectorNo 取第一张,所以每次进来都一样。
export function exampleFor(entry: CodexEntry): CardDef | undefined {
  if (!entry.example) return undefined
  let best: CardDef | undefined
  for (const c of COLLECTIBLE_CARDS) {
    if (!entry.example(c)) continue
    if (!best || c.collectorNo < best.collectorNo) best = c
  }
  return best
}
