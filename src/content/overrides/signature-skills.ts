import type { CardDef } from '../../engine/types'

// 名将专属技 —— 给此前「有立绘、有风味、却没有技能」的签名卡补上本人的看家本事。
//
// 【为什么单独一层】
// signature.ts 里 233 张签名卡中有 100 张只写了身材与风味,一个效果都没有 ——
// 关羽、张飞、孙武、卫青、李靖、戚继光、徐达全在里面。它们是这游戏的门面,
// 却是清一色的白板身材。(此前它们看着「有技能」,那是生成层的效果从手写文本底下
// 漏上来的假象,见 cards.ts 的 reconcileExclusive 与 import-content 的 handAuthored。
// 漏洞堵上之后,这批卡的白板真相才露出来。)
//
// 不直接改 signature.ts:那份文件是「身材与风味的基线」,已经一千多行;
// 技能是另一件事,分层放,改起来也不必在一千行里找人。
//
// 【设计原则】
// 1. **技能必须是这个人真做过的事。** 卡池是两千多位真实历史人物,这是别家 CCG
//    拿不到的素材 —— 韩世忠给「冻结全场」是因为黄天荡困了金兵四十八天,
//    刘黑闼给「亡语召回旧部」是因为他半年内尽复窦建德故地。不是随手配的。
// 2. **要付账。** 效果按点数从身材里扣(1 攻 = 1 点、1 血 ≈ 1 点、关键词见 KEYWORD_POINTS)。
//    签名卡允许略高于白板曲线(赵云 7 费 6/6 冲锋 + 抽牌就超了 1 点),
//    但上限压在 statBudget(cost) + 2,不能靠「他是名将」白拿。
// 3. **别撞车。** 同一种效果最多给两个人,而且要给它最贴的那两个。
//
// 【暂不动的】
// · 乐进、廖化:斩杀谜题 lp-heropower 的盘面钉在这两张的身材上,改了谜题就无解。
//   (其余谜题的守将已经全部挪到衍生物上,见 lethalPuzzles.ts 的 lp-twowalls。)
//
// 【预组骨架 18 张:定价规则和上面那批不一样】
// 这批(张飞、张辽、孙策、许褚、颜真卿、王平、程普…)是六套预组的骨架,
// 定价不能照白板曲线算,只能**照矩阵反推** —— sim-balance 是唯一的验收标准。
// 实测踩到的两条:
//
// 1. **贪心 AI 换算不了效果。** 照曲线老老实实扣身材,魏武四张骨架同时被削,
//    总胜率从 47.4% 掉到 31.6%;而隐逸吃到「法术伤害+1」×2,在法术组里是乘法,
//    直接冲到 71.4%。给预组卡发效果,只能发**上场即改变场面**的那类
//    (点杀 / 铺场 / 加攻 / 激怒),而且要少扣身材。
// 2. **「共用骨架」根本不共用。** 王平/程普/陈到出现在 5 套预组各 2 张,
//    但**魏武只用了 2 个骨架卡位,鹰视用了 8 个** —— 给骨架发免费效果不是「一起平移」,
//    是精准补贴用得多的那几套、精准饿死魏武。所以骨架照价扣,补贴打在各主义自家卡上。
//
// 调完的矩阵:47.4 / 47.4 / 49.4 / 51.0 / 51.6 / 53.2,最极端对位 36%
// —— 比动手前(45.6~59.0)还紧。
export const SIGNATURE_SKILLS: Record<string, Partial<CardDef>> = {
  // ══════════════════ 先秦 ══════════════════
  // 兵法之祖。「其疾如风」——全军提速正是《孙子》的第一课。
  'hist-sun-wu': {
    attack: 6,
    health: 9,
    battlecry: { ops: [{ op: 'grantKeyword', keyword: 'rush', target: 'allFriendlyOthers' }] },
    text: {
      zh: '突襲。戰吼:使你的其他武將獲得突襲。其疾如風,侵掠如火。',
      en: 'Rush. Battlecry: Give your other generals Rush. Swift as wind, fierce as fire.',
    },
  },
  // 「非六十万人不可」——出兵就是倾国而出。
  'hist-wang-jian': {
    attack: 7,
    health: 7,
    battlecry: { ops: [{ op: 'recruit', count: 1 }] },
    text: {
      zh: '守護。戰吼:從牌庫隨機召喚一名武將。滅五國者,王翦父子;非六十萬人不可。',
      en: 'Guard. Battlecry: Summon a random general from your deck. Five of the six states fell to Wang Jian and his son — and he never marched with fewer than six hundred thousand.',
    },
  },
  // 长平前期坚壁三年不出,秦军无可奈何。老将的价值是让全军都扛得住。
  'hist-lian-po': {
    attack: 6,
    health: 7,
    aura: { scope: 'friendlyOthers', attack: 0, health: 2 },
    text: {
      zh: '守護。你的其他武將+0/+2。廉頗老矣,尚能飯否?',
      en: 'Guard. Your other generals have +0/+2. Old Lian Po can still eat — and still fight.',
    },
  },
  // 雁门一战破匈奴十万骑 —— 全场清扫,史上少有的一次歼灭战。
  'hist-li-mu': {
    attack: 6,
    health: 6,
    battlecry: { ops: [{ op: 'aoeDamage', amount: 3 }] },
    text: {
      zh: '突襲。戰吼:對所有敵方武將造成 3 點傷害。雁門設伏,一戰破匈奴十萬騎。李牧死,趙國亡。',
      en: 'Rush. Battlecry: Deal 3 damage to all enemy generals. His ambush at Yanmen broke a hundred thousand riders. When Li Mu died, Zhao followed.',
    },
  },
  // 毛遂自荐:锥处囊中,其末立见 —— 把埋没的人从袋子里挑出来。
  'hist-mao-sui': {
    attack: 3,
    health: 3,
    battlecry: { ops: [{ op: 'tutor', kind: 'general', count: 1 }] },
    text: {
      zh: '衝鋒。戰吼:從牌庫抽一張武將牌。錐處囊中,其末立見;按劍歷階,直上殿前。',
      en: 'Charge. Battlecry: Draw a general from your deck. An awl in a sack shows its point — sword in hand, he mounted the dais uninvited.',
    },
  },
  // 秦师闻其名而不加兵于魏 —— 不战而屈人之兵,对面这一手就是打不出来。
  'hist-duangan-mu': {
    attack: 2,
    health: 2,
    battlecry: { ops: [{ op: 'freeze', target: 'chosenEnemyGeneral' }] },
    text: {
      zh: '守護。戰吼:凍結一名敵方武將。踰垣而避,魏文侯過其閭必式;秦師聞之,不加兵於魏。',
      en: 'Guard. Battlecry: Freeze an enemy general. He climbed the wall to avoid office; the marquis bowed at his gate, and Qin declined to march.',
    },
  },

  // ══════════════════ 秦汉 ══════════════════
  // 直捣龙城:绕开外围,一头扎进单于王庭。人越多,捅得越深。
  'hist-wei-qing': {
    attack: 8,
    health: 7,
    battlecry: {
      ops: [{ op: 'damagePer', per: { kind: 'friendlyGenerals' }, amount: 1, target: 'enemyHero' }],
    },
    text: {
      zh: '突襲。戰吼:對敵方主公造成傷害,數量等於你的武將數。長平桓桓,直搗龍城。',
      en: 'Rush. Battlecry: Deal damage to the enemy hero equal to your general count. He struck straight at Longcheng.',
    },
  },
  // 北筑长城,却匈奴七百余里 —— 一道墙,后面的人都活得下去。
  'hist-meng-tian': {
    attack: 6,
    health: 6,
    aura: { scope: 'friendlyOthers', attack: 0, health: 1 },
    text: {
      zh: '守護。你的其他武將+0/+1。北築長城,卻匈奴七百餘里。',
      en: 'Guard. Your other generals have +0/+1. He raised the Great Wall and drove the Xiongnu seven hundred li north.',
    },
  },
  // 三十六人定西域,靠的是「以夷制夷」—— 把对方的人变成自己的人。
  'hist-ban-chao': {
    attack: 5,
    health: 5,
    battlecry: { ops: [{ op: 'seize', target: 'randomEnemyGeneral' }] },
    text: {
      zh: '突襲。戰吼:策反一名隨機敵方武將。不入虎穴,焉得虎子。投筆從戎,萬里封侯。',
      en: 'Rush. Battlecry: Take control of a random enemy general. Into the tiger’s den for the tiger’s cub — he traded the brush for the sword.',
    },
  },
  // 封狼居胥:长驱两千里,每一次接战都在往对方腹地更深处扎。
  'hist-huo-qubing': {
    onAttack: { ops: [{ op: 'damage', amount: 3, target: 'enemyHero' }] },
    text: {
      zh: '衝鋒。此武將攻擊後,對敵方主公造成 3 點傷害。封狼居胥,匈奴遠遁。',
      en: 'Charge. After this general attacks, deal 3 damage to the enemy hero. He sealed Mount Langjuxu and the Xiongnu fled.',
    },
  },
  // 飞将军之射,石棱没羽。
  'hist-li-guang': {
    attack: 5,
    health: 4,
    battlecry: { ops: [{ op: 'damage', amount: 3, target: 'chosenEnemyGeneral' }] },
    text: {
      zh: '碾壓。戰吼:對一名敵方武將造成 3 點傷害。飛將軍在,溢出之勢無人可擋。',
      en: 'Trample. Battlecry: Deal 3 damage to an enemy general. Where the Flying General strikes, the overflow cannot be held.',
    },
  },
  // 大泽乡:斩木为兵,揭竿为旗。
  'hist-wu-guang': {
    attack: 4,
    health: 3,
    battlecry: { ops: [{ op: 'summon', defId: 'token-xiangyong', count: 2 }] },
    text: {
      zh: '衝鋒。戰吼:召喚兩個 1/1 的鄉勇。「今亡亦死,舉大計亦死」——大澤鄉中,斬木為兵。',
      en: 'Charge. Battlecry: Summon two 1/1 Militia. Death for desertion, death for revolt — at Dazexiang they cut staves for spears.',
    },
  },
  // 叛楚叛汉,只认河东 —— 谁的东西他都要拿一点。
  'hist-wei-bao': {
    attack: 3,
    health: 3,
    battlecry: { ops: [{ op: 'stealCard', count: 1 }] },
    text: {
      zh: '突襲。戰吼:從對手手牌隨機取走一張。復魏地二十餘城而王之,叛楚叛漢,只認河東。',
      en: 'Rush. Battlecry: Take a random card from your opponent’s hand. He retook twenty cities of Wei and crowned himself — loyal only to Hedong.',
    },
  },
  // 并三齐之地:同乡越多，这面旗越硬。
  'hist-tian-rong': {
    attack: 4,
    health: 4,
    battlecry: {
      ops: [
        { op: 'buffPer', per: { kind: 'friendlyDynasty' }, attack: 1, health: 1, target: 'self' },
      ],
    },
    text: {
      zh: '守護。戰吼:每有一名同勢力友方武將,此武將+1/+1。並三齊之地拒霸王,楚兵頓於城下者累月。',
      en: 'Guard. Battlecry: Gain +1/+1 for each friendly general of the same faction. He fused the three Qi lands into one and stalled the Hegemon for months.',
    },
  },

  // ══════════════════ 三国两晋 ══════════════════
  // 温酒斩华雄:出手一次,酒还是温的。
  'guan-yu': {
    attack: 6,
    health: 6,
    battlecry: { ops: [{ op: 'damage', amount: 2, target: 'chosenEnemyGeneral' }] },
    text: {
      zh: '單挑。戰吼:對一名敵方武將造成 2 點傷害。溫酒斬將,千里走單騎。',
      en: 'Duel. Battlecry: Deal 2 damage to an enemy general. The Saint of War rides a thousand li alone.',
    },
  },
  // 闻鸡起舞 —— 别人还没醒,他已经在练了。
  'hist-zu-ti': {
    attack: 4,
    health: 4,
    battlecry: { ops: [{ op: 'grantKeyword', keyword: 'charge', target: 'chosenFriendlyGeneral' }] },
    text: {
      zh: '衝鋒。戰吼:使一名友方武將獲得衝鋒。聞雞起舞,中流擊楫:不清中原者,有如大江!',
      en: 'Charge. Battlecry: Give a friendly general Charge. He drilled at cockcrow and struck his oar mid-river: the Central Plains, or this river bears witness.',
    },
  },
  // 拔矢啖睛:父精母血不可弃 —— 受了伤反而更凶。
  'xiahou-dun': {
    attack: 5,
    health: 4,
    onDamaged: { ops: [{ op: 'buffStats', attack: 2, health: 0, target: 'self' }] },
    text: {
      zh: '突襲。此武將受傷後,獲得+2/+0。拔矢啖睛,父精母血不可棄。',
      en: 'Rush. After this general takes damage, it gains +2/+0. He plucked out the arrow and swallowed his own eye.',
    },
  },
  // 抬榇决死:棺材都带来了,死了也要拉一个。
  'pang-de': {
    attack: 6,
    health: 4,
    deathrattle: { ops: [{ op: 'damage', amount: 4, target: 'enemyHero' }] },
    text: {
      zh: '單挑。亡語:對敵方主公造成 4 點傷害。抬櫬決死,義不受辱。',
      en: 'Duel. Deathrattle: Deal 4 damage to the enemy hero. He carried his own coffin into battle.',
    },
  },
  // 陷阵营:所当者破,营阵没有挡得住的。
  'gao-shun': {
    attack: 6,
    health: 5,
    battlecry: { ops: [{ op: 'silence', target: 'chosenEnemyGeneral' }] },
    text: {
      zh: '衝鋒。戰吼:沉默一名敵方武將。陷陣之志,有死無生。',
      en: 'Charge. Battlecry: Silence an enemy general. The Camp Crushers know no retreat.',
    },
  },
  // 西凉铁骑,随他一起来。
  'ma-chao': {
    attack: 5,
    health: 5,
    battlecry: { ops: [{ op: 'summon', defId: 'token-tie-qi', count: 1 }] },
    text: {
      zh: '衝鋒。單挑。戰吼:召喚一個 2/2 的鐵騎。錦馬超,西涼鐵騎;葭萌關下,挑燈夜戰。',
      en: 'Charge. Duel. Battlecry: Summon a 2/2 Ironclad Rider. The Splendid Ma Chao dueled Zhang Fei by torchlight at Jiameng Pass.',
    },
  },
  // 定军山:一箭定胜负,老将的准头没退。
  'huang-zhong': {
    attack: 5,
    health: 4,
    battlecry: { ops: [{ op: 'damage', amount: 3, target: 'chosenEnemyGeneral' }] },
    text: {
      zh: '單挑。戰吼:對一名敵方武將造成 3 點傷害。定軍山前,老當益壯。',
      en: 'Duel. Battlecry: Deal 3 damage to an enemy general. At Mount Dingjun, age only sharpened his blade.',
    },
  },
  // 神亭岭酣斗,北海城下神射 —— 箭到人倒。
  'taishi-ci': {
    attack: 5,
    health: 4,
    battlecry: { ops: [{ op: 'damage', amount: 3, target: 'randomEnemyGeneral' }] },
    text: {
      zh: '碾壓。戰吼:對隨機一名敵方武將造成 3 點傷害。神射之勇,一往無前。',
      en: 'Trample. Battlecry: Deal 3 damage to a random enemy general. The peerless marksman charges through.',
    },
  },
  // 白衣渡江:兵不血刃取荆州 —— 不打，只是把人请走。
  'lu-meng': {
    attack: 4,
    health: 5,
    battlecry: { ops: [{ op: 'returnToHand', target: 'chosenEnemyGeneral' }] },
    text: {
      zh: '突襲。戰吼:將一名敵方武將移回其手牌。白衣渡江,兵不血刃取荊州。',
      en: 'Rush. Battlecry: Return an enemy general to its owner’s hand. In white robes he crossed the river and took Jingzhou without a fight.',
    },
  },
  // 洛阳井中得传国玺 —— 打着打着,捡到个东西。
  'sun-jian': {
    attack: 5,
    health: 4,
    battlecry: { ops: [{ op: 'discover', pool: 'myStratagem' }] },
    text: {
      zh: '衝鋒。戰吼:發現一張錦囊。江東猛虎,洛陽井中獨得傳國璽。',
      en: 'Charge. Battlecry: Discover a stratagem. The Tiger of Jiangdong drew the Imperial Seal from a Luoyang well.',
    },
  },
  // 白马义从:义之所至,生死相随。
  'gongsun-zan': {
    attack: 5,
    health: 5,
    battlecry: { ops: [{ op: 'summon', defId: 'token-tie-qi', count: 1 }] },
    text: {
      zh: '突襲。戰吼:召喚一個 2/2 的鐵騎。白馬義從,義之所至,生死相隨。',
      en: 'Rush. Battlecry: Summon a 2/2 Ironclad Rider. The White Horse Volunteers follow him past death.',
    },
  },
  // 坐保江汉十八年:不进取,但也真没让人打进来。
  'liu-biao': {
    attack: 4,
    health: 4,
    endOfTurn: { ops: [{ op: 'gainArmor', amount: 2 }] },
    text: {
      zh: '守護。在你的回合結束時,你的主公獲得 2 點護甲。單騎入宜城,坐保江漢十八年,帶甲十餘萬。',
      en: 'Guard. At the end of your turn, your hero gains 2 Armor. He rode alone into Yicheng and held the Han valley for eighteen years.',
    },
  },
  // 开城以免兵祸:他输了,城里的人活下来了。
  'liu-zhang': {
    attack: 2,
    health: 4,
    deathrattle: { ops: [{ op: 'heal', amount: 6, target: 'friendlyHero' }] },
    text: {
      zh: '守護。亡語:你的主公恢復 6 點生命。「父子在州二十餘年,無恩德以加百姓」——遂開城以免兵禍。',
      en: 'Guard. Deathrattle: Restore 6 Health to your hero. Twenty years in Yi Province, and in the end he opened the gates to spare his people.',
    },
  },
  // 关中十部,唯此老不死 —— 谁的盟他都反过,谁的东西他都拿过。
  'han-sui': {
    attack: 5,
    health: 4,
    battlecry: { ops: [{ op: 'stealCard', count: 1 }] },
    text: {
      zh: '突襲。戰吼:從對手手牌隨機取走一張。縱橫西涼三十餘年,關中十部,唯此老不死。',
      en: 'Rush. Battlecry: Take a random card from your opponent’s hand. Thirty years astride the Liang frontier — of the ten warlords, only he endured.',
    },
  },
  // 自立为辽东侯:同乡的人越多,这块地越是他的。
  'gongsun-du': {
    attack: 4,
    health: 4,
    battlecry: {
      ops: [
        { op: 'buffPer', per: { kind: 'friendlyDynasty' }, attack: 1, health: 1, target: 'self' },
      ],
    },
    text: {
      zh: '突襲。戰吼:每有一名同勢力友方武將,此武將+1/+1。自立為遼東侯、平州牧,東伐高句麗,西擊烏丸。',
      en: 'Rush. Battlecry: Gain +1/+1 for each friendly general of the same faction. He named himself Marquis of Liaodong and struck east and west as he pleased.',
    },
  },
  // 宛城一夜反戈:睡着的时候被捅了。
  'zhang-xiu': {
    attack: 5,
    health: 3,
    battlecry: { ops: [{ op: 'damage', amount: 3, target: 'randomEnemyGeneral' }] },
    text: {
      zh: '衝鋒。戰吼:對隨機一名敵方武將造成 3 點傷害。宛城一夜反戈,長子、愛將、駿馬,盡折於此。',
      en: 'Charge. Battlecry: Deal 3 damage to a random enemy general. One night at Wancheng cost Cao Cao his eldest son, his champion, and his horse.',
    },
  },
  // 广宗城破之日,无一人降 —— 人没了,旗还在。
  'zhang-liang-yt': {
    attack: 3,
    health: 3,
    deathrattle: { ops: [{ op: 'summon', defId: 'token-xiangyong', count: 2 }] },
    text: {
      zh: '守護。亡語:召喚兩個 1/1 的鄉勇。人公將軍死守廣宗,城破之日,無一人降。',
      en: 'Guard. Deathrattle: Summon two 1/1 Militia. The General of Men held Guangzong to the last; not one man surrendered.',
    },
  },
  // 身在曹营心在汉,终身不发一言 —— 那就谁也别说话。
  'xu-shu': {
    attack: 5,
    health: 4,
    battlecry: { ops: [{ op: 'silence', target: 'chosenEnemyGeneral' }] },
    text: {
      zh: '守護。戰吼:沉默一名敵方武將。身在曹營心在漢,一言不發亦護主。',
      en: 'Guard. Battlecry: Silence an enemy general. In Cao’s camp, his heart stayed with Han — silent, but steadfast.',
    },
  },
  // 治乱有数,君何必强求 —— 他不出山,但他看得很清楚。
  'cui-zhouping': {
    attack: 2,
    health: 3,
    battlecry: { ops: [{ op: 'discover', pool: 'myStratagem' }] },
    text: {
      zh: '戰吼:發現一張錦囊。談笑山林,不問興廢。「治亂有數,君何必強求?」',
      en: 'Battlecry: Discover a stratagem. Order and chaos each have their season — why force it, sir?',
    },
  },
  // 荷锸而行,「死便埋我」。
  'liu-ling': {
    attack: 3,
    health: 2,
    deathrattle: { ops: [{ op: 'draw', count: 1 }] },
    text: {
      zh: '亡語:抽一張牌。荷鍤而行,「死便埋我」;幕天席地,縱意所如。',
      en: 'Deathrattle: Draw a card. He travelled with a spade: bury me where I drop. Sky for a tent, earth for a mat.',
    },
  },
  // 一笔书连绵不绝:写得越多,笔势越盛。
  'hist-wang-xianzhi': {
    attack: 2,
    health: 2,
    onSpellCast: { ops: [{ op: 'buffStats', attack: 1, health: 1, target: 'self' }] },
    text: {
      zh: '連擊。每當你打出一張錦囊,此武將+1/+1。一筆書連綿不絕,大令與右軍,並稱二王。',
      en: 'Windfury. Whenever you play a stratagem, this general gains +1/+1. One unbroken stroke across the page — father and son, the Two Wangs.',
    },
  },
  // 人中吕布:挡在前面的一起碾过去。
  'lu-bu': {
    attack: 9,
    health: 6,
    keywords: ['duel', 'trample'],
    text: {
      zh: '單挑。碾壓。人中呂布,馬中赤兔。',
      en: 'Duel. Trample. Among men, Lu Bu; among horses, Red Hare.',
    },
  },
  // 古之恶来,死守辕门 —— 倒下时还挡在门口。
  'dian-wei': {
    attack: 5,
    health: 4,
    deathrattle: { ops: [{ op: 'aoeDamage', amount: 2 }] },
    text: {
      zh: '守護。亡語:對所有敵方武將造成 2 點傷害。古之惡來,死守轅門。',
      en: 'Guard. Deathrattle: Deal 2 damage to all enemy generals. The Evil Comes of old held the gate to his death.',
    },
  },
  // 汜水关前连斩上将 —— 先出手的那一个。
  'hua-xiong': {
    attack: 5,
    health: 3,
    battlecry: {
      ops: [{ op: 'buffStats', attack: 3, health: 0, target: 'self', duration: 'endOfTurn' }],
    },
    text: {
      zh: '單挑。戰吼:本回合此武將+3/+0。汜水關前連斬上將——直到那杯酒尚溫。',
      en: 'Duel. Battlecry: This general has +3/+0 this turn. He felled champion after champion — until the wine was still warm.',
    },
  },
  // 先声夺人:还没交手,对面主帅先掉血。
  'yan-liang': {
    attack: 5,
    health: 4,
    battlecry: { ops: [{ op: 'damage', amount: 2, target: 'enemyHero' }] },
    text: {
      zh: '衝鋒。戰吼:對敵方主公造成 2 點傷害。河北名將,先聲奪人。',
      en: 'Charge. Battlecry: Deal 2 damage to the enemy hero. Hebei’s champion strikes first.',
    },
  },
  // 火船冲阵:船到了,人也没了,整条江都在烧。
  'huang-gai': {
    attack: 4,
    health: 4,
    deathrattle: { ops: [{ op: 'aoeDamage', amount: 3 }] },
    text: {
      zh: '衝鋒。亡語:對所有敵方武將造成 3 點傷害。火船衝陣,苦肉建功。',
      en: 'Charge. Deathrattle: Deal 3 damage to all enemy generals. Fire ships ram the line.',
    },
  },
  // 雪中奋短兵:脱甲持刀,一鼓而上。
  'ding-feng': {
    attack: 5,
    health: 5,
    battlecry: {
      ops: [{ op: 'buffStats', attack: 2, health: 0, target: 'self', duration: 'endOfTurn' }],
    },
    text: {
      zh: '突襲。戰吼:本回合此武將+2/+0。雪中奮短兵。',
      en: 'Rush. Battlecry: This general has +2/+0 this turn. Short blades in the snow.',
    },
  },
  // 阵前一刀,袭斩魏延 —— 从背后来的那一下。
  'ma-dai': {
    attack: 4,
    health: 3,
    battlecry: { ops: [{ op: 'damage', amount: 2, target: 'chosenEnemyGeneral' }] },
    text: {
      zh: '突襲。戰吼:對一名敵方武將造成 2 點傷害。陣前一刀,襲斬魏延。',
      en: 'Rush. Battlecry: Deal 2 damage to an enemy general. One stroke from behind ended Wei Yan.',
    },
  },
  // 七进七出,追者莫敢近 —— 打完一轮,还能再来一轮。
  'wen-yang': {
    attack: 4,
    health: 4,
    onAttack: { ops: [{ op: 'buffStats', attack: 1, health: 0, target: 'self' }] },
    text: {
      zh: '連擊。此武將攻擊後,獲得+1/+0。單騎退雄兵,七進七出,追者莫敢近。',
      en: 'Windfury. After this general attacks, it gains +1/+0. Alone he turned back an army — seven times in, seven times out.',
    },
  },

  // ══════════════════ 隋唐五代 ══════════════════
  // 夜袭阴山,三千铁骑定漠北。
  'hist-li-jing': {
    attack: 5,
    health: 5,
    battlecry: { ops: [{ op: 'summon', defId: 'token-tie-qi', count: 2 }] },
    text: {
      zh: '突襲。戰吼:召喚兩個 2/2 的鐵騎。夜襲陰山,三千鐵騎定漠北。',
      en: 'Rush. Battlecry: Summon two 2/2 Ironclad Riders. Three thousand riders in the night settled the northern steppe.',
    },
  },
  // 锏打三州六府:一锏下去,谁也别想站着。
  'hist-qin-qiong': {
    attack: 5,
    health: 5,
    battlecry: { ops: [{ op: 'damage', amount: 3, target: 'randomEnemyGeneral' }] },
    text: {
      zh: '單挑。戰吼:對隨機一名敵方武將造成 3 點傷害。馬踏黃河兩岸,鐧打三州六府。',
      en: 'Duel. Battlecry: Deal 3 damage to a random enemy general. His twin mauls kept order on both banks of the Yellow River.',
    },
  },
  // 单鞭夺槊:空着手把对方的兵器抢过来 —— 连人一起。
  'hist-yuchi-gong': {
    attack: 5,
    health: 5,
    battlecry: { ops: [{ op: 'seize', target: 'randomEnemyGeneral' }] },
    text: {
      zh: '守護。戰吼:策反一名隨機敵方武將。單鞭奪槊,夜守宮門,邪祟辟易。',
      en: 'Guard. Battlecry: Take control of a random enemy general. With a bare whip he seized lances; demons flee the gate he keeps.',
    },
  },
  // 前后灭三国,皆生擒其主 —— 直取对面主帅。
  'hist-su-dingfang': {
    attack: 5,
    health: 5,
    battlecry: { ops: [{ op: 'damage', amount: 4, target: 'enemyHero' }] },
    text: {
      zh: '衝鋒。戰吼:對敵方主公造成 4 點傷害。前後滅三國,皆生擒其主。',
      en: 'Charge. Battlecry: Deal 4 damage to the enemy hero. He toppled three kingdoms and took each of their rulers alive.',
    },
  },
  // 王不过项,将不过李 —— 十八骑取长安,一路打到对面脸上。
  'hist-li-cunxiao': {
    attack: 8,
    health: 6,
    onAttack: { ops: [{ op: 'damage', amount: 3, target: 'enemyHero' }] },
    text: {
      zh: '單挑。此武將攻擊後,對敵方主公造成 3 點傷害。王不過項,將不過李。',
      en: 'Duel. After this general attacks, deal 3 damage to the enemy hero. No king surpassed Xiang Yu; no general surpassed Li Cunxiao.',
    },
  },
  // 范阳再叛,铁骑复陷东都。
  'hist-shi-siming': {
    attack: 5,
    health: 4,
    battlecry: { ops: [{ op: 'damage', amount: 3, target: 'enemyHero' }] },
    text: {
      zh: '衝鋒。戰吼:對敵方主公造成 3 點傷害。范陽再叛,自稱大燕皇帝,鐵騎復陷東都。',
      en: 'Charge. Battlecry: Deal 3 damage to the enemy hero. He revolted anew, styled himself Emperor of Great Yan, and took Luoyang a second time.',
    },
  },
  // 魏博牙兵,父死子继 —— 死一个,补上一个。
  'hist-tian-chengsi': {
    attack: 5,
    health: 5,
    deathrattle: { ops: [{ op: 'summon', defId: 'token-tie-qi', count: 1 }] },
    text: {
      zh: '守護。亡語:召喚一個 2/2 的鐵騎。魏博牙兵,父死子繼;河朔三鎮,不奉朝命者百年。',
      en: 'Guard. Deathrattle: Summon a 2/2 Ironclad Rider. The Weibo guards passed from father to son; for a century the three garrisons ignored the court.',
    },
  },
  // 天补平均大将军:一呼,流民云集。
  'hist-wang-xianzhi-tang': {
    attack: 4,
    health: 3,
    battlecry: { ops: [{ op: 'summon', defId: 'token-xiangyong', count: 2 }] },
    text: {
      zh: '突襲。戰吼:召喚兩個 1/1 的鄉勇。自號天補平均大將軍,長垣一呼,流民雲集。',
      en: 'Rush. Battlecry: Summon two 1/1 Militia. He called himself the General Who Levels All Under Heaven, and the starving came.',
    },
  },
  // 每战选死士为前锋,退者立斩。
  'hist-du-fuwei': {
    attack: 5,
    health: 5,
    battlecry: { ops: [{ op: 'grantKeyword', keyword: 'charge', target: 'chosenFriendlyGeneral' }] },
    text: {
      zh: '突襲。戰吼:使一名友方武將獲得衝鋒。江淮舉義,每戰選死士為前鋒,退者立斬;十六歲已為群盜之長。',
      en: 'Rush. Battlecry: Give a friendly general Charge. He led the Jianghuai rising at sixteen; his forlorn hope never retreated twice.',
    },
  },
  // 半年尽复窦建德故地 —— 旧部会回来的。
  'hist-liu-heita': {
    attack: 5,
    health: 4,
    deathrattle: { ops: [{ op: 'summon', defId: 'token-tie-qi', count: 2 }] },
    text: {
      zh: '單挑。亡語:召喚兩個 2/2 的鐵騎。半年盡復竇建德故地,自稱漢東王——河北之人,終不肯忘。',
      en: 'Duel. Deathrattle: Summon two 2/2 Ironclad Riders. In half a year he won back all of Dou Jiande’s land; Hebei never forgot him.',
    },
  },
  // 诗仙。十步杀一人 —— 落笔即是刀。
  'hist-li-bai': {
    attack: 3,
    health: 3,
    spellDamage: 1,
    text: {
      zh: '連擊。法術傷害+1。十步殺一人,千里不留行。',
      en: 'Windfury. Spell Damage +1. A kill every ten paces, no trace for a thousand li.',
    },
  },
  // 百济使者倾囊求书,不远万里而来。
  'hist-xiao-ziyun': {
    attack: 2,
    health: 3,
    battlecry: { ops: [{ op: 'draw', count: 1 }] },
    text: {
      zh: '戰吼:抽一張牌。飛白妙絕,百濟使者傾囊求書,不遠萬里而來。',
      en: 'Battlecry: Draw a card. His flying-white script was so fine that envoys from Baekje crossed the sea and emptied their purses for it.',
    },
  },
  // 草圣。写得越狂,笔势越大。
  'hist-zhang-xu': {
    attack: 2,
    health: 2,
    keywords: [],
    onSpellCast: { ops: [{ op: 'buffStats', attack: 1, health: 1, target: 'self' }] },
    text: {
      zh: '每當你打出一張錦囊,此武將+1/+1。醉後呼叫狂走,以髮濡墨——揮毫落紙如雲煙。',
      en: 'Whenever you play a stratagem, this general gains +1/+1. Drunk, he ran shouting and dipped his hair for a brush; the ink came down like smoke.',
    },
  },
  // 六次东渡,两目失明而志不移 —— 灯灭了,还有人接着点。
  'hist-jianzhen': {
    attack: 3,
    health: 3,
    deathrattle: { ops: [{ op: 'resurrect', count: 1 }] },
    text: {
      zh: '守護。亡語:復活一名友方陣亡武將。六次東渡,兩目失明而志不移;山川異域,風月同天。',
      en: 'Guard. Deathrattle: Resurrect a friendly general that died this game. Six crossings, both eyes lost, the vow unchanged: different lands, one sky.',
    },
  },
  // 欲穷千里目,更上一层楼 —— 站得高,看见的就多。
  'hist-wang-zhihuan': {
    attack: 3,
    health: 3,
    battlecry: { ops: [{ op: 'discover', pool: 'myGeneral' }] },
    text: {
      zh: '突襲。戰吼:發現一名武將。「欲窮千里目,更上一層樓。」拂衣去官,漫遊十五年。',
      en: 'Rush. Battlecry: Discover a general. To see a thousand li, climb one more storey. He shook out his sleeves, quit office, and wandered fifteen years.',
    },
  },
  // 贼至,亦能全十五城 —— 隐士也会筑寨。
  'hist-yuan-jie': {
    attack: 3,
    health: 3,
    battlecry: { ops: [{ op: 'summon', defId: 'token-shui-zhai', count: 1 }] },
    text: {
      zh: '守護。戰吼:召喚一個 0/4 的水寨(守護)。自號漫叟、浪士,結廬山谷之間;賊至,亦能全十五城。',
      en: 'Guard. Battlecry: Summon a 0/4 Stockade with Guard. He called himself the Idle Old Man — and still held fifteen cities when the rebels came.',
    },
  },
  // 八叉手而八韵成 —— 别人还在想,他已经写完了。
  'hist-wen-tingyun': {
    attack: 2,
    health: 2,
    battlecry: { ops: [{ op: 'gainMana', amount: 1, temporary: true }] },
    text: {
      zh: '戰吼:本回合獲得 1 點法力。八叉手而八韻成,花間之祖;屢舉不第,終老江湖。',
      en: 'Battlecry: Gain 1 Mana this turn only. Eight crossings of his hands, eight rhymes done. He never passed the exams, and never stopped writing.',
    },
  },

  // ══════════════════ 宋元 ══════════════════
  // 黄天荡:八千人把十万金军困在江湾里四十八天。
  'hist-han-shizhong': {
    attack: 5,
    health: 5,
    battlecry: { ops: [{ op: 'freeze', target: 'allEnemyGenerals' }] },
    text: {
      zh: '守護。戰吼:凍結所有敵方武將。黃天蕩上,八千銳卒扼十萬金軍。',
      en: 'Guard. Battlecry: Freeze all enemy generals. At Huangtiandang, eight thousand held back a hundred thousand.',
    },
  },
  // 铜面披发,夜夺昆仑关 —— 面具挡下了第一下。
  'hist-di-qing': {
    attack: 6,
    health: 5,
    keywords: ['rush', 'divineShield'],
    text: {
      zh: '突襲。鐵壁。銅面披髮,夜奪崑崙關。',
      en: 'Rush. Divine Shield. Bronze-masked, hair loose, he stormed Kunlun Pass by night.',
    },
  },
  // 楼船蔽江,六十万众 —— 人越多,他越大。
  'hist-chen-youliang': {
    attack: 6,
    health: 4,
    battlecry: {
      ops: [
        { op: 'buffPer', per: { kind: 'friendlyGenerals' }, attack: 1, health: 1, target: 'self' },
      ],
    },
    text: {
      zh: '單挑。戰吼:每有一名友方武將,此武將+1/+1。樓船蔽江,六十萬眾決死鄱陽湖。',
      en: 'Duel. Battlecry: Gain +1/+1 for each friendly general. His tower ships blotted out the river at Lake Poyang.',
    },
  },
  // 据吴自守十四年 —— 不出击,但年年都还在。
  'hist-zhang-shicheng': {
    attack: 4,
    health: 5,
    startOfTurn: { ops: [{ op: 'heal', amount: 2, target: 'friendlyHero' }] },
    text: {
      zh: '守護。在你的回合開始時,你的主公恢復 2 點生命。十八條扁擔起事,據吳自守十四年。',
      en: 'Guard. At the start of your turn, restore 2 Health to your hero. Eighteen salt-carriers rose with him; he held Wu for fourteen years.',
    },
  },
  // 舟师出没,漕运为之断绝 —— 断的是对方的补给。
  'hist-fang-guozhen': {
    attack: 4,
    health: 5,
    battlecry: { ops: [{ op: 'discardRandom', count: 1 }] },
    text: {
      zh: '突襲。戰吼:對手隨機棄一張牌。首舉義旗於海上,舟師出沒,漕運為之斷絕。',
      en: 'Rush. Battlecry: Your opponent discards a random card. First to raise the banner — at sea, where his fleets cut the grain lanes.',
    },
  },
  // 终南结庐三十年,屡召皆辞。
  'hist-zhong-fang': {
    attack: 2,
    health: 4,
    endOfTurn: { ops: [{ op: 'gainArmor', amount: 2 }] },
    text: {
      zh: '守護。在你的回合結束時,你的主公獲得 2 點護甲。終南結廬三十年,真宗屢召,皆以母老辭。',
      en: 'Guard. At the end of your turn, your hero gains 2 Armor. Thirty years in a hut on Zhongnan; each imperial summons met the same reply — my mother is old.',
    },
  },
  // 胸有成竹:下笔之前,那根竹子已经在心里了。
  'hist-wen-tong': {
    attack: 3,
    health: 2,
    battlecry: { ops: [{ op: 'tutor', kind: 'stratagem', count: 1 }] },
    text: {
      zh: '戰吼:從牌庫抽一張錦囊。畫竹必先得成竹於胸中;執筆熟視,乃見其所欲畫者。',
      en: 'Battlecry: Draw a stratagem from your deck. Before painting bamboo, have the whole bamboo in your chest; hold the brush, look long, and it appears.',
    },
  },
  // 散尽家财,扁舟太湖二十年 —— 东西没了,画留下来了。
  'hist-ni-zan': {
    attack: 2,
    health: 2,
    deathrattle: { ops: [{ op: 'draw', count: 2 }] },
    text: {
      zh: '守護。亡語:抽兩張牌。散盡家財,扁舟往來太湖二十年;逸筆草草,不求形似。',
      en: 'Guard. Deathrattle: Draw two cards. He gave away his fortune and drifted Lake Tai for twenty years, painting loosely, chasing no likeness.',
    },
  },
  // 梧桐雨:说不出口的故国之痛,全落在雨声里。
  'hist-bai-pu': {
    attack: 2,
    health: 3,
    battlecry: { ops: [{ op: 'damage', amount: 1, target: 'allEnemyGenerals' }] },
    text: {
      zh: '戰吼:對所有敵方武將造成 1 點傷害。終身不仕,以詞曲自遣;故國之痛,盡寄梧桐雨聲。',
      en: 'Battlecry: Deal 1 damage to all enemy generals. He never took office. What he could not say about a fallen dynasty, he put into rain on the wutong leaves.',
    },
  },

  // ══════════════════ 明清 ══════════════════
  // 鸳鸯阵:十二人一队,长短兵器互补 —— 阵成了,全队都强。
  'hist-qi-jiguang': {
    battlecry: { ops: [{ op: 'buffStats', attack: 2, health: 2, target: 'allFriendlyOthers' }] },
    text: {
      zh: '突襲。戰吼:使你的其他武將+2/+2。鴛鴦陣成,倭寇喪膽。',
      en: 'Rush. Battlecry: Give your other generals +2/+2. The Mandarin Duck formation broke the wokou.',
    },
  },
  // 北伐中原,驱逐胡虏 —— 大军开进去,是从牌库里开出来的。
  'hist-xu-da': {
    attack: 5,
    health: 6,
    battlecry: { ops: [{ op: 'recruit', count: 1 }] },
    text: {
      zh: '衝鋒。戰吼:從牌庫隨機召喚一名武將。北伐中原,驅逐胡虜。',
      en: 'Charge. Battlecry: Summon a random general from your deck. He marched north and reclaimed the Central Plains.',
    },
  },
  // 驱逐红夷,复我台湾 —— 把占着地方的人赶回海上。
  'hist-zheng-chenggong': {
    attack: 5,
    health: 5,
    battlecry: { ops: [{ op: 'returnToHand', target: 'chosenEnemyGeneral' }] },
    text: {
      zh: '衝鋒。戰吼:將一名敵方武將移回其手牌。驅逐紅夷,復我台灣;海上孤忠,延平王旗。',
      en: 'Charge. Battlecry: Return an enemy general to its owner’s hand. He drove out the Dutch and took back Taiwan under the lone banner of Yanping.',
    },
  },
  // 常十万:给我十万人,横行天下。
  'hist-chang-yuchun': {
    attack: 6,
    health: 5,
    battlecry: { ops: [{ op: 'summon', defId: 'token-tie-qi', count: 2 }] },
    text: {
      zh: '衝鋒。戰吼:召喚兩個 2/2 的鐵騎。自請十萬眾,橫行天下——人稱常十萬。',
      en: 'Charge. Battlecry: Summon two 2/2 Ironclad Riders. Give me a hundred thousand and I will sweep the realm.',
    },
  },
  // 捕鱼儿海:一头扎进漠北,把人家的王庭端了。
  'hist-lan-yu': {
    attack: 6,
    health: 5,
    battlecry: { ops: [{ op: 'damage', amount: 4, target: 'enemyHero' }] },
    text: {
      zh: '突襲。戰吼:對敵方主公造成 4 點傷害。深入漠北,搗虜庭於捕魚兒海。',
      en: 'Rush. Battlecry: Deal 4 damage to the enemy hero. He smashed the horde’s court at Lake Buir.',
    },
  },
  // 俞龙戚虎,剑术冠绝当世 —— 《剑经》一书,教的是怎么把人打倒。
  'hist-yu-dayou': {
    attack: 6,
    health: 4,
    battlecry: { ops: [{ op: 'damage', amount: 2, target: 'chosenEnemyGeneral' }] },
    text: {
      zh: '單挑。戰吼:對一名敵方武將造成 2 點傷害。俞龍戚虎,劍術冠絕當世。',
      en: 'Duel. Battlecry: Deal 2 damage to an enemy general. The Dragon Yu — no blade of his age could match his.',
    },
  },
  // 北京保卫战:粉身碎骨浑不怕 —— 城门守住了,人也守没了。
  'hist-yu-qian': {
    attack: 5,
    health: 6,
    aura: { scope: 'friendlyOthers', attack: 0, health: 2 },
    text: {
      zh: '守護。你的其他武將+0/+2。粉身碎骨渾不怕,要留清白在人間。',
      en: 'Guard. Your other generals have +0/+2. Ground to dust, he feared nothing — only a stained name.',
    },
  },
  // 结硬寨,打呆仗 —— 每回合都把寨子再垒高一点。
  'hist-zeng-guofan': {
    attack: 4,
    health: 4,
    endOfTurn: { ops: [{ op: 'gainArmor', amount: 3 }] },
    text: {
      zh: '守護。在你的回合結束時,你的主公獲得 3 點護甲。結硬寨,打呆仗,湘軍之律。',
      en: 'Guard. At the end of your turn, your hero gains 3 Armor. Build iron camps; fight patient battles — the law of the Xiang Army.',
    },
  },
  // 据大理十八年,汉回并用 —— 什么人都收得下。
  'hist-du-wenxiu': {
    attack: 4,
    health: 4,
    battlecry: { ops: [{ op: 'summon', defId: 'token-xiangyong', count: 2 }] },
    text: {
      zh: '守護。戰吼:召喚兩個 1/1 的鄉勇。據大理十八年,號總統兵馬大元帥,漢回並用,滇西自守。',
      en: 'Guard. Battlecry: Summon two 1/1 Militia. Eighteen years he held Dali, Han and Hui alike under one banner.',
    },
  },
  // 卜《易》得遯之九五,遂终身不仕 —— 退，是他自己选的。
  'hist-shen-zhou': {
    attack: 2,
    health: 4,
    battlecry: { ops: [{ op: 'returnToHand', target: 'chosenFriendlyGeneral' }] },
    text: {
      zh: '守護。戰吼:將一名友方武將移回你的手牌。有司欲薦之,卜《易》得遯之九五,遂終身不仕。',
      en: 'Guard. Battlecry: Return a friendly general to your hand. Offered a recommendation, he consulted the Yijing, drew Retreat, and never served.',
    },
  },
  // 漆工出身,十年成一卷 —— 慢工,但那一卷谁也画不出来。
  'hist-qiu-ying': {
    attack: 2,
    health: 3,
    battlecry: { ops: [{ op: 'discover', pool: 'myGeneral' }] },
    text: {
      zh: '戰吼:發現一名武將。漆工出身,十年成一卷;仕女樓閣,設色如新。',
      en: 'Battlecry: Discover a general. A lacquerer’s apprentice who spent ten years on a single scroll — the colours still look wet.',
    },
  },

  // ══════════════════ 预组骨架 18 张 ══════════════════
  //
  // 这批是六套预组共用的骨架,身材是跨很多轮 sim-balance 手调出来的 ——
  // 从前的做法是**一律不碰**(改一张颜真卿的血就把矩阵打出闸门)。
  // 现在动它们,是因为「张飞、张辽、孙策、许褚是白板」这件事本身就说不过去。
  //
  // 动它们的三条纪律:
  // 1. **只发贪心 AI 用得上的效果** —— 上场即改变场面的那类(点杀 / 铺场 / 加攻 / 激怒)。
  //    治疗、护甲、发现、检索在 AI 手里近乎白板(见 balance sim 的老结论),
  //    给预组卡发这些 = 白扣身材,矩阵必然塌一角。
  // 2. **中立骨架发小的**。王平出现在 5 套预组各 2 张、程普/陈到 4-5 套 ——
  //    动它们是同时动所有卡组,只发 ≤1.5 点的小效果,让六套一起平移而不是相对错位。
  // 3. **主义专属的那 7 张是精准旋钮**,顺手用来拉平矩阵:
  //    礼家(46.2%)与割据(45.6%)偏弱,给净场面收益;名利(59.0%)偏强,给等价交换。
  //
  // 改完必跑 `npm run sim-balance`,矩阵是唯一的验收标准。

  // ---- 中立骨架:六套一起平移 ----
  // 街亭断后,平生谨慎 —— 大军退了,他的人还在。
  'wang-ping': {
    attack: 4,
    health: 5,
    deathrattle: { ops: [{ op: 'summon', defId: 'token-xiangyong', count: 1 }] },
    text: {
      zh: '守護。亡語:召喚一個 1/1 的鄉勇。街亭斷後,鳴鼓自持,魏軍疑有伏而不敢逼。',
      en: 'Guard. Deathrattle: Summon a 1/1 Militia. He beat his drums at Jieting and the Wei army, fearing ambush, let the retreat pass.',
    },
  },
  // 江表虎臣之首,历事三主 —— 倒下之前还要还一手。
  'cheng-pu': {
    attack: 5,
    health: 6,
    deathrattle: { ops: [{ op: 'damage', amount: 2, target: 'randomEnemyGeneral' }] },
    text: {
      zh: '守護。亡語:對隨機一名敵方武將造成 2 點傷害。江表虎臣之首,歷事三主,程公未嘗後人。',
      en: 'Guard. Deathrattle: Deal 2 damage to a random enemy general. First of the Tiger Officers of Jiangbiao, he served three lords and never lagged behind.',
    },
  },
  // 名位常亚赵云,所领白毦兵为西方上兵。
  'chen-dao': {
    attack: 4,
    health: 6,
    battlecry: { ops: [{ op: 'summon', defId: 'token-baimao-bing', count: 1 }] },
    text: {
      zh: '守護。戰吼:召喚一個 2/2 的白毦兵。名位常亞趙雲,所領白毦,西方上兵。',
      en: 'Guard. Battlecry: Summon a 2/2 White-Plume Guard. Ranked ever just below Zhao Yun; his White Plumes were the finest troops of the west.',
    },
  },
  // 身被数十创,肤如刻画 —— 伤越多,越不肯退。
  'zhou-tai': {
    attack: 5,
    health: 6,
    enrage: 3,
    text: {
      zh: '守護。激怒:受傷時+3/+0。身被數十創,膚如刻畫;孫權為之流涕。',
      en: 'Guard. Enrage: +3/+0 while damaged. Dozens of scars carved his skin; Sun Quan wept to see them.',
    },
  },
  // 河北名将,与颜良齐名 —— 先出手的那一个。
  'wen-chou': {
    attack: 5,
    health: 4,
    battlecry: { ops: [{ op: 'damage', amount: 2, target: 'randomEnemyGeneral' }] },
    text: {
      zh: '突襲。戰吼:對隨機一名敵方武將造成 2 點傷害。河北名將,與顏良齊名。',
      en: 'Rush. Battlecry: Deal 2 damage to a random enemy general. Hebei’s champion, spoken of in the same breath as Yan Liang.',
    },
  },
  // 子午谷奇谋:不打关隘,直取长安。
  'wei-yan': {
    attack: 5,
    health: 4,
    battlecry: { ops: [{ op: 'damage', amount: 2, target: 'enemyHero' }] },
    text: {
      zh: '衝鋒。戰吼:對敵方主公造成 2 點傷害。子午谷奇謀:願得精兵五千,十日到長安。',
      en: 'Charge. Battlecry: Deal 2 damage to the enemy hero. Give me five thousand picked men and I will be at Chang’an in ten days.',
    },
  },

  // ---- 主义专属:精准旋钮 ----
  // 当阳桥头一声断喝,曹军人马俱惊,无一敢近。
  'zhang-fei': {
    attack: 5,
    health: 4,
    battlecry: { ops: [{ op: 'freeze', target: 'allEnemyGenerals' }] },
    text: {
      zh: '守護。戰吼:凍結所有敵方武將。當陽橋頭一聲斷喝,曹軍人馬俱驚,無一敢近。',
      en: 'Guard. Battlecry: Freeze all enemy generals. One roar at Changban Bridge, and not a man of Cao’s army dared come on.',
    },
  },
  // 八百破十万,威震逍遥津 —— 直冲中军。
  'zhang-liao': {
    attack: 6,
    health: 5,
    battlecry: { ops: [{ op: 'damage', amount: 3, target: 'enemyHero' }] },
    text: {
      zh: '衝鋒。戰吼:對敵方主公造成 3 點傷害。八百破十萬,威震逍遙津。',
      en: 'Charge. Battlecry: Deal 3 damage to the enemy hero. Eight hundred broke a hundred thousand at Xiaoyao Ford.',
    },
  },
  // 虎痴。裸衣斗马超,力拔千钧。
  'xu-chu': {
    attack: 6,
    health: 5,
    battlecry: { ops: [{ op: 'damage', amount: 3, target: 'randomEnemyGeneral' }] },
    text: {
      zh: '守護。戰吼:對隨機一名敵方武將造成 3 點傷害。虎痴裸衣,鬥馬超於渭南。',
      en: 'Guard. Battlecry: Deal 3 damage to a random enemy general. The Tiger Fool stripped to the waist and fought Ma Chao at Weinan.',
    },
  },
  // 鸿门宴闯帐,生啖彘肩 —— 越是刀架在脖子上,越站得直。
  'hist-fan-kuai': {
    attack: 5,
    health: 7,
    enrage: 2,
    text: {
      zh: '守護。激怒:受傷時+2/+0。鴻門宴上闖帳,立飲斗酒,生啖彘肩。',
      en: 'Guard. Enrage: +2/+0 while damaged. He forced his way into the Hongmen feast, downed a gallon of wine, and ate a raw shoulder of pork.',
    },
  },
  // 细柳营:军中闻将军令,不闻天子之诏。
  'hist-zhou-yafu': {
    attack: 5,
    health: 7,
    aura: { scope: 'friendlyOthers', attack: 0, health: 1 },
    text: {
      zh: '守護。你的其他武將+0/+1。細柳營中,聞將軍令,不聞天子之詔。',
      en: 'Guard. Your other generals have +0/+1. In the Xiliu camp they heeded the general’s orders, not the emperor’s.',
    },
  },
  // 安史之乱,河北二十四郡独平原不下 —— 一纸檄文,十七郡响应。
  'hist-yan-zhenqing': {
    attack: 4,
    health: 6,
    battlecry: { ops: [{ op: 'summon', defId: 'token-tie-qi', count: 1 }] },
    text: {
      zh: '守護。戰吼:召喚一個 2/2 的鐵騎。河北二十四郡皆陷,獨平原城守具備;檄書一出,十七郡同日歸之。',
      en: 'Guard. Battlecry: Summon a 2/2 Ironclad Rider. Twenty-four commanderies fell; only Pingyuan stood ready — and seventeen answered his call in a single day.',
    },
  },
  // 越国公。治军严酷,临阵有不用命者,立斩以徇。
  'hist-yang-su': {
    attack: 5,
    health: 5,
    battlecry: { ops: [{ op: 'damage', amount: 2, target: 'randomEnemyGeneral' }] },
    text: {
      zh: '突襲。戰吼:對隨機一名敵方武將造成 2 點傷害。越國公治軍,臨陣有不用命者,立斬以徇。',
      en: 'Rush. Battlecry: Deal 2 damage to a random enemy general. The Duke of Yue kept order by beheading, on the spot, any man who failed him.',
    },
  },
  // 转斗千里,尽有江东 —— 兵是一路打出来的。
  'sun-ce': {
    attack: 6,
    health: 5,
    battlecry: { ops: [{ op: 'summon', defId: 'token-danyang-bing', count: 1 }] },
    text: {
      zh: '衝鋒。戰吼:召喚一個 1/3 的丹陽兵(守護)。轉鬥千里,盡有江東。二十六歲,已經來不及慢慢打了。',
      en: 'Charge. Battlecry: Summon a 1/3 Danyang Levy with Guard. A thousand li of running battle won him all of Jiangdong. At twenty-six, there was no time to be slow.',
    },
  },
  // 西凉马腾,受衣带诏 —— 铁骑随行。
  'ma-teng': {
    attack: 5,
    health: 6,
    battlecry: { ops: [{ op: 'summon', defId: 'token-tie-qi', count: 1 }] },
    text: {
      zh: '守護。戰吼:召喚一個 2/2 的鐵騎。西涼馬騰,受衣帶詔,率鐵騎入關。',
      en: 'Guard. Battlecry: Summon a 2/2 Ironclad Rider. Ma Teng of Liang took the girdle edict and rode his ironclads through the pass.',
    },
  },
  // 与诸葛亮、崔州平、孟建游学,各言其志。
  'shi-tao': {
    attack: 2,
    health: 3,
    battlecry: { ops: [{ op: 'draw', count: 1 }] },
    text: {
      zh: '戰吼:抽一張牌。與諸葛亮、崔州平、孟公威俱遊學,四人各言其志。',
      en: 'Battlecry: Draw a card. He studied alongside Zhuge Liang, Cui Zhouping and Meng Gongwei — each declaring his own ambition.',
    },
  },
  // 竹林七贤。善弹琵琶,妙解音律,任性不羁。
  'ruan-xian': {
    attack: 2,
    health: 2,
    battlecry: { ops: [{ op: 'gainMana', amount: 1, temporary: true }] },
    text: {
      zh: '戰吼:本回合獲得 1 點法力。竹林七賢之一,妙解音律,縱情越禮。',
      en: 'Battlecry: Gain 1 Mana this turn only. One of the Seven Sages of the Bamboo Grove — a master of music who cared nothing for propriety.',
    },
  },
  // 北天师道,以符箓传世。
  'hist-kou-qianzhi': {
    attack: 4,
    health: 4,
    battlecry: {
      ops: [{ op: 'grantKeyword', keyword: 'divineShield', target: 'chosenFriendlyGeneral' }],
    },
    text: {
      zh: '守護。戰吼:使一名友方武將獲得鐵壁。清整道教,除去三張偽法;太武帝親受符籙。',
      en: 'Guard. Battlecry: Give a friendly general Divine Shield. He purged the Daoist canon of the Zhangs’ false rites; the emperor himself took his talismans.',
    },
  },

}
