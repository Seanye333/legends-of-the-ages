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
        term: { zh: '風怒 Windfury', en: 'Windfury' },
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
      {
        id: 'trample',
        term: { zh: '碾壓 Trample', en: 'Trample' },
        rule: { zh: '攻击武将时,超过其当前生命的伤害穿透到敌方主公。', en: 'When attacking a general, damage beyond its current health carries through to the enemy hero.' },
        note: {
          zh: '大身材的终结器:守护挡得住攻击,挡不住溢出 —— 一个 8 攻的碾压怪打掉 3 血的守护,还有 5 点糊在脸上。两个坑:被铁壁完整挡下时不穿透(整下伤害都没了);剧毒不叠加穿透 —— 穿的是「你打了多少」,不是「它死没死」,1 攻剧毒秒杀 5 血也不会穿 4 点。',
          en: 'A finisher for big bodies: Guard stops the attack, not the spillover — an 8-attack trampler into a 3-health Guard still lands 5 on the face. Two catches: a Divine Shield that absorbs the hit stops it entirely; and Poison does not stack with it — trample counts damage dealt, not whether the target died, so a 1-attack poisoner killing 5 health tramples nothing.',
        },
        example: kw('trample'),
      },
      {
        id: 'disarm',
        term: { zh: '繳械 Disarm', en: 'Disarm' },
        rule: { zh: '不能发起攻击。身材、光环、亡语一概不变。', en: 'Cannot attack. Stats, auras and deathrattles are unchanged.' },
        note: {
          zh: '和冻结的区别是**它不会自己解开** —— 冻结在持有者回合结束时化掉,缴械要么被沉默清掉、要么一直在。所以它解的不是「这一回合」,是那名武将的余生。',
          en: 'Unlike Freeze it never wears off — a frozen general thaws at end of turn, a disarmed one stays disarmed until silenced. It answers a general for the rest of the game, not for a turn.',
        },
        example: kw('disarm'),
      },
      {
        id: 'siege',
        term: { zh: '攻城 Siege', en: 'Siege' },
        rule: { zh: '攻击**主公**时额外造成 2 点伤害;攻击武将时不加。', en: 'Deals 2 extra damage when attacking a hero — not when attacking generals.' },
        note: {
          zh: '它是一条纯粹的推脸词条:换血时一点用都没有。所以带攻城的单位通常身材偏硬 —— 对手不去解它,它每回合就多啃 2 点。',
          en: 'A pure face-damage keyword: worth nothing in trades. Siege bodies are usually tough, so ignoring one costs two extra damage every turn.',
        },
        example: kw('siege'),
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
          en: 'Only from hand. Summoned copies and re-played bounced generals do not re-trigger.',
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
        id: 'onAttack',
        term: { zh: '攻擊後 On Attack', en: 'On Attack' },
        rule: { zh: '此武将发起一次攻击、并在互击后仍存活时触发。', en: 'Triggers after this general attacks — but only if it survives the exchange.' },
        note: {
          zh: '奖励「主动出手」,天生和衝鋒/突襲咬合:落地就能咬一口,咬完就有回报(抽牌、+1/+1、放血、铺场)。两个坑:被反击打死就不触发(死人不结算),单挑不算「攻击」也不触发。',
          en: 'Rewards attacking, and pairs naturally with Charge/Rush — land, bite, and get paid (draw, +1/+1, chip damage, a token). Two catches: if the counter-attack kills it, nothing triggers; and a Duel is not an “attack”, so it does not fire it either.',
        },
        example: (c) => c.onAttack !== undefined,
      },
      {
        id: 'onSpellCast',
        term: { zh: '施法 On Spellcast', en: 'On Spellcast' },
        rule: { zh: '你每打出一个锦囊,带此机制的友方武将各触发一次。', en: 'Each time you cast a stratagem, your generals with this trigger once.' },
        note: {
          zh: '法术流的引擎:堆一把廉价锦囊,一回合内反复喂 —— 通神越滚越大,纵火一片火雨。只吃**你自己**的锦囊,对手施法不触发。发现类锦囊(会挂起选择的)不触发,那次施法算没走完。',
          en: 'The engine for spell decks: pile up cheap stratagems and feed them in a single turn. It only triggers on YOUR stratagems, not the opponent’s. A discover stratagem (which suspends for a choice) does not trigger it — that cast is not considered complete.',
        },
        example: (c) => c.onSpellCast !== undefined,
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
        id: 'troop',
        term: { zh: '兵種 Troop', en: 'Troop' },
        rule: {
          zh: '每名武将都属于一个兵种:騎兵 / 步卒 / 弓弩 / 水軍 / 器械 / 謀士。',
          en: 'Every general belongs to one troop type: Cavalry, Infantry, Archers, Navy, Siege, or Advisor.',
        },
        note: {
          zh: '势力与主义回答「他是谁那边的」,兵种回答「他在战场上干什么」。兵种由卡面自己决定(带冲锋的是骑兵、带守护的是步卒、开场就能打人的是远程),同一张卡永远是同一个兵种。池中占比:骑兵 25% · 谋士 26% · 步卒 16% · 弓弩 13% · 器械 10% · 水军 9% —— 稀有的兵种,协同卡给的倍率也更高。',
          en: 'Faction and doctrine say whose side a general is on; troop says what they do on the field. It is derived from the card itself and never changes. Rarer troops get stronger payoffs.',
        },
        example: (c) => c.troop === 'navy',
      },
      {
        id: 'formation',
        term: { zh: '陣型 Formation', en: 'Formation' },
        rule: {
          zh: '只作用于**左右紧邻**的两名友军的光环。',
          en: 'An aura that affects only the allies immediately to the left and right.',
        },
        note: {
          zh: '这是全游戏唯一让「摆在哪儿」有意义的机制 —— 别的效果都不看出场顺序。所以阵型卡有两层决策:先想清楚谁站它旁边,再防着对手把中间那个杀掉(阵型来源一死,两边的增益立刻收回,可能连着死人)。',
          en: 'The only mechanic where board position matters. Plan who stands beside it — and remember that killing the source withdraws the buff from both neighbours at once.',
        },
        example: (c) => c.aura?.scope === 'adjacent',
      },
      {
        id: 'field',
        term: { zh: '戰場 Field', en: 'Field' },
        rule: {
          zh: '布在战场上的持续规则(天时地利),**双方同吃**,同时只有一片。',
          en: 'A lasting rule laid on the battlefield itself. It applies to BOTH players, and only one can be active.',
        },
        note: {
          zh: '战场不是你的技能,是这一局的天气与地形 —— 你布下赤壁烈焰,烧的是双方全场。所以它本身不是优势,是**赌局**:收益来自「我这套牌不怕烧,你那套怕」。后布的战场直接覆盖前一片,包括对手布的。',
          en: 'A field is weather and terrain, not a spell you own: the fires burn both sides. The value comes from your deck minding it less than theirs. A new field replaces the old one, whoever laid it.',
        },
        example: (c) => (c.spell?.ops ?? []).some((o) => o.op === 'setField'),
      },
      {
        id: 'bond',
        term: { zh: '羈絆 Bond', en: 'Bond' },
        rule: {
          zh: '几位有真实历史渊源的名将同时在场时,他们一起获得加成。',
          en: 'When several historically connected generals share the field, they all gain a buff.',
        },
        note: {
          zh: '走的是光环那条路 —— 所以有人被杀、被策反、被弹回手牌,羁绊立刻断,加成也立刻收回(可能因此死人)。构筑器的羁绊面板会告诉你还差谁。**六套预组一条都凑不齐**,羁绊是留给自组卡组的奖励。',
          en: 'It runs on the aura path: kill, seize, or bounce one member and the bond breaks at once, taking the buff with it (which can be lethal). The deck builder tells you who is missing. None of the six preconstructed decks completes one — bonds are a reward for building your own.',
        },
        example: (c) => c.bond !== undefined,
      },
      {
        id: 'rival',
        term: { zh: '宿敵 Rival', en: 'Rival' },
        rule: {
          zh: '历史上真打过的两个人分处敌我两侧时,**双方**都获得加成。',
          en: 'When two historical adversaries face each other across the field, BOTH of them gain a buff.',
        },
        note: {
          zh: '羁绊的镜面:羁绊问「谁和谁是一伙的」,宿敌问「谁和谁真的打过」。加成给双方,所以它本身不是优势 —— 是一场戏。同一对人可以既是羁绊又是宿敌:孙膑与庞涓同侧是同门,异侧是马陵道。',
          en: 'The mirror of a bond. Bonds ask who stood together; rivals ask who actually fought. Both sides gain, so it is drama rather than advantage. The same pair can be both: Sun Bin and Pang Juan are fellow students on one side of the field, and the road at Maling on opposite sides.',
        },
        example: (c) => c.rival !== undefined,
      },
      {
        id: 'clan',
        term: { zh: '家族 Clan', en: 'Clan' },
        rule: {
          zh: '同一家族的两名**不同**武将同时在我方场上时,该家族全员各 +1/+1。',
          en: 'While two different generals of the same house share your field, every member of that house on it gains +1/+1.',
        },
        note: {
          zh: '族谱不是按姓氏猜的,是从生平原文里抠的:「夏侯惇之從弟」「關羽長子」「馬良之弟」—— 所以**同姓未必同族**,張遼不在張飛那一族里。卡面会写这一族共有多少人,点开列传能看全名单。同一个人的两张牌不算一族(那是同一个人)。',
          en: 'Lineage is read from the biographies, not guessed from surnames — so a shared surname is not a clan: Zhang Liao is not of Zhang Fei\'s house. The card states how many kinsmen exist; the dossier lists them. Two copies of one general do not count — that is one person.',
        },
        example: (c) => c.clan !== undefined,
      },
      {
        id: 'comrade',
        term: { zh: '同袍 Comrades', en: 'Comrades-in-Arms' },
        rule: {
          zh: '有些卡会数你场上「与他同赴过一场战役」的武将,越多越强。',
          en: 'Some cards count the generals on your field who fought beside them in a recorded battle — the more, the stronger.',
        },
        note: {
          zh: '名单不是设计出来的,是**从生平原文里反查的**:传里点到「赤壁」的人就是赤壁那一仗的人(24 场、150 人次,列传的「索引 · 戰役」页可以通览)。势力和兵种是我们划的分组,同袍不是 —— 它本来就写在史书里。数人头时不含自己。',
          en: 'The rosters are not designed — they are read back out of the chronicles: whoever\u2019s biography names Red Cliffs fought at Red Cliffs (24 battles, 150 entries; browse them under Chronicles → Index → Battles). Doctrine and troop type are groupings we invented; this one was already in the histories. The general itself is not counted.',
        },
        example: (c) => JSON.stringify(c).includes('friendlyBattle'),
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
        id: 'damagePer',
        term: { zh: '缩放伤害', en: 'Scaling Damage' },
        rule: { zh: '有些爆发牌的伤害随你场上武将数(或某类)增长。', en: 'Some finishers deal damage that scales with how many generals you field.' },
        note: { zh: '铺场流的终结:「对敌方主公造成伤害 = 你的武将数」。铺得越宽,一击越狠。', en: 'The go-wide payoff: the wider your board, the harder the blow.' },
        example: (c) => JSON.stringify(c).includes('damagePer'),
      },
      {
        id: 'swapStats',
        term: { zh: '移形換位 Swap', en: 'Swap Stats' },
        rule: { zh: '交换一个武将的攻击与生命。', en: 'Swap a general’s Attack and Health.' },
        note: {
          zh: '两个用法:把敌方 8/1 的猛攻怪换成 1/8 拆掉它的牙;或把自己的 1/8 铁壁换成 8/1 突然拍脸。伤害会留着 —— 挨过刀的换完仍带伤。',
          en: 'Two uses: turn an enemy 8/1 into a 1/8 to draw its fangs, or flip your own 1/8 wall into an 8/1 surprise. Existing damage stays — a wounded general is still wounded after the swap.',
        },
        example: (c) => JSON.stringify(c).includes('swapStats'),
      },
      {
        id: 'transform',
        term: { zh: '變形 Transform', en: 'Transform' },
        rule: { zh: '把一个武将原地变成另一张牌(通常是弱小的 1/1)。', en: 'Turn a general into something else (usually a weak 1/1) in place.' },
        note: {
          zh: '硬解的另一条路:再大的大哥变成 1/1 羔羊也就没了。而且变形**不是死亡** —— 不触发亡语,也不会进墓地被复生。',
          en: 'Another answer to big threats: even a giant becomes a 1/1. Transform is not death — no deathrattle, and it cannot be resurrected.',
        },
        example: (c) => JSON.stringify(c).includes('transform'),
      },
      {
        id: 'seize',
        term: { zh: '策反 Seize', en: 'Seize' },
        rule: {
          zh: '把一名敌方武将夺到你的场上,归你指挥。',
          en: 'Take control of an enemy general — it joins your side.',
        },
        note: {
          zh: '场面差二的一手:敌方少一个、你多一个,所以定价很贵。夺来的单位**当回合不能动**(不附赠冲锋),身上的伤与增益原样带走。**你满场时策反不会发生**,目标留在原处 —— 别指望用它当解场。',
          en: 'A two-body swing — they lose one, you gain one, which is why it costs so much. The seized unit cannot act this turn, and keeps its damage and buffs. If your board is full, nothing happens and the target stays put — do not count on it as removal.',
        },
        example: (c) => JSON.stringify(c).includes('seize'),
      },
      {
        id: 'stealCard',
        term: { zh: '反間 Steal a Card', en: 'Steal a Card' },
        rule: {
          zh: '从对手手牌里随机取走一张,收进你自己的手牌。',
          en: "Take a random card from your opponent's hand into yours.",
        },
        note: {
          zh: '走的是**牌差**而不是场面:对手 -1 张、你 +1 张,但当下的场面一点没变。拿到的是随机一张,可能正是他攒的关键牌,也可能是张废牌。你满手时那张会被烧掉 —— 但它照样离开了对手。',
          en: "A card-advantage swing rather than a board swing: they lose one, you gain one, but the board is untouched. It is random — sometimes their key card, sometimes junk. If your hand is full it burns, but it still leaves their hand.",
        },
        example: (c) => JSON.stringify(c).includes('stealCard'),
      },
      {
        id: 'copyGeneral',
        term: { zh: '疑兵 Decoy', en: 'Decoy' },
        rule: {
          zh: '在你的场上复制一名友方武将,照**卡面**造(不带伤、不带增益)。',
          en: 'Summon a copy of a friendly general at its printed stats — no damage, no buffs.',
        },
        note: {
          zh: '第三条路:不换场面、不换牌差,而是把你最好的那张牌**再打一次**。照卡面复制是刻意的 —— 若连增益一起复制,「先 buff 再复制」就能无限滚雪球;照卡面则上限恒等于那张牌本身,好定价。你满场时不复制。',
          en: 'A third axis: not a board swap or a card swap, but playing your best card twice. Copying base stats is deliberate — copying buffs too would let you buff-then-copy for a runaway snowball. If your board is full, nothing is summoned.',
        },
        example: (c) => JSON.stringify(c).includes('copyGeneral'),
      },
      {
        id: 'banish',
        term: { zh: '放逐 Banish', en: 'Banish' },
        rule: {
          zh: '把一名武将移出战场。这**不算死亡**:不触发亡语,也不进墓地。',
          en: 'Remove a general from play. This is not death — no deathrattle, and it never enters the graveyard.',
        },
        note: {
          zh: '专治亡语与复生:普通的「消灭」会把目标送进墓地,正好喂给复生;放逐则彻底带走,搜不到、拉不回。对付没有亡语的普通身材,它并不比消灭更好 —— 贵那一点买的是「精确解」。',
          en: 'The answer to deathrattles and resurrection: ordinary removal feeds the graveyard, which is exactly what those decks want. Banish takes the unit out of the game entirely. Against a plain body it is no better than destroy — the extra cost buys precision.',
        },
        example: (c) => JSON.stringify(c).includes('banish'),
      },
      {
        id: 'tutor',
        term: { zh: '求賢 Tutor', en: 'Tutor' },
        rule: {
          zh: '从你的牌库里检索一张**指定类型**的牌(武将/锦囊/装备)进入手牌。',
          en: 'Search your deck for a card of a given type (general / stratagem / equipment) and take it into hand.',
        },
        note: {
          zh: '抽牌看天,求贤看你缺什么:缺解场就搜锦囊,缺身材就搜武将。和「搜将」的区别在落点 —— 搜将直接把人拉上场抢节奏,求贤只进手,换来的是选择权和一个回合的缓冲。手牌满了会烧掉。',
          en: 'Drawing is luck; tutoring answers what you lack — a stratagem for removal, a general for a body. The difference from Recruit is where it lands: Recruit puts the unit straight onto the board for tempo, while Tutor puts the card in hand, buying choice instead. It burns if your hand is full.',
        },
        example: (c) => JSON.stringify(c).includes('tutor'),
      },
      {
        id: 'recruit',
        term: { zh: '搜將 Recruit', en: 'Recruit' },
        rule: { zh: '从你的牌库随机召唤武将直接上场。', en: 'Summon a random general straight from your deck.' },
        note: {
          zh: '越过费用曲线抢节奏:4 费可能拉出个 8 费大哥,也可能只拉个小兵 —— 高方差。所以它偏爱一副**武将密度高、身材扎实**的卡组,牌库越纯,搜出来越不亏。搜出来的牌从牌库里消失(不是复制)。',
          en: 'A tempo swing that leaps up the curve: for 4 mana you might pull an 8-drop — or a small body. High variance, so it rewards a deck dense with solid generals. The recruited card leaves your deck (it is not a copy).',
        },
        example: (c) => JSON.stringify(c).includes('recruit'),
      },
      {
        id: 'resurrect',
        term: { zh: '復生 Resurrect', en: 'Resurrect' },
        rule: { zh: '从墓地随机召回死去的友方武将。', en: 'Return random friendly generals that have died to the field.' },
        note: {
          zh: '亡语流与人海流的顶点:死得越多,复生越赚。变形/弹回手牌不进墓地,所以复不出来。',
          en: 'The payoff for deathrattle and swarm decks — the more that died, the more you get back. Transformed or bounced generals never enter the graveyard.',
        },
        example: (c) => JSON.stringify(c).includes('resurrect'),
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
        id: 'enrage',
        term: { zh: '激怒 Enrage', en: 'Enrage' },
        rule: { zh: '只要身上带伤,就获得额外攻击;治疗回满则收回。', en: 'Gains extra attack while damaged; healed back to full, it loses the bonus.' },
        note: {
          zh: '和「受创触发」不同:激怒是一个**持续状态**,跟着伤口在与不在,能反复开关,不是一次性触发。于是主动点自己一刀反而是收益 —— 越痛越猛。被沉默会一并抹掉;痊愈也会自动收回,别指望它一直挂着。',
          en: 'Unlike an on-damaged trigger, Enrage is a persistent state tied to whether the wound is there — it toggles on and off, it is not one-shot. So chipping your own general can be upside: the more it hurts, the harder it hits. Silence removes it, and healing to full takes it back.',
        },
        example: (c) => (c.enrage ?? 0) > 0,
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
      // ---- 第二十二卡包 ----
      {
        id: 'quest',
        term: { zh: '軍令狀 Quest', en: 'Quest' },
        rule: { zh: '打出后进军令区,达成目标才结算奖励。同时只能领一道。', en: 'Goes to your quest slot when played and pays out only when its goal is met. One at a time.' },
        note: {
          zh: '三种计数都是**你主动做的事**(打出锦囊 / 从手牌打出武将 / 斩杀敌将),不是场面上碰巧发生的事:召唤出来的衍生物不算点将,斩掉衍生物也不算斩将。领军令的那一张自己不算「用计」。',
          en: 'All three counters track what you choose to do — play stratagems, play generals from hand, kill enemy generals. Summoned tokens never count on either side, and the quest card itself is not a stratagem played.',
        },
        example: (c) => c.quest !== undefined,
      },
      {
        id: 'delay',
        term: { zh: '伏筆 Fuse', en: 'Fuse' },
        rule: { zh: '埋下一段效果,数个**我方回合**之后才结算。', en: 'Sets an effect that resolves after a number of your own turns.' },
        note: {
          zh: '计的是你自己的回合,不是双方的回合 —— 「2 回合后」意味着要熬过对手的两次进攻。伏笔对双方公开:主帅面板上的 ⧗ 就是它,对手能看见还剩几回合。',
          en: 'It counts your turns, not both players’ — “in 2 turns” means surviving two enemy turns. Fuses are public: the ⧗ pip on the hero plate shows the countdown to both sides.',
        },
        example: (c) =>
          [c.spell, c.battlecry, c.deathrattle].some((s) => s?.ops.some((o) => o.op === 'delay')),
      },
      {
        id: 'durability',
        term: { zh: '耐久 Durability', en: 'Durability' },
        rule: { zh: '带耐久的装备每逢持有者**发起攻击**扣 1,归零即损毁,加成一并收回。', en: 'Equipment with Durability loses one whenever its bearer attacks; at zero it breaks and its bonus is returned.' },
        note: {
          zh: '扣的是「发起攻击」而不是「造成伤害」—— 被反击、被伏兵化解、打空气都照扣。老卡池的装备没有耐久,永久有效。',
          en: 'It ticks on the swing, not on the damage: a blocked or countered attack still spends a point. Older equipment has no Durability and lasts forever.',
        },
        example: (c) => c.durability !== undefined,
      },
      {
        id: 'dispel',
        term: { zh: '驅散 Dispel', en: 'Dispel' },
        rule: { zh: '移除目标身上的全部附魔(增益与装备),但不封亡语、不清卡面词条。', en: 'Strips every enchantment and equipment from a general, leaving its deathrattle and printed keywords intact.' },
        note: {
          zh: '和沉默的分工:沉默是「把这张牌废掉」,驱散是「把加在它身上的东西拿走」。要解一把青龙偃月刀,驱散是精确的那一刀。驱散同样不杀人(血量截到至少 1)。',
          en: 'Silence removes what the card is; Dispel removes what was added to it. To answer a big weapon, Dispel is the precise tool. Like Silence, it never kills — health clamps to at least 1.',
        },
      },
      {
        id: 'borrow',
        term: { zh: '借將 Borrow', en: 'Borrow' },
        rule: { zh: '夺取一名敌将,他当回合可以立刻行动,你的回合结束时归还。', en: 'Take an enemy general; it can act immediately and returns at the end of your turn.' },
        note: {
          zh: '和策反的区别就在这一条:策反拿的是长期资产(所以当回合眩晕),借将拿的是**这一次冲锋**。归还时若原主场面已满,那名武将会被放逐 —— 借来的兵还不回去就散了。',
          en: 'Seize takes a lasting asset (and is exhausted on arrival); Borrow takes one attack. If the owner’s board is full when it returns, the general is banished instead.',
        },
      },
      {
        id: 'mill',
        term: { zh: '斷糧道 Mill', en: 'Mill' },
        rule: { zh: '把对方牌库顶的若干张直接送进墓地。', en: 'Sends cards from the top of a deck straight to the graveyard.' },
        note: {
          zh: '它不直接造成伤害,拨快的是疲劳那条计时器 —— 牌库空了以后每次抽牌都会自伤且逐次递增。另一条路子是让对手抽不到他要的那张关键牌。',
          en: 'It deals no damage; it winds the fatigue clock forward — once a deck is empty, every draw hurts more than the last. The other use is denying a specific answer.',
        },
      },
      {
        id: 'handGrowth',
        term: { zh: '手中成長 Growth in Hand', en: 'Growth in Hand' },
        rule: { zh: '每逢我方回合结束,这张牌**在手牌里**变大。', en: 'The card grows while it sits in your hand, at the end of each of your turns.' },
        note: {
          zh: '它把「现在打出去还是再等一回合」变成一个真问题 —— 而这是全卡池唯一一类会因为「你没打它」而变强的牌。增益走的是附魔层,所以打出去之后仍然带着。',
          en: 'It turns “play it now or wait” into a real decision — the only cards in the pool that reward not playing them. The growth is an enchantment, so it carries onto the board.',
        },
        example: (c) => c.handGrowth !== undefined,
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
          en: 'The ▤ counter on the hero plate is your deck size; it changes color below five. Long games are often decided by this number, not the board.',
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
        term: { zh: '新兵', en: 'Novice' },
        rule: { zh: '经常失误,而且看不见多步斩杀 —— 你血量再低它也未必抓得住。', en: 'Blunders often and cannot see multi-step lethal — it may miss the kill even when you are low.' },
      },
      {
        id: 'veteran',
        term: { zh: '宿将', en: 'Veteran' },
        rule: { zh: '偶尔失误,同样不算多步斩杀。默认档位。', en: 'Occasional blunders, still no lethal search. The default.' },
      },
      {
        id: 'general',
        term: { zh: '名将', en: 'Legend' },
        rule: { zh: '零失误、必算斩杀,而且会预判你下一回合能打它多少 —— 它不会在自己会被一波带走的场面上贪血。', en: 'No blunders, always finds lethal, and weighs what you can swing back next turn — it will not greedily take face damage when that lets you kill it.' },
      },
      // 军神此前**在设置里选得到、在讲堂里查不到** —— 四个档位讲了三个,
      // 而它恰好是唯一一个行为方式不同(而非只是更少失误)的档。
      {
        id: 'marshal',
        term: { zh: '军神', en: 'Marshal' },
        rule: { zh: '规划整个回合再落子,而不是一步一步挑当下最优的那一手。', en: 'Plans the whole turn before moving, instead of picking the best single move each time.' },
        note: {
          zh: '差别在于它看得见**先亏后赚**的组合:先用一张牌把你的守护弄走、再让大哥冲脸,这种两步棋名将档是看不见的(第一步单看是亏的)。实测对名将约七成胜率。',
          en: 'The difference is setups that lose value on the first move and win on the second — clearing a Guard so the big body can go face. Legend never sees those, because step one looks bad on its own. Measured around 70% against Legend.',
        },
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
