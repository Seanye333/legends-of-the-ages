import type { CardDef } from '../../engine/types'

// 羁绊(結義 / 君臣 / 師徒)—— 把**真实历史关系**变成构筑动机。
//
// 卡池是 2300 位真实人物,他们之间有真实存在的关系:这是编造世界观的 CCG
// 永远拿不到的素材。羁绊让构筑有了叙事 —— 你不是在配曲线,是在**重组一段历史**。
//
// 实现挂在**锚点卡**的 `bond` 字段上(与 aura 同源,引擎只读 lib,不 import 内容层)。
// members 是「除锚点外还需在场的卡」;凑齐了,锚点与全体成员一起吃增益。
// 走光环的附魔路径 → 成员被杀/被策反/回手时羁绊自动断裂、增益自动收回,
// **不能**写成一次性 buffStats(那没有撤销路径)。
//
// 定价:羁绊要求同时在场多张指定卡,是很硬的条件(还得抽到、还得活着),
// 所以给得比同费光环大方一档;但刻意避开「+攻很高」的组合,免得变成斩杀跳板。
//
// `name` 不是装饰:卡面文案(cards.ts withBondText)、图鉴详情、构筑器的
// 「这套牌能凑成哪几条」三处都读它。**加羁绊必须给名字**,tsc 会强制。

export const BOND_OVERRIDES: Record<string, Partial<CardDef>> = {
  // 桃園結義:三人齐聚,全体 +2/+2。本作最有辨识度的一条。
  'liu-bei': {
    bond: {
      id: 'bond-taoyuan',
      name: { zh: '桃園結義', en: 'Peach Garden Oath' },
      members: ['guan-yu', 'zhang-fei'],
      attack: 2,
      health: 2,
    },
  },
  // 臥龍鳳雛:得一可安天下 —— 两人同场,彼此 +2/+2。
  'zhuge-liang': {
    bond: {
      id: 'bond-wolong',
      name: { zh: '臥龍鳳雛', en: 'Dragon and Phoenix' },
      members: ['pang-tong'],
      attack: 2,
      health: 2,
    },
  },
  // 總角之好(孫策 · 周瑜):升堂拜母、有无通共,共定江东。
  // (原名「江東二喬」名不副实 —— 二乔是两人的夫人,不是两人本身。)
  'sun-ce': {
    bond: {
      id: 'bond-jiangdong',
      name: { zh: '總角之好', en: 'Sworn Since Boyhood' },
      members: ['zhou-yu'],
      attack: 1,
      health: 2,
    },
  },
  // 鬼谷門下(孫臏 · 龐涓):同門相殘 —— 只加攻,不加血,呼应那段互相算计的史事。
  // 另有一条同名宿敌(见 rivals.ts):同侧是同门,异侧是马陵道。
  'hist-sun-bin': {
    bond: {
      id: 'bond-guigu',
      name: { zh: '鬼谷門下', en: 'Disciples of Guiguzi' },
      members: ['hist-pang-juan'],
      attack: 2,
      health: 0,
    },
  },
  // 漢初三傑(張良 · 蕭何 · 韓信):运筹帷幄、镇国抚民、战必胜攻必取。
  'hist-zhang-liang': {
    bond: {
      id: 'bond-sanjie',
      name: { zh: '漢初三傑', en: 'Three Heroes of Han' },
      members: ['hist-xiao-he', 'hist-han-xin'],
      attack: 2,
      health: 2,
    },
  },

  // ============================================================
  // 三国势力羁绊 —— 势力标签回填(魏 192 / 蜀 119 / 吴 144)之后才立得住:
  // 从前魏蜀吴各只有十来张,凑不出任何一条势力主题。
  //
  // 刻意都设计成**两名成员**(锚点 + 2 人 = 场上三人)。三人已是很硬的条件
  // (要抽到、要活着、要同时在场);再往上加人就只剩「赢了才凑得齐」的废卡。
  // ============================================================

  // 五虎上將(蜀):关张已在桃园结义,这条给另外三虎 —— 赵马黄。
  'zhao-yun': {
    bond: {
      id: 'bond-wuhu',
      name: { zh: '五虎上將', en: 'Five Tiger Generals' },
      members: ['ma-chao', 'huang-zhong'],
      attack: 2,
      health: 2,
    },
  },
  // 五子良將(魏):张辽 · 徐晃 · 于禁(乐进/张郃 不在池中或已归群)。
  'zhang-liao': {
    bond: {
      id: 'bond-wuzi',
      name: { zh: '五子良將', en: 'Five Elite Generals' },
      members: ['xu-huang', 'yu-jin'],
      attack: 2,
      health: 1,
    },
  },
  // 虎癡與惡來(魏):许褚 · 典韦,曹操的两大保镖 —— 只加身板,不加攻。
  'xu-chu': {
    bond: {
      id: 'bond-huchi',
      name: { zh: '虎癡與惡來', en: "The Warlord's Shields" },
      members: ['dian-wei'],
      attack: 0,
      health: 3,
    },
  },
  // 江東虎臣(吴):程普 · 黄盖 · 韩当,孙氏三代老臣。
  'cheng-pu': {
    bond: {
      id: 'bond-hucheng',
      name: { zh: '江東虎臣', en: 'Tiger Vassals of Wu' },
      members: ['huang-gai', 'han-dang'],
      attack: 1,
      health: 3,
    },
  },
  // 江東四英(吴):周瑜已在总角之好,这条接周瑜之后的三任大都督 —— 鲁肃 · 陆逊。
  'lu-su': {
    bond: {
      id: 'bond-siying',
      name: { zh: '江東四英', en: 'Four Commanders of Wu' },
      members: ['lu-xun'],
      attack: 1,
      health: 2,
    },
  },

  // ============================================================
  // 各时代块羁绊 —— 三国之外的朝代按「时代块」铺(单个朝代 37~161 张太薄,
  // 合成先秦/秦汉/隋唐/宋元/明清五块才撑得起身份)。
  // 同样是锚点 + 1~2 人,历史关系全部取自正史中最有名的那几对。
  // ============================================================

  // ---- 先秦 ----
  // 管鮑之交(管仲 · 鮑叔牙):生我者父母,知我者鲍子也 —— 知遇之恩,天下第一交情。
  'hist-guan-zhong': {
    bond: {
      id: 'bond-guanbao',
      name: { zh: '管鮑之交', en: 'Guan and Bao' },
      members: ['hist-bao-shuya'],
      attack: 1,
      health: 3,
    },
  },
  // 同佐吳王(伍子胥 · 孫武):一个复仇一个用兵,五战破楚入郢。
  // (原名「吳越爭霸」指的是后来吴越那场,与这两人共事的时段对不上。)
  'hist-wu-zixu': {
    bond: {
      id: 'bond-wuyue',
      name: { zh: '同佐吳王', en: 'Serving the King of Wu' },
      members: ['hist-sun-wu'],
      attack: 2,
      health: 1,
    },
  },
  // 將相和(廉頗 · 藺相如):负荆请罪,将相和而赵国安。
  'hist-lian-po': {
    bond: {
      id: 'bond-jiangxiang',
      name: { zh: '將相和', en: 'General and Minister Reconciled' },
      members: ['hist-lin-xiangru'],
      attack: 1,
      health: 3,
    },
  },
  // 臥薪嘗膽(勾踐 · 范蠡):十年生聚,十年教训。
  'hist-goujian': {
    bond: {
      id: 'bond-woxin',
      name: { zh: '臥薪嘗膽', en: 'Sleeping on Brushwood' },
      members: ['hist-fan-li'],
      attack: 2,
      health: 1,
    },
  },
  // 孫吳兵法(孫武 · 孫臏):兵圣与其后世,兵家之祖孙同堂。
  'hist-sun-wu': {
    bond: {
      id: 'bond-sunwu',
      name: { zh: '孫吳兵法', en: 'The Sun Art of War' },
      members: ['hist-sun-bin'],
      attack: 2,
      health: 2,
    },
  },
  // 商鞅變法(商鞅 · 秦孝公):君臣相得,秦法始行 —— 只加身板,变法靠的是根基。
  'hist-shang-yang': {
    bond: {
      id: 'bond-bianfa',
      name: { zh: '商鞅變法', en: "Shang Yang's Reforms" },
      members: ['hist-qin-xiaogong'],
      attack: 0,
      health: 4,
    },
  },

  // ---- 秦汉 ----
  // 漢初開國(劉邦 · 樊噲):鸿门宴上挡在前面的那个人。
  'hist-liu-bang': {
    bond: {
      id: 'bond-hanchu',
      name: { zh: '漢初開國', en: 'Founding of Han' },
      members: ['hist-fan-kuai'],
      attack: 2,
      health: 2,
    },
  },

  // 帝國雙璧(衛青 · 霍去病):舅甥同为大将军骠骑,漠北一役封狼居胥。
  'hist-wei-qing': {
    bond: {
      id: 'bond-shuangbi',
      name: { zh: '帝國雙璧', en: 'Twin Jades of the Empire' },
      members: ['hist-huo-qubing'],
      attack: 2,
      health: 2,
    },
  },
  // 蕭規曹隨(蕭何 · 曹參):萧何定的规矩,曹参一条不改 —— 清静而治,只加身板。
  'hist-xiao-he': {
    bond: {
      id: 'bond-xiaogui',
      name: { zh: '蕭規曹隨', en: "Cao Follows Xiao's Rules" },
      members: ['hist-cao-can'],
      attack: 0,
      health: 4,
    },
  },

  // ---- 隋唐 ----
  // 凌煙閣(李世民 · 尉遲恭 · 秦瓊):二十四功臣里最能打的两位门神。
  'hist-tang-taizong': {
    bond: {
      id: 'bond-lingyan',
      name: { zh: '凌煙閣', en: 'Lingyan Pavilion' },
      members: ['hist-yuchi-gong', 'hist-qin-qiong'],
      attack: 2,
      health: 2,
    },
  },
  // 房謀杜斷(房玄齡 · 杜如晦):一个善谋,一个善断。
  'hist-fang-xuanling': {
    bond: {
      id: 'bond-fangdu',
      name: { zh: '房謀杜斷', en: 'Fang Plans, Du Decides' },
      members: ['hist-du-ruhui'],
      attack: 1,
      health: 2,
    },
  },

  // 大唐二李(李靖 · 李勣):唐初两大军神,一个灭突厥一个平高丽。
  'hist-li-jing': {
    bond: {
      id: 'bond-erli',
      name: { zh: '大唐二李', en: 'The Two Li of Tang' },
      members: ['hist-li-ji'],
      attack: 2,
      health: 2,
    },
  },
  // 再造唐室(郭子儀 · 李光弼):安史之乱里把唐朝从悬崖边拉回来的两个人。
  'hist-guo-ziyi': {
    bond: {
      id: 'bond-zaizao',
      name: { zh: '再造唐室', en: 'Rebuilders of Tang' },
      members: ['hist-li-guangbi'],
      attack: 1,
      health: 3,
    },
  },

  // ---- 宋元 ----
  // 楊家將(楊業 · 楊延昭):父子守边,金沙滩上没回来的那一家。
  'hist-yang-ye': {
    bond: {
      id: 'bond-yangjia',
      name: { zh: '楊家將', en: 'The Yang Family Generals' },
      members: ['hist-yang-yanzhao'],
      attack: 1,
      health: 3,
    },
  },
  // 岳家軍(岳飛 · 韓世忠):中兴四将里最硬的两位 —— 撼山易,撼岳家军难。
  'hist-yue-fei': {
    bond: {
      id: 'bond-yuejia',
      name: { zh: '岳家軍', en: 'The Yue Family Army' },
      members: ['hist-han-shizhong'],
      attack: 2,
      health: 2,
    },
  },

  // 杯酒釋兵權(趙匡胤 · 趙普):一杯酒收了兵权 —— 谋在酒里,不在刀上。
  'hist-zhao-kuangyin': {
    bond: {
      id: 'bond-beijiu',
      name: { zh: '杯酒釋兵權', en: 'Cups of Wine, Surrendered Command' },
      members: ['hist-zhao-pu'],
      attack: 1,
      health: 2,
    },
  },
  // 宋末三傑(文天祥 · 陸秀夫):崖山之后,负帝投海的那两位 —— 只加血,守到最后一刻。
  'hist-wen-tianxiang': {
    bond: {
      id: 'bond-songmo',
      name: { zh: '宋末三傑', en: 'Last Loyalists of Song' },
      members: ['hist-lu-xiufu'],
      attack: 0,
      health: 4,
    },
  },

  // ---- 明清 ----
  // 開國元勳(徐達 · 常遇春):一个持重,一个先锋,朱元璋的左右手。
  'hist-xu-da': {
    bond: {
      id: 'bond-kaiguo',
      name: { zh: '開國元勳', en: 'Founding Marshals' },
      members: ['hist-chang-yuchun'],
      attack: 2,
      health: 2,
    },
  },
  // 戚家軍(戚繼光 · 俞大猷):抗倭双璧,鸳鸯阵与俞家棍。
  'hist-qi-jiguang': {
    bond: {
      id: 'bond-qijia',
      name: { zh: '戚家軍', en: 'The Qi Family Army' },
      members: ['hist-yu-dayou'],
      attack: 1,
      health: 3,
    },
  },
  // 帝師劉基(朱元璋 · 劉伯溫):三分天下诸葛亮,一统江山刘伯温。
  'hist-zhu-yuanzhang': {
    bond: {
      id: 'bond-dishi',
      name: { zh: '帝師劉基', en: "The Emperor's Strategist" },
      members: ['hist-liu-bowen'],
      attack: 2,
      health: 2,
    },
  },
  // 鄭氏水師(鄭成功 · 鄭和):两代下西洋与收台湾的海上力量,同姓不同代,取其「水师」意象。
  'hist-zheng-chenggong': {
    bond: {
      id: 'bond-zhengshi',
      name: { zh: '鄭氏水師', en: 'The Zheng Fleet' },
      members: ['hist-zheng-he'],
      attack: 1,
      health: 3,
    },
  },

  // ================================================================ 師承(2026-08-08)
  //
  // 【为什么师承不是一条新机制,而是羁绊的一批新条目】
  // ROADMAP 把「师承机制化」和「羁绊 31 → 50」列成两条,做的时候发现它们是同一件事:
  // 师承的形状就是羁绊的形状 —— 两个人同时在场,彼此变强。
  // 再造一套平行的「师承」子系统,就是这个仓库反复吃亏的那件事:
  // **两张同效果的卡并排站着**(见 pack24 的重名教训)。所以这里只加条目,不加机制。
  //
  // 【来源:关系网里现成的 38 条 `mentor` 边,每条都带生平原文】
  // 不是我编的师徒关系,是生平原文里互相点名的(`lore.gen.ts` 的 RELATION_EDGES)。
  // 逐条注释里附了那句原文 —— 这和 lore-quotes.ts 的规矩一致:
  // 拿不准的宁可不写。38 条里两边都在池、两边都还没挂羁绊的有 37 条,
  // 这里取 21 条(羁绊 31 → 52),挑的是**能认得出来**的那些。
  //
  // 【两条设计上的自我约束】
  // 1. **孔门只取十哲一档的八个**,不是全部二十四个。全收的话孔子会变成一张
  //    「场上随便再来一个弟子就 +1/+1」的卡,那不是羁绊是光环 —— 而光环有自己的字段。
  //    八个已经足够撑起一套「孔門」构筑,又还留着「抽不到就凑不齐」的张力。
  // 2. **羁绊声明在弟子身上,老师只当 members。** `bond` 是单字段,一张卡只能声明一条;
  //    声明在老师身上就只能有一个弟子。引擎两个方向都扫(见 types.ts 的说明),
  //    所以声明在哪边都一样生效,但声明在弟子身上才装得下八条。
  //
  // 定价:单成员一律 +1/+1(比现有羁绊低一档 —— 师承的门槛只有两张卡,
  // 而且孔门那八条共用同一张老师,凑齐的概率比「结义三人」高得多);
  // 需要**两位老师同时在场**的两条给到 +1/+2,那才是真凑不齐的。

  // ---- 孔門(声明在弟子身上,members 都是孔子)----
  // 「孔子弟子」四个字在每一条的生平原文里都是原话。
  'hist-yan-hui': {
    bond: {
      id: 'bond-kongmen-yanhui',
      name: { zh: '孔門 · 顏回', en: "Confucius' Disciple: Yan Hui" },
      members: ['hist-confucius'],
      attack: 1,
      health: 1,
    },
  },
  'hist-zilu': {
    bond: {
      id: 'bond-kongmen-zilu',
      name: { zh: '孔門 · 子路', en: "Confucius' Disciple: Zilu" },
      members: ['hist-confucius'],
      attack: 1,
      health: 1,
    },
  },
  'hist-zigong': {
    bond: {
      id: 'bond-kongmen-zigong',
      name: { zh: '孔門 · 子貢', en: "Confucius' Disciple: Zigong" },
      members: ['hist-confucius'],
      attack: 1,
      health: 1,
    },
  },
  'hist-zixia': {
    bond: {
      id: 'bond-kongmen-zixia',
      name: { zh: '孔門 · 子夏', en: "Confucius' Disciple: Zixia" },
      members: ['hist-confucius'],
      attack: 1,
      health: 1,
    },
  },
  'hist-ranqiu': {
    bond: {
      id: 'bond-kongmen-ranqiu',
      name: { zh: '孔門 · 冉求', en: "Confucius' Disciple: Ran Qiu" },
      members: ['hist-confucius'],
      attack: 1,
      health: 1,
    },
  },
  'hist-ziyou': {
    bond: {
      id: 'bond-kongmen-ziyou',
      name: { zh: '孔門 · 子游', en: "Confucius' Disciple: Ziyou" },
      members: ['hist-confucius'],
      attack: 1,
      health: 1,
    },
  },
  'hist-zizhang': {
    bond: {
      id: 'bond-kongmen-zizhang',
      name: { zh: '孔門 · 子張', en: "Confucius' Disciple: Zizhang" },
      members: ['hist-confucius'],
      attack: 1,
      health: 1,
    },
  },
  'hist-zhonggong': {
    bond: {
      id: 'bond-kongmen-zhonggong',
      name: { zh: '孔門 · 仲弓', en: "Confucius' Disciple: Zhonggong" },
      members: ['hist-confucius'],
      attack: 1,
      health: 1,
    },
  },

  // ---- 諸子與經師 ----
  // 顏路 是顏回之父、也是孔子弟子 —— 这一条走的是父子那一面(原文:「孔子弟子,顏回之父」)。
  'hist-yan-lu': {
    bond: {
      id: 'bond-yanshi-fuzi',
      name: { zh: '顏氏父子', en: 'Father and Son Yan' },
      members: ['hist-yan-hui'],
      attack: 1,
      health: 1,
    },
  },
  // 原文:「受業於子思之門人」—— 思孟一脉,宋以后被立为道统正传。
  'hist-mencius': {
    bond: {
      id: 'bond-simeng',
      name: { zh: '思孟一脈', en: 'The Zisi–Mencius Line' },
      members: ['hist-zisi'],
      attack: 1,
      health: 1,
    },
  },
  // 原文:「弟子李斯、韓非皆法家集大成者」—— 儒者门下出了两个法家,要**两个都在**。
  'hist-xunzi': {
    bond: {
      id: 'bond-xunmen-fajia',
      name: { zh: '荀門法家', en: 'The Legalists of Xun' },
      members: ['hist-han-fei', 'hist-li-si'],
      attack: 1,
      health: 2,
    },
  },
  // 原文:「東周洛陽人,鬼谷子弟子」
  'hist-su-qin': {
    bond: {
      id: 'bond-guigu-menxia',
      name: { zh: '鬼谷門下', en: 'Of the Ghost Valley' },
      members: ['hist-guiguzi'],
      attack: 1,
      health: 1,
    },
  },
  // 原文:「魏國人,鬼谷子弟子,與蘇秦同門」—— 合纵与连横出自同一个师门,后来一生为敌。
  'hist-zhang-yi': {
    bond: {
      id: 'bond-tongmen-yilu',
      name: { zh: '同門異路', en: 'One Master, Two Roads' },
      members: ['hist-su-qin'],
      attack: 1,
      health: 1,
    },
  },
  // 原文:「從董仲舒學《春秋》,知禮法」
  'hist-er-kuan': {
    bond: {
      id: 'bond-chunqiu-zhixue',
      name: { zh: '春秋之學', en: 'The Study of the Annals' },
      members: ['hist-dong-zhongshu'],
      attack: 1,
      health: 1,
    },
  },
  // 原文:「程顥、程頤弟子」—— 楊時 正是「程門立雪」那个人,所以两位程子要都在场。
  'hist-yang-shi': {
    bond: {
      id: 'bond-chengmen-lixue',
      name: { zh: '程門立雪', en: 'Waiting in the Snow' },
      members: ['hist-cheng-hao', 'hist-cheng-yi'],
      attack: 1,
      health: 2,
    },
  },
  // 原文:「朱熹再傳弟子」
  'hist-zhen-dexiu': {
    bond: {
      id: 'bond-xishan-chuanzhu',
      name: { zh: '西山傳朱', en: 'Carrying On Zhu Xi' },
      members: ['hist-zhu-xi'],
      attack: 1,
      health: 1,
    },
  },
  // 原文:「康有為弟子」—— 康梁并称。
  'hist-liang-qichao': {
    bond: {
      id: 'bond-kangliang',
      name: { zh: '康梁', en: 'Kang and Liang' },
      members: ['hist-kang-youwei'],
      attack: 1,
      health: 1,
    },
  },

  // ---- 三国一档 ----
  // 原文:「從司馬徽學,與諸葛亮、龐統交厚」
  'xu-shu': {
    bond: {
      id: 'bond-shuijing-menxia',
      name: { zh: '水鏡門下', en: 'Of Water Mirror' },
      members: ['sima-hui'],
      attack: 1,
      health: 1,
    },
  },
  // 原文:「少從蔡邕學,雅靜寡言」
  'gu-yong': {
    bond: {
      id: 'bond-caimen',
      name: { zh: '蔡門琴書', en: "Cai Yong's Lute and Letters" },
      members: ['cai-yong'],
      attack: 1,
      health: 1,
    },
  },
  // 原文:「少從馬融學,博學多通」
  'lu-zhi': {
    bond: {
      id: 'bond-mamen',
      name: { zh: '馬融門下', en: 'Of Ma Rong' },
      members: ['hist-ma-rong'],
      attack: 1,
      health: 1,
    },
  },
  // 原文:「廣陵人,華佗弟子」—— 吳普 传五禽戏,活到九十余。
  'wu-pu': {
    bond: {
      id: 'bond-wuqin',
      name: { zh: '五禽之傳', en: 'The Five Animal Frolics' },
      members: ['hua-tuo'],
      attack: 1,
      health: 1,
    },
  },
}
