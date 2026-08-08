// 引擎类型契约。整个游戏(UI、AI、内容生成、未来的服务器)都建立在这些类型上。
// 引擎保持纯粹:可序列化状态、确定性演算、无外部依赖。

export type PlayerIdx = 0 | 1

// 六大主义 = 构筑职业(王道/霸道/礼教/名利/割据/隐逸)
export type Doctrine =
  | 'royal'
  | 'hegemonic'
  | 'ritual'
  | 'fame'
  | 'separatist'
  | 'reclusion'

// 朝代 = 羁绊标签。三国细分魏蜀吴群,其余按朝代。
export type DynastyTag =
  | 'wei'
  | 'shu'
  | 'wu'
  | 'qun'
  | 'spring-autumn'
  | 'warring-states'
  | 'qin'
  | 'chu-han'
  | 'western-han'
  | 'jin'
  | 'southern-northern'
  | 'sui'
  | 'tang'
  | 'five-dynasties'
  | 'song'
  | 'yuan'
  | 'ming'
  | 'qing'

// 武将牌/锦囊牌/装备牌(装备:打给一名友方武将,加成攻血并授予关键词)
export type CardType = 'general' | 'stratagem' | 'equipment'
export type Rarity = 'common' | 'rare' | 'epic' | 'legendary'
// 冲锋/突袭/守护/连击/单挑/吸血/剧毒(第二卡包)/铁壁(圣盾)/潜行(第三卡包)
export type Keyword =
  | 'charge'
  | 'rush'
  | 'guard'
  | 'windfury'
  | 'duel'
  | 'lifesteal'
  | 'poison'
  // ---- 第三卡包「附魔与谋略」 ----
  | 'divineShield' // 铁壁:抵消下一次伤害
  | 'stealth' // 潜行:不能被敌方选为目标,自身攻击后解除
  // ---- 第十二卡包「碾压」 ----
  | 'trample' // 碾压:攻击武将时,溢出的伤害穿透到敌方主公
  // ---- 第二十二卡包 ----
  // 缴械:不能攻击(身材、光环、亡语一概不受影响)。
  // 此前唯一的硬控是冻结,而冻结是**一次性**的(回合末自动解),
  // 于是「废掉那个大哥,但留着他占位」这类控场手段一条都写不出来。
  // 它几乎只由 grantKeyword 授予 —— 卡面自带缴械的武将等于一张纯白板墙。
  | 'disarm'
  // 攻城:攻击**主公**时额外造成 SIEGE_BONUS 点伤害。
  // 器械兵种此前只是个标签,没有任何专属身份 —— 攻城车打人和打城墙一样疼,
  // 这在一部讲古代战争的游戏里说不过去。
  | 'siege'
export type Archetype = 'warrior' | 'strategist'

// 兵种 —— 势力/主义回答「他是谁那边的」,兵种回答「他在战场上干什么」。
// 值由内容层的 deriveTroop 从已有字段推出(见 content/troops.ts),
// 引擎只读不算:它是 CardDef 上的一个普通标签,和 dynasty 一个待遇。
export type TroopType = 'cavalry' | 'infantry' | 'archer' | 'navy' | 'siege' | 'advisor'

export interface LocalizedText {
  zh: string
  en: string
}

// ---------- 效果 DSL(数据而非闭包,可序列化、可传服务器) ----------

export type EffectTarget =
  | 'chosenEnemyGeneral'
  | 'chosenAny'
  | 'allEnemyGenerals'
  | 'randomEnemyGeneral'
  | 'self'
  | 'friendlyDynastyGenerals'
  | 'enemyHero'
  | 'friendlyHero'
  // ---- 第三卡包 ----
  | 'allFriendlyGenerals'
  | 'allFriendlyOthers' // 除自己外的友方武将(号令类战吼)
  | 'randomFriendlyGeneral'
  | 'allGenerals'
  | 'chosenFriendly' // 指定友方角色(含主公)
  | 'chosenFriendlyGeneral' // 指定友方武将
  // ---- 第二十二卡包:「最」类目标 ----
  //
  // 在此之前,不指定目标的效果只有 random 与 all 两档 —— 于是
  // 「射杀敌军最强者」「先救伤得最重的」这类**古代战场最基本的取舍**
  // 一条都写不出来,只能退化成随机,而随机恰恰把这类卡的全部意图抹掉了。
  //
  // 并列时取 iid 最小者(入场最早的那个)—— 必须确定,否则回放与服务端权威对局会分叉。
  // 敌方那两个照样过潜行过滤(和 randomEnemyGeneral 一致)。
  | 'weakestEnemyGeneral' // 敌方**现血**最低
  | 'strongestEnemyGeneral' // 敌方**攻击**最高
  | 'weakestFriendlyGeneral'
  | 'strongestFriendlyGeneral'
  // 来源左右紧邻的两名友军(与 AuraDef.scope:'adjacent' 同一套相邻语义,
  // 区别是那个是持续光环、这个是一次性效果)。来源不在场则为空。
  | 'adjacentFriendly'
  // ---- 第三十卡包:夷三族 ----
  // 选中的那名敌将,**外加敌方场上所有与他同族的人**。
  //
  // 这是卡池里第一个**由「选中的那一个」派生出「一组」**的目标 ——
  // 此前 chosen* 一律是一对一,all* 一律不给选。它要的是那个中间态:
  // 你挑谁是决定,而挑完之后打中几个由**场面**说了算(见 CardDef.clan)。
  //
  // 没有族的人只打中他自己(155 个家族之外的人占多数),
  // 所以这条目标的下限就是一张普通的单体解场 —— 上限才是「一门皆诛」。
  | 'clanOfChosenEnemy'

export interface EffectCondition {
  ifDynastyCount?: { dynasty: DynastyTag; atLeast: number }
  // ---- 第三卡包 ----
  ifBoardCount?: { side: 'friendly' | 'enemy'; atLeast: number }
  ifHeroHpBelow?: number // 我方主公血量低于此值
  ifHandCount?: { atLeast: number }
  // ---- 第六卡包:关键词羁绊 ----
  // 我方场上带某关键词的武将达到 atLeast 张(吸血流/潜行流/冲锋流的门槛 payoff)
  ifKeywordCount?: { keyword: Keyword; atLeast: number }
  // ---- 第二十一卡包:士气 / 粮道 / 天时 ----
  ifMorale?: { atLeast: number } // 我方士气不低于 N(负数也能写:atLeast: -2 表示「哀兵」)
  ifSupply?: { atLeast: number } // 我方屯粮不低于 N
  ifSky?: Sky // 当前天时是某一时段(见 skyOf)
  ifChain?: { atLeast: number } // 本回合已结算的锦囊数(见 PlayerState.chain)
  // ---- 第二十二卡包:把已有状态接进条件层 ----
  //
  // 士气 / 粮道 / 计谋链上个卡包就进了 PlayerState,天时更是零状态,
  // 但**没有一条卡能「检查」兵种、环境、墓地或回合数** —— 状态存在却读不到,
  // 是卡池里最便宜的一个口子:这一段全是纯读,零事件、零迁移。
  ifTroopCount?: { troop: TroopType; atLeast: number } // 我方某兵种达 N 人(骑兵队/水军)
  ifField?: { id?: string } // 有战场环境(给 id 则必须是那一片)
  ifTurnAtLeast?: number // 第 N 回合起(后期牌:「拖到这时候才有用」)
  ifGraveyardCount?: { atLeast: number } // 我方墓地里的**武将**数(尸山血海 payoff)
  ifEnemyHeroHpBelow?: number // 敌方主公血量低于此值 —— 处决线,AI 也读得懂
}

// 计数来源:buffPer 按它数出一个倍数。
// 原则上只数**我方场面**(payoff 是自己铺出来的);第二十二卡包开了两个例外,
// 见下面 enemyGenerals / handCount 的说明 —— 它们数的是「局势」而不是「战果」。
export type CountSource =
  | { kind: 'friendlyDynasty' } // 与来源卡同势力的友方武将(不含自己更直观 → 见 resolve 注释)
  | { kind: 'friendlyKeyword'; keyword: Keyword } // 带某关键词的友方武将
  | { kind: 'friendlyGenerals' } // 友方武将总数
  | { kind: 'friendlyTroop'; troop: TroopType } // 某兵种的友方武将(军师不入列,见 content/troops.ts)
  // ---- 第二十七卡包:降将 ----
  // 我方场上的**降将**数(`CardDef.defector`,**含自己**)。
  //
  // 这条轴和势力/兵种的区别是它**横跨一切分组**:65 个人分布在六个主义、
  // 从三国到清初,唯一的共同点是「他换过阵营」。这在别的 CCG 里是编不出来的
  // 部族 —— 它不是设计出来的标签,是史料里现成的一句「降曹操」「歸唐」。
  | { kind: 'friendlyDefector' }
  // 我方墓地里的**武将**数(锦囊装备不算)。亡语/复生流缺的就是这个计数 ——
  // 此前只有「复生一个」这种一次性效果,没法表达「死得越多越强」。
  | { kind: 'friendlyGraveyard' }
  // ---- 第二十二卡包 ----
  // 敌方武将数:「敌众我寡」那一路 —— 对面铺得越满,这一刀越狠。
  // 它和 friendlyGenerals 的区别不只是换个符号:go-wide 的对手无法靠**不铺场**来躲,
  // 而 friendlyGenerals 系的卡是自己铺出来的,先手劣势方永远吃不到。
  | { kind: 'enemyGenerals' }
  // ---- 战役同袍(2026-08-03)----
  // 与来源卡**同赴过一场战役**的友方武将(不含自己)。
  //
  // 【为什么这条只有这个题材做得出来】
  // 势力/兵种是设计出来的分组,而「谁和谁同赴过赤壁」是**史料里现成的**:
  // 生平原文点到那一仗的人就是那一仗的人(24 场 / 150 人次,见 lore 的战役索引)。
  // 别家 CCG 想要这个分组得先编一段战史,这里只要照抄。
  //
  // 名单挂在**卡上**(CardDef.battles),不在引擎里建表 —— 和 clan / bond 同一条铁律:
  // 引擎存 id 去内容层查,服务端权威对局和老战报就会依赖内容版本。
  | { kind: 'friendlyBattle' }
  // 我方手牌数:囤牌流的 payoff(与 ifHandCount 成对)。
  | { kind: 'handCount' }

export type EffectOp =
  | { op: 'damage'; amount: number; target: EffectTarget }
  | { op: 'heal'; amount: number; target: EffectTarget }
  | { op: 'draw'; count: number }
  // duration: 'endOfTurn' → 本回合结束时失效(通过附魔层撤销)
  | {
      op: 'buffStats'
      attack: number
      health: number
      target: EffectTarget
      duration?: 'endOfTurn'
    }
  | { op: 'swapStats'; target: EffectTarget } // 交换攻击与最大生命(移形换位)
  | { op: 'seize'; target: EffectTarget } // 策反:把敌方武将夺到我方场上(我方满场则无事发生)
  | { op: 'stealCard'; count: number } // 离间:从对手手牌随机抽 N 张到我方手里
  | { op: 'copyGeneral'; target: EffectTarget } // 疑兵:在我方场上复制一个武将(照卡面复制,不带伤与附魔)
  | { op: 'banish'; target: EffectTarget } // 焚尸:放逐一个武将 —— 不算死亡,不触发亡语、不进墓地
  | { op: 'tutor'; kind: 'general' | 'stratagem' | 'equipment'; count: number } // 求贤:从牌库检索指定类型的牌进手
  | { op: 'recruit'; count: number } // 搜将:从我方牌库随机召唤 N 个武将上场
  | { op: 'summon'; defId: string; count: number }
  | { op: 'aoeDamage'; amount: number }
  | { op: 'destroy'; target: EffectTarget }
  | { op: 'grantKeyword'; keyword: Keyword; target: EffectTarget; duration?: 'endOfTurn' }
  // ---- 第二卡包 ----
  | { op: 'gainArmor'; amount: number } // 我方主公获得护甲
  | { op: 'returnToHand'; target: EffectTarget } // 武将弹回持有者手牌(重置至卡面原值;手满则烧毁)
  | { op: 'discardRandom'; count: number } // 对手随机弃牌
  // ---- 第三卡包 ----
  | { op: 'silence'; target: EffectTarget } // 沉默:清空附魔与关键词,封印亡语
  | { op: 'freeze'; target: EffectTarget } // 冻结:跳过下一次行动
  | { op: 'gainMana'; amount: number; temporary: boolean } // 增益法力(temporary 只补本回合)
  | { op: 'damageAll'; amount: number } // 双方全场武将
  | { op: 'summonForEnemy'; defId: string; count: number } // 为对手召唤(负面锦囊/亡语用)
  // ---- 第六卡包:势力羁绊与流派 payoff ----
  // 按计数来源缩放的增益:target 每满足一个计数,+attack/+health。
  // 例:「战吼:此牌 +1/+1 每有一个同势力友军」= buffPer per:friendlyDynasty self 1/1。
  | { op: 'buffPer'; per: CountSource; attack: number; health: number; target: EffectTarget }
  // ---- 第十卡包:缩放伤害 ----
  // 按计数缩放的伤害:对 target 造成 amount×count 点。go-wide 爆发终结的地基。
  // 例:「对敌方主公造成伤害 = 你的武将数」= damagePer per:friendlyGenerals 1 enemyHero。
  | { op: 'damagePer'; per: CountSource; amount: number; target: EffectTarget }
  // ---- 第五卡包 ----
  // 发现:亮 count 张(默认 3),玩家挑一张进手牌。**必须是脚本的最后一个 op** ——
  // 它会把对局停在 pendingChoice 上等玩家选,后面的 op 不会再跑(见 runScript)。
  | { op: 'discover'; pool: DiscoverPool; count?: number }
  // ---- 第七卡包:费用消减 / 牌生成 ----
  // 减少手牌中匹配 filter 的牌的费用(amount 点,永久)。build-around 大哥的地基:
  // 「使你手牌中所有同势力牌 -1 费」。filter=dynasty 用来源卡的势力。
  | { op: 'reduceCost'; amount: number; filter: CostFilter }
  // 把 count 张 defId 加入手牌(生成);手满则烧掉。价值/工具箱流的地基。
  | { op: 'addToHand'; defId: string; count: number }
  // ---- 第八卡包:变形 / 复生 ----
  // 变形:把目标武将原地换成一个全新的 into(不触发亡语 —— 变形不是死亡)。硬解的另一条路。
  | { op: 'transform'; target: EffectTarget; into: string }
  // 复生:从墓地随机召回 count 个死去的**友方武将**(按卡面复生)。亡语流的顶点。
  | { op: 'resurrect'; count: number }
  // ---- 第十九卡包:战场环境 ----
  // 布下一片战场环境(天时地利)。**双方同吃**,覆盖当前环境(同时只有一片战场)。
  | { op: 'setField'; rule: FieldRule; turns?: number }
  // ---- 第二十一卡包:士气 / 粮道 ----
  // 鼓舞 / 挫敌:改变某一方的士气(正数给自己涨,负数写成 target:'enemy' 更直白)。
  | { op: 'gainMorale'; amount: number; side?: 'friendly' | 'enemy' }
  // 屯粮 / 断粮:某一方粮道 ±N(夹在 [0, SUPPLY_CAP])。
  // `side` 是**后加的**(默认 friendly,老卡一张都不用改),为的是让「断粮」
  // 有一条真的出口 —— 在此之前全池 145 张产粮、3 张耗粮、**0 张能减别人的粮**,
  // 于是粮道永远只涨不跌,「粮尽」这件事在对局里根本不可能发生。
  | { op: 'gainSupply'; amount: number; side?: 'friendly' | 'enemy' }
  // ---- 第二十二卡包:牌库、驱散、借将 ----
  // 断粮道(磨牌):把某一方牌库**顶上**的 N 张直接送进墓地。
  // 全游戏第一条能碰「牌库」的效果 —— 此前牌库只能被抽(draw)、被搜(tutor/recruit),
  // 从来不能被**削**。它开的是一条真正的另类赢法:不打脸,打他的补给。
  // 疲劳伤害本来就在(drawCards),磨牌只是把那条计时器拨快。
  | { op: 'mill'; count: number; side?: 'friendly' | 'enemy' }
  // 洗入牌库:生成 N 张 defId 洗进某一方的牌库(随机位置)。
  // 与 addToHand 的差别是**延迟**:塞给对手的废牌不占他的手牌,占的是他之后的每一次抽牌。
  | { op: 'shuffleIntoDeck'; defId: string; count: number; side?: 'friendly' | 'enemy' }
  // 驱散:只摘掉目标身上的**附魔**(增益、装备、临时关键词),不封亡语、不清卡面关键词。
  // 沉默此前是全有全无的一刀 —— 想解掉对面那把青龙偃月刀,只能连带把整张卡废掉。
  // 驱散不杀人:撤销后血量归零则夹回 1(沿用沉默那套 clampAlive)。
  | { op: 'dispel'; target: EffectTarget }
  // 借将:把敌将夺到我方,**本回合结束归还**(见 CardInstance.borrowedFrom)。
  // seize 是永久的,于是「临阵借一手」这类效果只能定成永久夺取的降配版;
  // 借将是它真正的形状 —— 这一回合他为你冲阵,回合一结束他就回去了。
  | { op: 'borrow'; target: EffectTarget }
  // 伏笔:埋下一段脚本,**turns 个我方回合之后**才结算(见 PlayerState.delayed)。
  //
  // 引擎此前没有任何「计时器」概念:伏兵是被动等对手踩,回合结束/开始触发器
  // 每回合都跑 —— 唯独「三日之后东风起」这类**约期**表达不出来,
  // 而那正是中式谋略里最常见的一种形状(七星坛借东风、火烧连营前的那几天)。
  //
  // 双方都看得见(包括是哪张牌):约期本来就是明着摆的,藏起来只会让对手
  // 在毫无预兆的情况下被一段三回合前的脚本打死,那不是悬念,那是噪音。
  | { op: 'delay'; turns: number; script: EffectScript }

export interface EffectScript {
  ops: EffectOp[]
  condition?: EffectCondition
}

// ---------- 第二十二卡包:军令状 ----------
//
// 「本局之内打出 N 张锦囊 → 得到 X」。全游戏第一次把**这一局的目标**写在牌上。
//
// 三种计数刻意都选了「玩家主动做的事」,而不是「场面上发生的事」:
// 伤害总量、抽牌数这类会被随机与对手行为推着走,军令状要的是一条你能自己走完的路。
// 目标数与奖励整份嵌在 PlayerState 里(不查表)—— 理由同主公技与战场环境:
// 引擎必须状态自足,存 id 去内容层查会让服务端权威对局与老战报依赖内容版本。
export type QuestGoalKind =
  | 'playStratagems' // 打出锦囊(不含伏兵与军令状自己)
  | 'summonGenerals' // 从手牌打出武将(召唤出来的衍生物不算 —— 否则一张召唤牌就刷满了)
  | 'killGenerals' // 斩杀敌将(放逐不算:那不是斩)

export interface QuestGoal {
  kind: QuestGoalKind
  count: number
}

export interface QuestDef {
  id: string
  name: LocalizedText
  goal: QuestGoal
  reward: EffectScript
}

// 领受中的军令状。整份自带 goal/reward(见上),progress 是已完成的次数。
export interface QuestState {
  defId: string
  name: LocalizedText
  goal: QuestGoal
  progress: number
  reward: EffectScript
}

// 伏笔:埋在时间线上的一段脚本。turnsLeft 每逢**自己的回合开始**减一,归零即结算。
export interface DelayedScript {
  turnsLeft: number
  script: EffectScript
  sourceDefId: string
}

// ---------- 第五卡包:抉择 / 发现 ----------

// 抉择:一张牌两个(或更多)模式,打出时**当场**选一个。
// 和连击的区别:连击由「本回合是不是第二张牌」决定,玩家不选;抉择永远是玩家现选。
// 每个模式自带一段脚本,选中的那段照常走目标校验 —— 于是「模式 A 要目标、
// 模式 B 不要目标」的卡是合法的(reducer/legal 都按选中模式的脚本判)。
export interface ChooseMode {
  label: LocalizedText
  script: EffectScript
}

export interface ChooseDef {
  modes: ChooseMode[]
}

// 发现:从一个牌池里亮出 count 张,玩家挑一张进手牌。
// 这是全游戏第一个「效果中途停下来问玩家」的机制 —— 靠 GameState.pendingChoice
// 落地(见下),而不是把引擎改成异步。发现的牌池刻意只做几个具名的,
// 不开放任意谓词:池子一旦能任意描述,平衡就没法测了。
// reduceCost 的手牌筛选。dynasty 用来源卡的势力(和 friendlyDynastyGenerals 一致)。
export type CostFilter = 'all' | 'dynasty' | 'generals' | 'stratagems'

export type DiscoverPool =
  | 'myStratagem' // 我方主义 + 中立的锦囊
  | 'myGeneral' // 我方主义 + 中立的武将
  | 'anyKeyword' // 任意带关键词的武将(跨主义,做「找关键词」的卡)
  | 'costlyGeneral' // 6 费及以上的武将(做「找大哥」的卡)

// ---------- 第四卡包:伏兵 / 连击 / 过载 ----------

// 伏兵的触发时机。刻意只做三个,而且都发生在**对手的回合**里 ——
// 伏兵的乐趣在于对手不知道自己踩了什么,自己回合会触发的「伏兵」只是延迟战吼。
export type SecretTrigger =
  | 'enemyAttack' // 敌方武将发起攻击时(伤害结算**之前**)
  | 'enemySummon' // 敌方武将入场后(战吼已结算)
  | 'enemyStratagem' // 敌方锦囊结算后

export interface SecretDef {
  trigger: SecretTrigger
  // 触发者(攻击者 / 入场的敌将)会作为 chosen 传进脚本,
  // 所以伏兵脚本里用 chosenEnemyGeneral / chosenAny 就能指到它。
  script: EffectScript
}

// ---------- 卡牌定义 ----------

// 光环:只要来源在场,持续作用于范围内武将。实现为「来源标记的附魔」,
// 每次场面变动重算(refreshAuras),来源离场即自动撤销。
export interface AuraDef {
  // adjacent(陣型):只作用于**左右紧邻**的两名友军。
  // 这是全游戏第一个让「摆在哪儿」有意义的语义 —— 在此之前 board 的顺序
  // 只是一个渲染下标,把牌放最左还是最右完全等价。
  scope: 'friendlyOthers' | 'friendlyAll' | 'adjacent'
  attack: number
  health: number
  keywords?: Keyword[]
}

export interface CardDef {
  id: string
  collectorNo: number
  name: LocalizedText
  type: CardType
  doctrine: Doctrine | 'neutral'
  dynasty: DynastyTag
  rarity: Rarity
  archetype: Archetype
  // 兵种(仅武将,军师与衍生物没有)。在 cards.ts 合并层派生 —— 生成层不存这个字段。
  troop?: TroopType
  // 降将:史料里明确写着换过阵营的人(生平的 `defected` 字段,65 位)。
  // 和 troop 一样在 cards.ts 合并层贴上 —— 名单是**committed 常量**
  // (`overrides/defectors.ts`),不在运行时读 lore:那份史料是懒加载的,
  // 让 cards.ts import 它等于把整份 lore 拖进首屏(perf-budget 闸门会红)。
  defector?: boolean
  // 傳承(仅装备):持有者阵亡时,这件装备改挂到另一名友军身上。
  // 名将的兵器不该跟着主人一起进土 —— 青龙偃月刀後來在關平手裡,方天畫戟落到別人手上。
  heirloom?: boolean
  cost: number
  // 武将:攻/血;装备:攻血加成值(keywords 为授予的关键词)
  attack?: number
  health?: number
  keywords: Keyword[]
  battlecry?: EffectScript
  deathrattle?: EffectScript
  spell?: EffectScript
  text?: LocalizedText
  token?: boolean // 衍生物:只能被召唤,不进卡包、不可构筑
  // ---- 第三卡包:触发器与光环 ----
  aura?: AuraDef
  // 羁绊(结义/君臣/师徒):**同一侧场上**同时有 members 里全部的卡时,
  // 锚点自己与这些成员一起获得增益。定义放在卡面上(与 aura 同源)—— 引擎只读 lib,
  // 不 import 内容层(铁律 1)。走光环的附魔路径,成员一死增益自动收回。
  bond?: BondDef
  // 宿敌:与 bond 同源的镜面 —— `foe` 在**敌方**场上时,双方一起获得增益。
  rival?: RivalDef
  // 家族:同族两人同时在场即成立(不挂锚点,见 ClanDef)。由生平原文抠出,生成层写入。
  clan?: ClanDef
  // 参加过的战役(生平原文里点到的那几场)。只用于 CountSource.friendlyBattle,
  // 由生成层写入 —— 和 clan 一样,定义整份挂在卡上,引擎不查表。
  battles?: string[]
  endOfTurn?: EffectScript // 我方回合结束时
  startOfTurn?: EffectScript // 我方回合开始时
  onDamaged?: EffectScript // 自身受伤后(有递归深度上限)
  onAttack?: EffectScript // 本武将发起攻击并存活后(单挑不触发)
  onSpellCast?: EffectScript // 我方每打出一个锦囊后,此武将触发(法术流 payoff)
  enrage?: number // 激怒:受伤(damage>0)时额外 +N 攻击,痊愈收回(派生自 refreshInstance)
  spellDamage?: number // 法术伤害加成(在场时为友方锦囊加伤)
  // ---- 第四卡包 ----
  secret?: SecretDef // 伏兵:打出后进伏兵区,对手触发才翻开(仅锦囊)
  combo?: EffectScript // 连击:本回合此牌之前已打出过牌时,**改用**这个脚本
  overload?: number // 过载:下回合锁定的水晶数
  // ---- 第五卡包 ----
  choose?: ChooseDef // 抉择:打出时选一个模式(替代 battlecry/spell)
  // ---- 第二十一卡包 ----
  // 军需:除法力外还要花掉 N 点粮道才能打出(见 PlayerState.supply)。
  // 只有新卡带它,所以老卡池的定价一个字都不用动。
  supplyCost?: number
  // 阵形:此牌在场时,若己方战线满足 shape,按定义发增益(见 FormationDef)。
  formation?: FormationDef
  // ---- 第二十二卡包 ----
  // 耐久(仅装备):持有者每发起一次攻击 -1,归零时装备损毁(那条附魔被摘掉)。
  // 装备此前是一条**永久**附魔 —— 一把刀挂上去就再也不会钝,于是「武器」这条轴
  // 只能靠数值小来平衡,写不出「一把神兵,但只砍得动三次」。
  durability?: number
  // 手牌中成长:每逢我方回合结束,此牌**在手牌里**获得 +X/+Y。
  // 附魔层此前只作用于场上实例,手牌是死的 —— 于是「留在手里会长大」的牌一张都没有,
  // 而那是「现在打出去还是再等一回合」这种决策最干净的一种来源。
  handGrowth?: { attack: number; health: number }
  // 军令状(仅锦囊):打出后进军令区,达成目标才结算 reward(见 QuestDef)。
  quest?: QuestDef
}

// 主公技:每回合一次的主动技能,六主义各一。
export interface HeroPowerDef {
  id: string
  name: LocalizedText
  text: LocalizedText
  cost: number
  script: EffectScript
  // 升级后的主公技(炉石「英雄牌」那个位置)。**整份嵌在这里,不查表** ——
  // 引擎必须状态自足:主公技随 PlayerState.heroPower 走,存 id 再去内容层查
  // 会让服务端权威对局与老战报依赖内容版本(见 ARCHITECTURE 主公技一节)。
  upgrade?: HeroPowerDef
  // 升级要花的法力。一局一次,不占「每回合一次」的使用额度。
  upgradeCost?: number
}

export interface HeroDef {
  id: string
  name: LocalizedText
  doctrine: Doctrine
  hp: number
  power: HeroPowerDef
}

export type CardLibrary = Readonly<Record<string, CardDef>>

// ---------- 对局状态 ----------

// 附魔:一切对卡面数值的修改都记在这里,而不是直接改 attack/health。
// 这样沉默(清空附魔)、临时增益(到期撤销)、光环(来源离场撤销)才有统一的撤销路径。
export interface Enchant {
  attack: number
  health: number
  keywords?: Keyword[]
  duration?: 'endOfTurn'
  auraFrom?: number // 光环来源 iid;由 refreshAuras 全权管理
  // 傳承(heirloom):持有者阵亡时,这条附魔改挂到另一名友方武将身上。
  // 值是装备的 defId —— 战报要说清「青龍偃月刀傳給了誰」。
  // 只有装备会带它,而装备本来就是一条附魔,所以这是**零新概念**的实现:
  // 死亡处理里把附魔搬个家,不需要「装备槽」这种新状态。
  heirloom?: string
  // ---- 第二十二卡包:耐久 ----
  // equip:这条附魔来自哪件装备(战报要说清「哪把刀断了」)。
  // uses:还能砍几次。**只有带 durability 的装备才有它** —— 没有就是永久,
  // 老卡池的每一件装备都一个字不用改。傳承时随附魔一起搬走(刀是同一把刀)。
  equip?: string
  uses?: number
}

// attack / health / maxHealth / keywords 是**派生字段**:
// 由 refreshInstance() 从卡面基础值 ⊕ enchants ⊖ silenced 算出。
// 保留在实例上是为了 UI / AI / 服务器读取时零成本,写入一律走附魔层。
export interface CardInstance {
  iid: number
  defId: string
  attack: number
  health: number
  maxHealth: number
  keywords: Keyword[]
  exhausted: boolean
  attacksUsed: number
  enchants: Enchant[]
  damage: number // 已承受伤害;health = maxHealth - damage
  silenced: boolean
  frozen: boolean
  shieldUsed: boolean // 铁壁已消耗(防止 refresh 从卡面把圣盾加回来)
  stealthBroken: boolean // 潜行已解除(同上,压制卡面自带的潜行)
  // ---- 第七卡包:费用消减 ----
  // 实例级费用修正(负=更便宜)。有效费用 = max(0, 卡面费 + costDelta)。
  // 只对手牌有意义;进场/入墓后不再读它。见 effectiveCost()。
  costDelta: number
  // ---- 第二十二卡包:借将 ----
  // 原属座位。**只有被 borrow 借来的单位才有它**,借用方回合结束时按它归还
  // (见 reducer.returnBorrowed)。可选字段 → 老存档/老战报没有它就是「没人是借来的」,
  // 迁移零风险(铁律 6)。
  borrowedFrom?: PlayerIdx
  // ---- 第二十六卡包:士气崩溃 ----
  // 溃散。所属一方士气**触底**(= -MORALE_CAP)时为 true,由 refreshAuras 全权管理
  // (和 auraFrom 一样:每次场面变动整轮重算,不需要任何反向登记)。
  // refreshInstance 读它来压掉「守護」—— 阵线散了就没人挡在前面。
  // 为什么要一个字段而不是在 refreshAuras 里直接改 keywords:
  // `refreshInstance` 在受伤/治疗/加附魔时都会被调,它会**从卡面重新算一遍关键词**,
  // 于是在外面摘掉的守護下一次挨打就长回来了。压制必须和 shieldUsed / stealthBroken
  // 走同一条路 —— 在实例上留一个标记,由 refreshInstance 自己认。
  // 可选字段 → 老存档/老战报没有它就是「没人溃散」,迁移零风险(铁律 6)。
  routed?: boolean
}

export interface PlayerState {
  heroId: string
  heroHp: number
  heroMaxHp: number
  armor: number
  fatigue: number
  mana: { current: number; max: number }
  deck: CardInstance[]
  hand: CardInstance[]
  board: CardInstance[]
  graveyard: string[]
  mulliganDone: boolean
  heroPowerUsed: boolean
  // 主公技升过几阶。**可选字段**:老存档/老战报没有它 → undefined → 视作 0,
  // 迁移零风险(铁律 6)。存在的理由是给 AI 一个**可见的**价值 —— 见 greedy.evaluate:
  // 升阶花掉法力却不改场面,纯贪心永远不会去升,和伏兵一模一样的毛病。
  heroPowerTier?: number
  // ---- 第四卡包 ----
  // 伏兵区。对对手裁剪时只留 iid(见 redact.ts),否则伏兵形同明牌。
  secrets: { iid: number; defId: string }[]
  overloadNext: number // 下回合开始时要锁掉的水晶
  overloadLocked: number // 本回合已被锁掉的水晶(纯展示用,回合开始时结算)
  cardsPlayedThisTurn: number // 连击判定:本回合已打出的牌数
  // ---- 远征 ----
  heroPowerCostDelta: number // 主公技费用修正(远征宝物,整局有效)
  // 主公技随状态走(而不是查 HeroDef 表),这样引擎依旧零外部依赖、状态自足可序列化。
  heroPower?: HeroPowerDef
  // ---- 第二十一卡包:双将 ----
  // 副将技。**与主公技共用 heroPowerUsed** —— 一回合仍然只能用一个。
  // 这是有意的:双将要加的是「这回合该用哪一个」的决策,不是每回合多一次伤害。
  // 白送一次额外主公技等于给每个主义凭空加一条曲线,那条路我们在远征宝物上试过,
  // 一开就再也调不回来。整份嵌在状态里(不查表),理由同 heroPower。
  vicePower?: HeroPowerDef
  // ---- 第二十一卡包:士气 / 粮道 / 计谋链 ----
  // 全部 **可选字段**:老存档/老战报没有它 → undefined → 视作 0,迁移零风险(铁律 6)。
  //
  // 士气 [-MORALE_CAP, MORALE_CAP]。己方武将阵亡 -1,斩掉敌将 +1;
  // 每逢自己的回合开始向 0 收敛一格 —— 没有这条收敛它就是滚雪球,
  // 有了它就是**一段时间窗**:赢下一波交换,你的优势只维持到下一个回合。
  morale?: number
  // 粮道 [0, SUPPLY_CAP]。每逢自己的回合结束 +1,由带 supplyCost 的军需卡花掉,
  // 也可能被敌方的断粮卡削掉。**从有粮掉到 0 的那一刻**扣 1 士气(粮尽),
  // 判据与理由见 resolve.changeSupply —— 是边沿不是电平,开局的 0 不算粮尽。
  supply?: number
  // 计谋链:本回合已结算的锦囊数。**回合开始清零** ——
  // 「连环」讲的是一口气使出来的一串,跨回合攒够四张不叫连环计,叫存牌。
  chain?: number
  // ---- 第二十二卡包 ----
  // 领受中的军令状(上限 QUEST_LIMIT)。对双方公开 —— 对手看得见你在攒什么,
  // 才有「抢在他攒满之前打完」这个决策;藏起来就只是一记闷棍。
  quests?: QuestState[]
  // 已埋下的伏笔。同样对双方公开(见 EffectOp.delay 的说明)。
  delayed?: DelayedScript[]
}

export type GamePhase = 'mulligan' | 'main' | 'ended'
export type Winner = PlayerIdx | 'draw'

// 待决选择:发现机制把对局停在这里等一名玩家挑牌。
// 只要它非空,除了「那名玩家的 ResolveChoice」之外的一切命令都被拒 —— 对局冻在此处。
// 对**非选择方**必须裁掉 options(见 redact.ts),否则对手能提前看到你会拿什么牌。
export interface PendingChoice {
  player: PlayerIdx
  options: string[] // 亮出的候选 defId
  reason: 'discover'
}

export interface GameState {
  seed: number
  rng: number
  turn: number
  activePlayer: PlayerIdx
  phase: GamePhase
  winner?: Winner
  players: [PlayerState, PlayerState]
  nextIid: number
  // 非空时对局暂停,等 pendingChoice.player 发 ResolveChoice(见上)
  pendingChoice?: PendingChoice
  // 名局特殊胜负目标(可选)。不给则走普通「主公归零」判定。
  // **可选字段**是有意的:老存档/老战报没有它 → undefined → 普通判定,迁移零风险(铁律 6)。
  objective?: BattleObjective
  // 战场环境(天时地利)。同上,**可选**是有意的 —— 老存档没有它就是「没有环境」。
  field?: FieldState
}

// ---------- 战场环境(天时地利)----------
//
// 引擎里此前的一切都挂在**角色**上:武将有光环,主公有技能,牌有效果。
// 没有任何东西挂在「战场」本身 —— 于是「赤壁在烧」「大雪封路」「平原利骑」
// 这类古代战争最基本的场景变量,一条都表达不出来。
//
// 设计上抄主公技那条经验:**规则整份存在 state 里,不查表**。
// 引擎必须状态自足、可序列化 —— 存了 id 再去内容层查表,服务端权威对局和
// 回放就会依赖内容版本,老战报一改卡池就解释不出来了。
//
// 三种作用方式,刻意都做成**双方同吃**:环境是战场的属性,不是谁的技能。
//   · turnDamageAll —— 每个回合开始时烧全场(赤壁、火烧连营)
//   · bothStats     —— 双方全体武将 ±X/±Y(隆冬、瘴气)
//   · troopBonus    —— 只加某个兵种(平原利骑、江河利舟)
// 前者走伤害路径(会死人),后两者走**光环的附魔路径**,因此环境一消失
// 增益自动收回,不需要任何反向登记。
export interface FieldRule {
  id: string
  name: LocalizedText
  text: LocalizedText
  turnDamageAll?: number
  bothStats?: { attack: number; health: number }
  troopBonus?: { troop: TroopType; attack: number; health: number }
}

export interface FieldState {
  rule: FieldRule
  // 还剩几个回合(含双方的回合)。undefined = 整局有效。
  turnsLeft?: number
}

// ---------- 第二十一卡包:天时 ----------
//
// 战场环境(FieldRule)是**被打出来的**:一张牌布下赤壁的火,双方同吃。
// 天时不是 —— 它是这局从开始就在走的钟,谁也改不了,双方都看得见下一格是什么。
//
// 这是全游戏唯一一个**零状态**的机制:它完全由 `turn` 推出(见 skyOf),
// 因此 GameState 一个字节都不用加、migrate 一行都不用写、回放天然一致。
// 想「等到天黑再劫营」是玩家自己排回合排出来的,不是靠某张牌抽中的运气。
export type Sky = 'dawn' | 'noon' | 'dusk' | 'night'

// 每个时段占几个回合。取 2 = 双方各轮到一次,所以先后手拿到的天时序列完全一样
// (先手 1/3/5/7 → 晨午暮夜,后手 2/4/6/8 → 同样四段),不给任何一方结构性优势。
export const SKY_SPAN = 2
export const SKY_CYCLE = ['dawn', 'noon', 'dusk', 'night'] as const

// ---------- 第二十一卡包:阵形 ----------
//
// `AuraDef.scope === 'adjacent'` 让「摆在哪儿」第一次有了意义,但它只看**左右邻居**。
// 阵形看的是**整条战线的形状**:人够不够多、两翼有没有人、是不是清一色同兵种。
//
// 定义整份挂在锚点卡上(和 bond / rival 同源),而不是在引擎里建一张 id → 规则的表 ——
// 引擎不查表这条铁律在主公技和战场环境上已经交过两次学费:存 id 去内容层查,
// 服务端权威对局和老战报就会依赖内容版本。
//
// 判定是 board 与 lib 的纯函数,每次场面变动由 refreshAuras 整轮重算,
// 走的还是光环那条附魔路径 —— 阵形一散,增益自动收回,不需要任何反向登记。
// 八阵。前四种是第二十一卡包的,后四种 2026-08-08 补齐 ——
// 「八阵图还差一半」这件事本身就是这条轴最大的问题:四种里有两种
// (长蛇要满员、鱼鳞要三个同兵种)门槛高到几乎摆不出来,于是实际能玩的只有两种。
//
// 补的四种刻意都**只看战线人数与位置**(不看兵种),门槛**统一是 3** ——
// 那是真正会出现的场面。而且每一种吃到的位置各不相同,
// 摆放顺序因此第一次真的有讲究(legalCommands 早就为阵形展开了插入位)。
export type FormationShape =
  | 'wedge' // 锋矢:己方 ≥3 人 → 最左那名(阵头)吃增益
  | 'crane' // 鹤翼:己方 ≥4 人 → 最左与最右(两翼)吃增益
  | 'scale' // 鱼鳞:己方有 ≥3 名与锚点同兵种者 → 这些同袍一起吃
  | 'serpent' // 长蛇:己方满员 → 全体吃
  // ---- 第二十九卡包:八阵补齐 ----
  | 'crescent' // 偃月:己方 ≥3 人 → **正中**那名(偶数人取靠左的中)吃增益
  | 'square' // 方圆:己方 ≥3 人 → 锚点与其左右紧邻(三人抱团结阵自守)
  | 'goose' // 雁行:己方 ≥3 人 → 锚点**右侧**的全部友军(斜行雁阵)
  | 'yoke' // 衡轭:己方 ≥3 人 → 除首尾之外的中军 —— n≥4 时正好是鹤翼的补集

export interface FormationDef {
  id: string
  name: LocalizedText
  shape: FormationShape
  attack: number
  health: number
  keywords?: Keyword[]
}

// 历史名战的特殊胜负目标(座位 0 = 玩家视角)。引擎在 checkGameEnd 里判。
// 三类共用一个钩子:守成看回合数;斩将/护送按 iid 标记一个单位,靠 GeneralDied 事件判死。
// targetIid 由 createGame 解析(开局在 targetSide 场上找 targetDefId 的实例),内容层只给选择器。
export type BattleObjective =
  | { kind: 'survive'; turns: number } // 座位 0 撑过第 `turns` 回合(含双方)即胜
  | ({ kind: 'assassinate' } & ObjectiveUnit) // 斩掉敌方指定单位即胜(座位 0 胜)
  | ({ kind: 'protect' } & ObjectiveUnit) // 我方指定单位阵亡即负(座位 0 负)

export interface ObjectiveUnit {
  targetSide: PlayerIdx // 目标单位所在座位
  targetDefId: string // 目标单位的卡 id(开局态势 startTokens 放上场的那个)
  targetName: LocalizedText // UI 显示用(斩「顏良」/ 护「幼主」)
  targetIid?: number // createGame 解析出的实例 id;未解析到则该目标永不触发
}

// ---------- 命令(玩家意图) ----------

export type TargetRef =
  | { kind: 'hero'; player: PlayerIdx }
  | { kind: 'general'; iid: number }

export type Command =
  | { type: 'Mulligan'; keepIids: number[] }
  | { type: 'PlayCard'; iid: number; boardPos?: number; target?: TargetRef; mode?: number }
  | { type: 'Attack'; attackerIid: number; target: TargetRef }
  // vice: true 时用的是副将技(见 PlayerState.vicePower)。两者共用每回合一次的额度。
  | { type: 'UseHeroPower'; target?: TargetRef; vice?: boolean }
  // 升级主公技:花 upgradeCost 把 heroPower 换成 heroPower.upgrade。一局一次。
  | { type: 'UpgradeHeroPower' }
  | { type: 'EndTurn' }
  // 发现:回应一个待决选择(pendingChoice)。index 指向亮出的第几张。
  | { type: 'ResolveChoice'; index: number }
  | { type: 'Concede' }

// ---------- 事件(UI 动画与观战/回放的唯一来源) ----------

export type GameEvent =
  | { type: 'MulliganDone'; player: PlayerIdx; replacedCount: number }
  | { type: 'TurnStarted'; player: PlayerIdx; turn: number; mana: number }
  | { type: 'TurnEnded'; player: PlayerIdx; turn: number }
  | { type: 'CardDrawn'; player: PlayerIdx; iid: number; defId: string }
  | { type: 'CardBurned'; player: PlayerIdx; defId: string }
  | { type: 'FatigueDamage'; player: PlayerIdx; amount: number }
  | { type: 'HeroDamaged'; player: PlayerIdx; amount: number; hpAfter: number }
  | { type: 'HeroHealed'; player: PlayerIdx; amount: number; hpAfter: number }
  | { type: 'CardPlayed'; player: PlayerIdx; iid: number; defId: string; cost: number }
  | {
      type: 'GeneralSummoned'
      player: PlayerIdx
      iid: number
      defId: string
      position: number
      attack: number
      health: number
    }
  | {
      type: 'EffectTriggered'
      player: PlayerIdx
      sourceIid?: number
      sourceDefId: string
      kind:
        | 'battlecry'
        | 'deathrattle'
        | 'spell'
        | 'endOfTurn'
        | 'startOfTurn'
        | 'onDamaged'
        | 'onAttack'
        | 'onSpellCast'
        | 'heroPower'
        | 'combo'
        | 'delayed' // 伏笔到期
        | 'quest' // 军令状达成
    }
  | { type: 'GeneralDamaged'; player: PlayerIdx; iid: number; amount: number; healthAfter: number }
  | { type: 'GeneralHealed'; player: PlayerIdx; iid: number; amount: number; healthAfter: number }
  | {
      type: 'GeneralBuffed'
      player: PlayerIdx
      iid: number
      attack: number
      health: number
    }
  | { type: 'KeywordGranted'; player: PlayerIdx; iid: number; keyword: Keyword }
  | { type: 'HeroPowerUpgraded'; player: PlayerIdx; powerId: string }
  // 战场环境布下 / 消散(rule 为 undefined 表示消散)
  | { type: 'FieldChanged'; rule?: FieldRule }
  // ---- 第二十一卡包 ----
  | { type: 'MoraleChanged'; player: PlayerIdx; morale: number; delta: number }
  | { type: 'SupplyChanged'; player: PlayerIdx; supply: number; delta: number }
  | { type: 'ChainAdvanced'; player: PlayerIdx; chain: number }
  | { type: 'ChainTriggered'; player: PlayerIdx; defId: string }
  // 天时换段。零状态(由 turn 推出),事件只是给 UI 一个「该播报了」的信号。
  | { type: 'SkyChanged'; sky: Sky; turn: number }
  | { type: 'GeneralDied'; player: PlayerIdx; iid: number; defId: string }
  // 将星陨落:**传奇**武将阵亡。零状态 —— 士气那额外一格由 changeMorale 单独发事件,
  // 这一条只是给 UI 一个「该播报了」的信号(同 SkyChanged 的取舍)。
  | { type: 'LegendFell'; player: PlayerIdx; iid: number; defId: string }
  | {
      type: 'AttackResolved'
      attacker: PlayerIdx
      attackerIid: number
      target: TargetRef
      damageToTarget: number
      damageToAttacker: number
    }
  | {
      type: 'DuelFought'
      challenger: PlayerIdx
      challengerIid: number
      defenderIid: number
      firstStrikeIid?: number
      challengerDied: boolean
      defenderDied: boolean
    }
  // ---- 第二卡包 ----
  | { type: 'EquipmentAttached'; player: PlayerIdx; targetIid: number; defId: string }
  | { type: 'ArmorGained'; player: PlayerIdx; amount: number; armorAfter: number }
  | { type: 'GeneralReturned'; player: PlayerIdx; iid: number; defId: string }
  | { type: 'CardDiscarded'; player: PlayerIdx; iid: number; defId: string }
  // ---- 第三卡包 ----
  | { type: 'DivineShieldPopped'; player: PlayerIdx; iid: number }
  | { type: 'GeneralSilenced'; player: PlayerIdx; iid: number }
  | { type: 'GeneralFrozen'; player: PlayerIdx; iid: number }
  | { type: 'GeneralUnfrozen'; player: PlayerIdx; iid: number }
  | { type: 'StealthBroken'; player: PlayerIdx; iid: number }
  | { type: 'ManaGained'; player: PlayerIdx; amount: number; temporary: boolean }
  // ---- 第四卡包 ----
  // defId 对**对手**要抹掉(redactEvent),否则伏兵一打出就暴露。
  | { type: 'SecretPlayed'; player: PlayerIdx; iid: number; defId: string }
  | { type: 'SecretRevealed'; player: PlayerIdx; iid: number; defId: string }
  | { type: 'ComboTriggered'; player: PlayerIdx; iid: number; defId: string }
  | { type: 'ManaOverloaded'; player: PlayerIdx; amount: number } // 打出时记账
  | { type: 'ManaLocked'; player: PlayerIdx; amount: number } // 下回合开始时真的扣
  | {
      type: 'HeroPowerUsed'
      player: PlayerIdx
      heroId: string
      powerId: string
      cost: number
    }
  // ---- 第五卡包 ----
  | { type: 'ChooseModePlayed'; player: PlayerIdx; defId: string; mode: number } // 抉择选了哪个模式
  // 发现开始。options 对**非选择方**要抹空(redactEvent),否则对手提前知道你在挑什么。
  | { type: 'DiscoverStarted'; player: PlayerIdx; options: string[]; reason: 'discover' }
  | { type: 'DiscoverPicked'; player: PlayerIdx; defId: string } // 选定后加入手牌(defId 对对手同样要抹)
  // ---- 第七卡包 ----
  | { type: 'CardCostChanged'; player: PlayerIdx; iid: number; cost: number } // 费用消减后的有效费
  | { type: 'CardGenerated'; player: PlayerIdx; iid: number; defId: string } // 生成进手牌(defId 对对手抹)
  // ---- 第八卡包 ----
  | { type: 'GeneralBanished'; player: PlayerIdx; iid: number; defId: string }
  | {
      type: 'GeneralSeized'
      player: PlayerIdx // 夺取方
      iid: number
      defId: string
      from: PlayerIdx // 原属方
      position: number
    }
  | { type: 'GeneralTransformed'; player: PlayerIdx; iid: number; intoIid: number; defId: string }
  // ---- 第二十二卡包 ----
  // 洗入牌库。牌库内容本来就是暗的,但**塞了什么进去**必须是公开的 ——
  // 否则对手抽到一张自己牌组里没有的废牌时,完全不知道发生过什么。
  | { type: 'CardShuffledIn'; player: PlayerIdx; defId: string; count: number }
  // 装备损毁:耐久耗尽,那条附魔被摘掉
  | { type: 'EquipmentBroken'; player: PlayerIdx; iid: number; defId: string }
  // 手牌中成长(iid 指向**手牌里**那张,不是场上的)
  | { type: 'HandCardGrew'; player: PlayerIdx; iid: number; defId: string; attack: number; health: number }
  // 军令状:领受 / 进度 / 达成
  | { type: 'QuestTaken'; player: PlayerIdx; defId: string; goal: number }
  | { type: 'QuestProgressed'; player: PlayerIdx; defId: string; progress: number; goal: number }
  | { type: 'QuestCompleted'; player: PlayerIdx; defId: string }
  // 伏笔埋下(到期结算走 EffectTriggered kind:'delayed')
  | { type: 'DelaySet'; player: PlayerIdx; defId: string; turns: number }
  | { type: 'GameEnded'; winner: Winner }

// ---------- 对局配置与 API 结果 ----------

// 远征(单人 roguelike)修正:关间宝物累积成这些,开局施加给对应座位。
// 刻意做成结构化字段(而不是任意脚本):这样纯、可测、可复现,而且平衡好推。
export interface RunModifiers {
  startArmor?: number // 开局护甲
  bonusHandSize?: number // 起手多抽几张
  startTokens?: string[] // 开局场上的衍生物 defId
  handCostDelta?: number // 起手全部手牌费用 +N(负=更便宜)
  heroPowerCostDelta?: number // 主公技费用 +N(负=更便宜),整局有效
  startMorale?: number // 开局士气
  startSupply?: number // 开局屯粮
  vicePower?: HeroPowerDef // 副将:多一个可选的主公技(仍然每回合只能用一个)
  // 开局自带一道军令状(见 QuestDef)。**只发在 PvE 侧** —— 远征宝物 / 兵书 / 乱斗,
  // 那几个模式没有平衡闸门。给玩家侧加常驻强度的东西进天梯要单独调一轮,
  // 这条经验在主公技升阶上交过学费。
  startQuest?: QuestDef
}

// ---------- 斩杀谜题:指定残局 ----------
// 谜题模式需要一个**确定的残局**(而不是发牌洗牌开局):敌方场上有指定血量/受伤/buff
// 的随从,你手里是指定的一手牌,双方指定 HP/护甲/法力。它只影响**初始构造**,
// 产出的 GameState 形状与普通对局完全一致 —— 因此迁移/裁剪/回放/AI 全部无感。
// 随机效果(随机目标等)按 seed 确定性结算,作者需为带随机的题挑好 seed。
export interface PuzzleUnit {
  defId: string
  damage?: number // 已承受伤害;health = maxHealth - damage(会夹到至少留 1)
  enchants?: Enchant[] // 预置附魔(+X/+X、临时关键词…)
  exhausted?: boolean // 默认 false —— 谜题里我方单位默认是「回合开始已就绪、能攻击」
  attacksUsed?: number
  frozen?: boolean
  silenced?: boolean
}
export interface PuzzleSide {
  heroHp: number
  heroMaxHp?: number // 默认 max(heroHp, START_HP)
  armor?: number
  mana: number // 本回合可用水晶(current 与 max 同时设为它)
  board: PuzzleUnit[]
  hand: string[] // 手牌 defId
  deck?: string[] // 默认空 —— 谜题这回合就结束,通常不摸牌
  secrets?: string[] // 预置伏兵 defId(敌方伏兵可作谜题元素)
  heroPowerUsed?: boolean // 默认 false(本回合可用主公技)
  heroPowerCostDelta?: number
  supply?: number // 预置粮道(军需卡入题时要给,否则那张牌打不出来)
}
export interface PuzzleScenario {
  players: [PuzzleSide, PuzzleSide]
  activePlayer: PlayerIdx
  // 生成类谜题(从真实对局挖出的残局)保留挖矿时的 rng,让随机效果的解法可复现。
  // 不给则按 seed 起 rng —— 手搓题都避开随机,不需要它。
  rng?: number
}

// 羁绊定义:挂在「锚点」卡上。members 是**除锚点之外**还需在场的卡 id。
export interface BondDef {
  id: string // 羁绊 id(桃園結義…),UI 与测试用
  name: LocalizedText // 羁绊名 —— 卡面文案与图鉴都读它
  members: string[]
  attack: number
  health: number
}

// 宿敌定义:羁绊的镜面。挂在锚点卡上,`foe` 在**敌方**场上时才成立,
// 且**双方一起**吃增益 —— 历史上真打过的人在牌桌上重逢,谁都不吃亏。
//
// 只在一侧声明即可:引擎两个方向都扫(见 resolve.refreshAuras),
// 所以「我方项羽 vs 敌方韩信」与「我方韩信 vs 敌方项羽」都会触发同一条。
export interface RivalDef {
  id: string
  name: LocalizedText
  foe: string // 敌方场上需要出现的卡 id
  attack: number
  health: number
}

// 家族 —— 羁绊的规模化版本。
//
// 羁绊要点名列成员,所以它只能覆盖「桃園結義」这种**有名字的**关系,
// 三十来条就到头了(实测覆盖 4.3% 的武将)。而「谁和谁是一家人」在史料里
// 是成百上千条:生平原文写着「夏侯惇之從弟」「關羽長子」「馬良之弟」——
// 照抄就有 328 组、155 个家族、455 名武将。
//
// 所以家族**不挂锚点**:同族的每个人都带同一个 clan.id,场上凑够两个就成立。
// 没有「谁是这条羁绊的主人」这个概念,也就不需要 O(n²) 地互相点名。
//
// 定价:条件比羁绊松得多(曹氏 27 人,随便两个都算),所以只给 CLAN_BONUS
// 那一档,而且**不随人数叠加** —— 摆三个曹家人也还是各 +1/+1。
// 叠加会让宗族牌组在六费直接滚雪球,那是另一个游戏。
export interface ClanDef {
  id: string // 家族 id(clan-cao…)
  name: LocalizedText // 「曹氏」/ House of Cao
  size: number // 全卡池里的族人数 —— 卡面文案要写,免得玩家以为同姓就算
}

export interface GameConfig {
  seed: number
  heroIds: [string, string]
  deckIds: [string[], string[]]
  first: PlayerIdx
  // 可选:不给则无主公技、血量按 START_HP(旧测试与教学局走这条路)
  heroPowers?: [HeroPowerDef | undefined, HeroPowerDef | undefined]
  // 双将:副将技,按座位。不给则该座位没有副将。
  vicePowers?: [HeroPowerDef | undefined, HeroPowerDef | undefined]
  heroHps?: [number, number]
  // 远征宝物修正,按座位。只有远征模式会给。
  modifiers?: [RunModifiers | undefined, RunModifiers | undefined]
  // 斩杀谜题:给定则跳过发牌,按残局铺场(heroId/heroPower 仍走上面的字段)。
  scenario?: PuzzleScenario
  // 名局特殊胜负目标:给定则写进 GameState.objective,由 checkGameEnd 判。
  objective?: BattleObjective
  // 开局就存在的战场环境(关底战的「地利」)。与 objective 同样是可选字段。
  field?: FieldState
}

export type ApplyResult =
  | { ok: true; state: GameState; events: GameEvent[] }
  | { ok: false; error: string }

// ---------- 规则常量 ----------

export const START_HP = 30
export const HAND_LIMIT = 10
export const BOARD_LIMIT = 6
export const MANA_CAP = 10
export const TURN_LIMIT = 200
export const DECK_SIZE = 30
export const SECRET_LIMIT = 5 // 伏兵区上限
export const OPENING_HAND = [3, 4] as const

/**
 * 后手补偿 —— **默认规则的一部分**,不是模式修饰符。
 * `RunModifiers`(远征宝物那些)叠加在它之上,不是替代。
 *
 * 【为什么必须有】
 * 不补的时候先手胜率是 **73.8%**(六套预组自我对镜,各 400 局,合计 2400 局,±1.0)——
 * 先手方赢的概率是后手方的 2.82 倍。六套之间高度一致(70.5–78.0),
 * 所以这不是某套牌的毛病,是游戏本身的。
 * 也不是贪心 AI 的假象:换五档差异极大的 AI 量,先手优势稳定在 +16.9 ~ +24.4。
 * 起手牌 3/4 那一张显然补不回二十多个点。
 *
 * 【为什么是这两个旋钮】
 * 十六个方案都量过(`COMP=sweep npm run sim-firstplayer`)。落在 45–55% 的有好几个,
 * **但只看平均值会选错** —— 2026-08-06 落地过 `hp-1,hand+1`(平均 50.8%),
 * 先手优势确实压到 51.7%,然后 sim-balance 红了:魏武揮鞭 62.2%、坐斷東南 35.0%。
 * 病根是**补偿均匀给,而先手优势不均匀**:那个方案把六套的离散度从 7.5pp 推到 24.0pp。
 *
 * 所以选方案要同时看「够不够」和「匀不匀」(sim-firstplayer 的扫描表现在有离散度这一列)。
 * 各 400 局/套的实测:
 *
 *   方案              合计    离散
 *   none             73.8%    7.5
 *   cost-1,armor+3   51.8%   12.3   ← 选它
 *   cost-1,armor+6   50.1%   13.0
 *   hand+2,armor+6   52.8%   23.0
 *   hp-1,hand+1      51.0%   23.3   ← 2026-08-06 翻车的那个
 *
 * 两个 `cost-1` 方案的离散度只有另外两个的一半,而且这**有机理**:
 * 减起手牌的费用每套预组都吃得到;主公技减费和多抽一张则挑卡组
 * (坐斷東南 用主公技的频率低,所以它几乎吃不到 `hp-1`)。
 *
 * 在两个 cost-1 里选了 armor **+3 而不是 +6**:铁律 8 说这把尺子
 * **系统性低估护甲**(贪心 AI 对治疗与护甲的评分近乎为零),
 * 所以 AI 量到 51.8% 的方案,对真人只会更接近 50;
 * 而 AI 量到 50.1% 的那个,对真人反而会补过头。宁可让先手保留一点点优势。
 *
 * ⚠️ `handCostDelta` 是**近似**而不是「先攻币」:它让起手每张牌永久便宜 1 费
 * (附魔层实现,打出去之前一直有效),比一次性 +1 法力更持久。
 * 要做真正的币得给后手发一张一次性的 `gainMana{temporary:true}` 锦囊 ——
 * 那是内容层的事,上线前单独量一遍。
 */
export const SECOND_PLAYER_COMP = { handCostDelta: -1, startArmor: 3 } as const
// ---- 第二十一卡包 ----
export const MORALE_CAP = 3 // 士气绝对值上限
export const MORALE_THRESHOLD = 2 // |士气| 达到它才产生场面效果(±1 攻)
export const SUPPLY_CAP = 10 // 粮道上限
export const CHAIN_TRIGGER = 3 // 本回合第 CHAIN_TRIGGER+1 张锦囊结算两次
// ---- 第二十二卡包 ----
// 军令状同时只能领一道。多道并行会变成「开局甩三张,后面躺着等」——
// 军令状要的是**这一局你打算怎么打**这一个决定,不是一张待办清单。
export const QUEST_LIMIT = 1
// 攻城:攻击主公时的额外伤害。写成常量是因为它会被定价脚本读到 ——
// 散在卡面上的话,以后想调这条轴就得挨张改。
export const SIEGE_BONUS = 2
// 家族:同族 ≥CLAN_QUORUM 人同时在场时,这些人各 +CLAN_ATTACK/+CLAN_HEALTH。
// 两人就成立,是因为大多数家族只有两个人(155 个家族里 101 个是两人);
// 门槛提到三,那 101 个就等于没做。
export const CLAN_QUORUM = 2
// 只加血不加攻 —— 和士气那条常量的取舍正好相反,理由也正好相反:
// 宗族是**聚而不散**,不是打得更凶。而且实测加攻不行:+1/+1 时
// 魏武揮鞭(曹昂/曹叡/曹霖 五张同族)从 50% 冲到 61.8%,矩阵直接出闸门 ——
// 贪心 AI 把攻击直接换成脸伤,而血只换来多活一轮。
export const CLAN_ATTACK = 0
export const CLAN_HEALTH = 1
