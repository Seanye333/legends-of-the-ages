import type { CardDef, LocalizedText } from '../../engine/types'

// 宿敌 —— 羁绊的镜面。
//
// 羁绊问的是「谁和谁是一伙的」,宿敌问的是「谁和谁真的打过」。
// 条件从「同侧凑齐」翻成「对面站着那个人」,而增益**双方一起吃**:
// 历史上真刀真枪打过的两个人在牌桌上重逢,谁也不占谁便宜,只是都被激起来了。
//
// 为什么值得做:它是**唯一一条会让玩家去查史料的机制**。
// 「为什么我这张对他有加成?」→ 点开列传 → 知道了郾城、马陵道、白衣渡江。
// 别家的 CCG 想要这个效果得先编三百年世界观,本作的素材是现成的。
//
// 实现:走光环的附魔路径,和 bond 同一套撤销语义(见 resolve.refreshAuras 末尾那一轮)。
// **只在一侧声明**。引擎两个方向都扫,所以「我方项羽 vs 敌方韩信」与
// 「我方韩信 vs 敌方项羽」触发的是同一条 —— 两边都写会叠两次(rivals.test 钉死了这条)。
//
// 定价:双方同吃,所以数值本身是中性的,给到 +2/+2 也不会破坏平衡;
// 真正的成本是**你得把这张牌打出来面对他**。刻意都控制在 1~2 点,
// 免得在斩杀回合变成「送对面一个能反杀我的身板」这种纯负收益。

export const RIVAL_OVERRIDES: Record<string, Partial<CardDef>> = {
  // ================= 先秦 =================
  // 馬陵道:减灶诱敌,庞涓自刭于树下,曰「遂成竖子之名」。
  // 与 bond-guigu 同一对人 —— 同侧是同门,异侧是马陵道。这条对照本身就是设计目的。
  'hist-sun-bin': {
    rival: {
      id: 'rival-maling',
      name: { zh: '馬陵道', en: 'The Road at Maling' },
      foe: 'hist-pang-juan',
      attack: 2,
      health: 1,
    },
  },
  // 長平:廉颇坚壁三年不出,秦人不能克 —— 直到赵国换了将。
  'hist-bai-qi': {
    rival: {
      id: 'rival-changping',
      name: { zh: '長平對壘', en: 'Standoff at Changping' },
      foe: 'hist-lian-po',
      attack: 2,
      health: 2,
    },
  },
  // 滅楚:王翦请六十万,项燕拥兵拒之,楚亡于此役。
  'hist-wang-jian': {
    rival: {
      id: 'rival-miechu',
      name: { zh: '滅楚之役', en: 'The Fall of Chu' },
      foe: 'hist-xiang-yan',
      attack: 2,
      health: 1,
    },
  },
  // 圖窮匕見:荆轲刺秦,绕柱而走,事不成。
  'hist-jing-ke': {
    rival: {
      id: 'rival-tuqiong',
      name: { zh: '圖窮匕見', en: 'The Dagger in the Map' },
      foe: 'hist-qin-shihuang',
      attack: 3,
      health: 0,
    },
  },
  // 吳越爭霸:会稽之耻,卧薪尝胆,三千越甲可吞吴。
  'hist-goujian': {
    rival: {
      id: 'rival-wuyue',
      name: { zh: '吳越爭霸', en: 'Wu against Yue' },
      foe: 'hist-fuchai',
      attack: 2,
      health: 2,
    },
  },
  // 火牛陣:乐毅下齐七十余城,只剩即墨;田单以火牛破之,尽复齐地。
  'hist-yue-yi': {
    rival: {
      id: 'rival-huoniu',
      name: { zh: '即墨火牛', en: 'The Fire Oxen of Jimo' },
      foe: 'hist-tian-dan',
      attack: 1,
      health: 3,
    },
  },

  // ================= 秦汉 =================
  // 垓下:十面埋伏,四面楚歌 —— 当年拜将坛上的那个人,如今在对面。
  'hist-xiang-yu': {
    rival: {
      id: 'rival-gaixia',
      name: { zh: '垓下之圍', en: 'Encircled at Gaixia' },
      foe: 'hist-han-xin',
      attack: 2,
      health: 2,
    },
  },
  // 楚漢相爭:鸿门、彭城、荥阳、鸿沟 —— 四年间隔着一条鸿沟对峙。
  'hist-liu-bang': {
    rival: {
      id: 'rival-chuhan',
      name: { zh: '楚漢相爭', en: 'Chu against Han' },
      foe: 'hist-xiang-yu',
      attack: 2,
      health: 2,
    },
  },

  // ================= 三国 =================
  // 五丈原:死诸葛走生仲达。两人隔着渭水对峙百余日,谁也没能赢。
  'zhuge-liang': {
    rival: {
      id: 'rival-wuzhangyuan',
      name: { zh: '五丈原', en: 'The Wuzhang Plains' },
      foe: 'sima-yi',
      attack: 1,
      health: 3,
    },
  },
  // 官渡:兵不满万,击破十万 —— 曹操一生打得最险的那一仗。
  'cao-cao': {
    rival: {
      id: 'rival-guandu',
      name: { zh: '官渡之戰', en: 'The Battle of Guandu' },
      foe: 'yuan-shao',
      attack: 2,
      health: 2,
    },
  },
  // 赤壁:谈笑间,樯橹灰飞烟灭。
  'zhou-yu': {
    rival: {
      id: 'rival-chibi',
      name: { zh: '赤壁鏖兵', en: 'The Red Cliffs' },
      foe: 'cao-cao',
      attack: 2,
      health: 2,
    },
  },
  // 白衣渡江:吕蒙装病、士卒扮商贾,一夜取荆州。
  'guan-yu': {
    rival: {
      id: 'rival-baiyi',
      name: { zh: '白衣渡江', en: 'Crossing in White' },
      foe: 'lu-meng',
      attack: 2,
      health: 1,
    },
  },
  // 逍遙津:八百破十万,江东小儿闻张辽之名不敢夜啼。
  'zhang-liao': {
    rival: {
      id: 'rival-xiaoyaojin',
      name: { zh: '逍遙津', en: 'Xiaoyao Ford' },
      foe: 'sun-quan',
      attack: 2,
      health: 1,
    },
  },
  // 定軍山:老将黄忠居高临下,一鼓而斩夏侯渊。
  'huang-zhong': {
    rival: {
      id: 'rival-dingjunshan',
      name: { zh: '定軍山', en: 'Mount Dingjun' },
      foe: 'xiahou-yuan',
      attack: 3,
      health: 0,
    },
  },
  // 隴西拉鋸:姜维九伐中原,邓艾次次挡住;最后偷渡阴平的也是他。
  'jiang-wei': {
    rival: {
      id: 'rival-longxi',
      name: { zh: '隴西拉鋸', en: 'The Longxi Deadlock' },
      foe: 'deng-ai',
      attack: 1,
      health: 3,
    },
  },
  // 夷陵:连营七百里,一炬而尽。
  'lu-xun': {
    rival: {
      id: 'rival-yiling',
      name: { zh: '夷陵之火', en: 'The Fires of Yiling' },
      foe: 'liu-bei',
      attack: 2,
      health: 2,
    },
  },
  // 小沛：张飞与吕布反覆争徐州，一个夺城一个夺马。
  'zhang-fei': {
    rival: {
      id: 'rival-xiaopei',
      name: { zh: '小沛之爭', en: 'The Quarrel at Xiaopei' },
      foe: 'lu-bu',
      attack: 2,
      health: 1,
    },
  },

  // ================= 魏晋南北朝 =================
  // 淝水:投鞭断流的百万之众,败于八千北府兵。风声鹤唳,草木皆兵。
  'hist-xie-xuan': {
    rival: {
      id: 'rival-feishui',
      name: { zh: '淝水之戰', en: 'The Fei River' },
      foe: 'hist-fu-jian',
      attack: 2,
      health: 2,
    },
  },
  // 東西二魏:高欢与宇文泰打了沙苑、邙山、玉璧,一辈子没分出胜负。
  'hist-gao-huan': {
    rival: {
      id: 'rival-erwei',
      name: { zh: '東西二魏', en: 'The Two Weis' },
      foe: 'hist-yuwen-tai',
      attack: 1,
      health: 3,
    },
  },

  // ================= 隋唐 =================
  // 虎牢關:三千五百骑破十万,一战擒两王。
  'hist-tang-taizong': {
    rival: {
      id: 'rival-hulao',
      name: { zh: '虎牢關', en: 'Hulao Pass' },
      foe: 'hist-dou-jiande',
      attack: 2,
      health: 2,
    },
  },
  // 安史之亂:一个把唐朝掀翻,一个把它扶回来。
  'hist-guo-ziyi': {
    rival: {
      id: 'rival-anshi',
      name: { zh: '安史之亂', en: 'The An Lushan Rebellion' },
      foe: 'hist-an-lushan',
      attack: 2,
      health: 2,
    },
  },

  // ================= 宋元 =================
  // 郾城:岳家军以背嵬破拐子马,兀术叹「撼山易,撼岳家军难」。
  'hist-yue-fei': {
    rival: {
      id: 'rival-yancheng',
      name: { zh: '郾城大捷', en: 'Victory at Yancheng' },
      foe: 'hist-wuzhu',
      attack: 2,
      health: 2,
    },
  },
  // 黃天蕩:韩世忠八千人困兀术十万于江上四十八日,梁红玉击鼓助战。
  'hist-han-shizhong': {
    rival: {
      id: 'rival-huangtiandang',
      name: { zh: '黃天蕩', en: 'Huangtiandang' },
      foe: 'hist-wuzhu',
      attack: 1,
      health: 3,
    },
  },
  // 雁門關:杨业以数千骑破辽军于雁门,契丹畏之,望旗即走。
  'hist-yang-ye': {
    rival: {
      id: 'rival-yanmen',
      name: { zh: '雁門關', en: 'Yanmen Pass' },
      foe: 'hist-yelu-xiuge',
      attack: 2,
      health: 1,
    },
  },
  // 崖山之後:人生自古谁无死,留取丹心照汗青。
  'hist-wen-tianxiang': {
    rival: {
      id: 'rival-yashan',
      name: { zh: '崖山之後', en: 'After Yashan' },
      foe: 'hist-kublai',
      attack: 0,
      health: 4,
    },
  },

  // ================= 明清 =================
  // 北伐:徐达出塞,王保保是元室最后一根硬骨头 —— 朱元璋称他为「天下奇男子」。
  'hist-xu-da': {
    rival: {
      id: 'rival-beifa',
      name: { zh: '大漠北伐', en: 'The Northern Campaign' },
      foe: 'hist-wang-baobao',
      attack: 2,
      health: 2,
    },
  },
  // 鄱陽湖:六十万对二十万,中国历史上最大的水战。
  'hist-zhu-yuanzhang': {
    rival: {
      id: 'rival-poyang',
      name: { zh: '鄱陽湖', en: 'Lake Poyang' },
      foe: 'hist-chen-youliang',
      attack: 2,
      health: 2,
    },
  },
  // 寧遠:红夷大炮守孤城,努尔哈赤一生未尝败绩,唯此一役。
  'hist-yuan-chonghuan': {
    rival: {
      id: 'rival-ningyuan',
      name: { zh: '寧遠孤城', en: 'The Lone City of Ningyuan' },
      foe: 'hist-nurhaci',
      attack: 0,
      health: 4,
    },
  },
  // 山海關:冲冠一怒为红颜 —— 一道关门开了,天下就换了主人。
  'hist-li-zicheng': {
    rival: {
      id: 'rival-shanhaiguan',
      name: { zh: '山海關', en: 'Shanhai Pass' },
      foe: 'hist-wu-sangui',
      attack: 2,
      health: 1,
    },
  },
  // ═══════════ 第二批(2026-08-03)═══════════
  //
  // 从史料关系网(2,663 组)里挑出来的:**高稀有度、双方真的打过、且现有羁绊宿敌没覆盖**
  // 的 28 对里选 12 对。挑的标准是「这一仗值不值得玩家去查」——
  // 「原從呂布,敗后歸曹操」那种把降将与旧主判成敌对的不算真宿敌,一律不取。
  //
  // 宿敌是**双方同吃**的,所以加多少条都不改变强弱对比,只改变戏份 ——
  // 这也是先把宿敌补满、羁绊留到以后单独调一轮的原因。
  'hist-li-mu': {
    // 战国末:李牧屡败王翦,秦人不能克,最后靠反间计除掉他。
    rival: { id: 'rival-lianpo-wangjian', name: { zh: '宜安之戰', en: 'Yi\u2019an' }, foe: 'hist-wang-jian', attack: 2, health: 1 },
  },
  'hist-wei-xiaokuan': {
    // 玉璧:以一城之兵拒高欢十万,围五十日不下,高欢忿恚而退,不久病死。
    rival: { id: 'rival-yubi', name: { zh: '玉璧之圍', en: 'The Siege of Yubi' }, foe: 'hist-gao-huan', attack: 1, health: 2 },
  },
  'hist-li-guangbi': {
    // 太原:以孤城拒史思明十万,守四十余日。
    rival: { id: 'rival-taiyuan', name: { zh: '太原守禦', en: 'The Defence of Taiyuan' }, foe: 'hist-shi-siming', attack: 1, health: 2 },
  },
  'hist-yelu-xiezhen': {
    // 陈家谷:杨业孤军无援,力战被擒,绝食三日而死。
    rival: { id: 'rival-chenjiagu', name: { zh: '陳家谷', en: 'Chenjia Valley' }, foe: 'hist-yang-ye', attack: 2, health: 1 },
  },
  'hist-tie-xuan': {
    // 济南:铁铉以孤城拒燕王,悬太祖神主于城头,朱棣不敢炮击。
    rival: { id: 'rival-jinan', name: { zh: '濟南拒燕', en: 'Jinan Holds' }, foe: 'hist-yongle', attack: 1, health: 2 },
  },
  'hist-li-dingguo': {
    // 两蹶名王之后,终为吴三桂所破,忧愤卒于缅甸。
    rival: { id: 'rival-mianbei', name: { zh: '兩蹶名王', en: 'Two Princes Felled' }, foe: 'hist-wu-sangui', attack: 2, health: 1 },
  },
  'hist-li-xiucheng': {
    // 天京:苦守数年,城陷被擒,自述数万言而死。
    rival: { id: 'rival-tianjing', name: { zh: '天京圍城', en: 'The Siege of Tianjing' }, foe: 'hist-zeng-guofan', attack: 1, health: 2 },
  },
  'hist-luo-bingzhang': {
    // 大渡河:石达开陷绝地,以身饲刀求全三军。
    rival: { id: 'rival-dadu', name: { zh: '大渡河', en: 'The Dadu River' }, foe: 'hist-shi-dakai', attack: 2, health: 1 },
  },
  'hist-ji-kang': {
    // 刑东市,三千太学生请以为师，不许。顾日影而弹《广陵散》。
    rival: { id: 'rival-guangling', name: { zh: '廣陵散絕', en: 'The Last Guangling' }, foe: 'sima-zhao', attack: 1, health: 2 },
  },
  'xu-huang': {
    // 襄樊:以新募之兵长驱直入,破关羽十重鹿角,曹操称「用兵如晃」。
    rival: { id: 'rival-fancheng', name: { zh: '樊城解圍', en: 'Fancheng Relieved' }, foe: 'guan-yu', attack: 2, health: 1 },
  },
  'hist-jebe': {
    // 哲别本名只儿豁阿歹,射中铁木真坐骑,被擒后自陈,遂得名「哲别」(箭镞)。
    rival: { id: 'rival-jebe', name: { zh: '一箭之遇', en: 'The Arrow That Met a Khan' }, foe: 'hist-genghis', attack: 2, health: 1 },
  },
  'hist-lu-zhi': {
    // 长乐钟室:韩信为吕后所诱,斩于钟室,夷三族。
    rival: { id: 'rival-zhongshi', name: { zh: '長樂鐘室', en: 'The Bell Chamber' }, foe: 'hist-han-xin', attack: 2, health: 1 },
  },

  // ================= 2026-08-08 补的十九条(41 → 60)=================
  //
  // 【素材是关系网里现成的 `foe` 边,每条注释里那句都是生平原文】
  // 和师承那一批同一个来源(`lore.gen.ts` 的 RELATION_EDGES)。
  // 筛法:两边都在卡池、两边都还没**声明过** rival、而且那条边真的是敌对
  // —— 最后一条得人来判。关系网里有几条 `foe` 其实是**同僚**
  // (高覽 / 張郃 是一起降曹的,那条边来自郭图的传里那句谗言),没有采用。
  //
  // 同一个人可以是**多条宿敌的 foe**(曹仁 这里出现两次),因为 foe 不是
  // 声明在他自己身上的字段;但**声明方必须唯一** —— `bond`/`rival` 都是单字段。
  //
  // 定价照旧:双方同吃,所以数值中性,一律 1~2 点。

  // 街亭:亮使守街亭,馬謖捨水上山,為張郃所破,蜀軍大敗。
  'ma-su': {
    rival: { id: 'rival-jieting', name: { zh: '街亭', en: 'Jieting' }, foe: 'zhang-he', attack: 2, health: 1 },
  },
  // 討董:孫堅首入洛陽,得傳國玉璽。
  'sun-jian': {
    rival: { id: 'rival-taodong', name: { zh: '首入洛陽', en: 'First into Luoyang' }, foe: 'dong-zhuo', attack: 2, health: 1 },
  },
  // 舊主:龐德原馬超部,馬超降劉備,德隨張魯,後降曹操 —— 樊城相見已是敵國。
  'pang-de': {
    rival: { id: 'rival-jiuzhu', name: { zh: '舊主', en: 'The Old Lord' }, foe: 'ma-chao', attack: 2, health: 1 },
  },
  // 八門金鎖:事劉備於新野,獻計破曹仁八門金鎖陣。
  'xu-shu': {
    rival: { id: 'rival-bamen', name: { zh: '八門金鎖', en: 'The Eight Gates' }, foe: 'cao-ren', attack: 1, health: 2 },
  },
  // 南皮:曹純從征,於南皮陣斬袁譚。
  'cao-chun': {
    rival: { id: 'rival-nanpi', name: { zh: '南皮', en: 'Nanpi' }, foe: 'yuan-tan', attack: 2, health: 1 },
  },
  // 江陵:朱然以五千人拒夏侯尚數萬,固守半年,卒解圍。
  'zhu-ran': {
    rival: { id: 'rival-jiangling', name: { zh: '江陵孤守', en: 'The Siege of Jiangling' }, foe: 'xiahou-shang', attack: 1, health: 2 },
  },
  // 東興:雪夜短兵,大破諸葛誕援兵於東興。
  'ding-feng': {
    rival: { id: 'rival-dongxing', name: { zh: '雪夜短兵', en: 'Short Blades in the Snow' }, foe: 'zhuge-dan', attack: 2, health: 1 },
  },
  // 濡須:朱桓鎮濡須,大破曹仁五萬之眾,陣斬常雕,生擒王雙。
  'zhu-huan': {
    rival: { id: 'rival-ruxu', name: { zh: '濡須塢', en: 'The Ruxu Fort' }, foe: 'cao-ren', attack: 2, health: 1 },
  },
  // 諸葛恪 平山越、伐魏,初勝後敗,終為孫峻所殺,夷三族。
  'zhuge-ke': {
    rival: { id: 'rival-sunjun', name: { zh: '東吳鴆酒', en: 'Wine at the Wu Court' }, foe: 'sun-jun', attack: 2, health: 1 },
  },
  // 兄弟相攻:袁紹卒,袁譚與弟袁尚相攻,曹操乘隙渡河。
  'yuan-tan': {
    rival: { id: 'rival-xiongdi', name: { zh: '兄弟相攻', en: 'Brother Against Brother' }, foe: 'yuan-shang', attack: 2, health: 1 },
  },
  // 遼東:曹操破鄴,袁尚奔遼東,公孫康畏曹操,斬其首送許都。
  'yuan-shang': {
    rival: { id: 'rival-liaodong', name: { zh: '遼東首級', en: 'A Head Sent to Xu' }, foe: 'gongsun-kang', attack: 2, health: 1 },
  },
  // 汴水:中平六年汴水之戰,徐榮大破曹操、鮑信,曹操中流矢。
  'xu-rong': {
    rival: { id: 'rival-bianshui', name: { zh: '汴水', en: 'The Bian River' }, foe: 'bao-xin', attack: 2, health: 1 },
  },
  // 長安:王允后被李傕、郭汜攻陷長安,自焚而死。
  'wang-yun': {
    rival: { id: 'rival-changan', name: { zh: '長安之陷', en: 'The Fall of Chang’an' }, foe: 'li-jue', attack: 1, health: 2 },
  },
  // 董卓專政,蔡邕被脅入朝;卓敗,王允下之獄 —— 一声叹息送了命。
  'cai-yong': {
    rival: { id: 'rival-yushi', name: { zh: '一嘆下獄', en: 'One Sigh, and Prison' }, foe: 'wang-yun', attack: 1, health: 2 },
  },
  // 漢中:諸葛亮死後,馬岱奉遺命斬叛將魏延於漢中。
  'ma-dai': {
    rival: { id: 'rival-hanzhong', name: { zh: '遺命斬延', en: 'The Last Order' }, foe: 'wei-yan', attack: 2, health: 1 },
  },
  // 石室:于吉南遊,孫策怒其惑眾,殺之於石室。
  'yu-ji': {
    rival: { id: 'rival-shishi', name: { zh: '石室', en: 'The Stone Chamber' }, foe: 'sun-ce', attack: 1, health: 2 },
  },
  // 廣宗:皇甫嵩夜襲破之,黃巾大局自此潰。
  'huangfu-song': {
    rival: { id: 'rival-guangzong', name: { zh: '廣宗夜襲', en: 'Night Attack at Guangzong' }, foe: 'zhang-jiao', attack: 2, health: 1 },
  },
  // 宛城:中平元年攻潁川、宛城,屢為皇甫嵩、朱儁所敗。
  'zhang-bao-yt': {
    rival: { id: 'rival-wancheng', name: { zh: '宛城', en: 'Wancheng' }, foe: 'zhu-jun', attack: 2, health: 1 },
  },
  // 水淹七軍:關平助父出征襄樊,擒于禁、斬龐德,父子之名震華夏。
  'guan-ping': {
    rival: { id: 'rival-shuiyan', name: { zh: '水淹七軍', en: 'The Seven Armies Drowned' }, foe: 'yu-jin', attack: 2, health: 1 },
  },
}

// 史料一句 —— 图鉴/列传点开宿敌时显示。放在内容层,引擎不需要知道它。
export const RIVAL_LORE: Record<string, LocalizedText> = {
  'rival-lianpo-wangjian': {
    zh: '李牧屢敗秦師,秦人不能克 —— 直到用反間計,趙王自斬其將。',
    en: 'Li Mu beat back Qin again and again. Qin could not take him — so they bought his king instead.',
  },
  'rival-yubi': {
    zh: '以一城之兵拒十萬,圍五十日不下。高歡忿恚,班師而卒。',
    en: 'One city against a hundred thousand, fifty days unbroken. Gao Huan withdrew in fury, and died soon after.',
  },
  'rival-taiyuan': {
    zh: '孤城守四十餘日,無援而不下。',
    en: 'Forty days alone, with no relief, and it did not fall.',
  },
  'rival-chenjiagu': {
    zh: '援兵不至,楊業力戰被擒,絕食三日而死。',
    en: 'The relief never came. Yang Ye fought until taken, and starved himself for three days.',
  },
  'rival-jinan': {
    zh: '懸太祖神主於城頭,燕兵不敢發砲。',
    en: 'He hung the founder\u2019s spirit tablet on the wall, and the guns of Yan fell silent.',
  },
  'rival-mianbei': {
    zh: '兩蹶名王,天下震動 —— 而最後敗於昔日的同袍。',
    en: 'Two Qing princes felled, and the empire shook. In the end he was broken by a man who had once worn the same colours.',
  },
  'rival-tianjing': {
    zh: '苦守數年,城陷被擒,獄中自述數萬言。',
    en: 'Years of siege, then capture — and in prison, tens of thousands of words in his own hand.',
  },
  'rival-dadu': {
    zh: '陷絕地,以身飼刀,求全三軍。',
    en: 'Trapped at the river, he gave himself to the blade to buy his army out.',
  },
  'rival-guangling': {
    zh: '刑東市,顧日影而彈,曰:「《廣陵散》於今絕矣。」',
    en: 'At the execution ground he watched the shadow move, played once, and said: the Guangling melody ends today.',
  },
  'rival-fancheng': {
    zh: '以新募之兵長驅,破十重鹿角。操曰:「用兵如晃。」',
    en: 'With raw recruits he drove straight through ten rings of abatis. Cao Cao said: this is how war is made.',
  },
  'rival-jebe': {
    zh: '射中鐵木真坐騎,被擒不諱,遂賜名「哲別」——箭鏃。',
    en: 'He shot the Khan\u2019s horse from under him, admitted it when taken, and was named Jebe: the arrowhead.',
  },
  'rival-zhongshi': {
    zh: '誘入長樂鐘室,斬之,夷三族。',
    en: 'Lured into the bell chamber of Changle, and cut down there with all his kin.',
  },

  'rival-maling': {
    zh: '減灶誘敵,龐涓夜至馬陵,自剄曰:「遂成豎子之名!」',
    en: 'Sun Bin thinned his cookfires to feign desertion; Pang Juan took his own life at Maling.',
  },
  'rival-changping': {
    zh: '廉頗堅壁三年,秦不能克 —— 直到趙國換上了趙括。',
    en: 'Lian Po held the walls for three years. Qin only broke through after Zhao replaced him.',
  },
  'rival-miechu': {
    zh: '王翦請六十萬眾,項燕拒之於蘄南,楚遂亡。',
    en: 'Wang Jian asked for six hundred thousand men; Xiang Yan met them, and Chu fell.',
  },
  'rival-tuqiong': {
    zh: '圖窮而匕首見,秦王環柱而走。事不成,倚柱而笑。',
    en: 'The map unrolled to the dagger. The king ran; the assassin laughed against a pillar.',
  },
  'rival-wuyue': {
    zh: '會稽之恥,臥薪嘗膽二十年;三千越甲可吞吳。',
    en: 'Twenty years of brushwood and gall repaid the humiliation at Kuaiji.',
  },
  'rival-huoniu': {
    zh: '樂毅下齊七十餘城,獨即墨不下;田單以火牛夜出,盡復齊地。',
    en: 'Yue Yi took seventy cities; Tian Dan retook them all with oxen set alight by night.',
  },
  'rival-gaixia': {
    zh: '十面埋伏,四面楚歌 —— 設伏的,正是當年他親手拜的大將。',
    en: 'The ambush at Gaixia was laid by the very general Xiang Yu once let slip away.',
  },
  'rival-chuhan': {
    zh: '鴻門、彭城、滎陽、鴻溝 —— 四年之間,勝負易手數十次。',
    en: 'Hongmen, Pengcheng, Xingyang, the Great Ditch: four years, and the lead changed hands a dozen times.',
  },
  'rival-wuzhangyuan': {
    zh: '相持百餘日,秋風五丈原。死諸葛走生仲達。',
    en: 'A hundred days across the Wei River — and a dead Zhuge still put Sima Yi to flight.',
  },
  'rival-guandu': {
    zh: '兵不滿萬,而破十萬。烏巢一炬,河北易主。',
    en: 'Fewer than ten thousand broke a hundred thousand; the granaries at Wuchao burned.',
  },
  'rival-chibi': {
    zh: '羽扇綸巾,談笑間檣櫓灰飛煙滅。',
    en: 'Fan in hand, unhurried — and the fleet went up in smoke.',
  },
  'rival-baiyi': {
    zh: '呂蒙稱疾,士卒扮作商賈,白衣渡江,一夜取荊州。',
    en: 'Lü Meng feigned illness; his soldiers crossed as merchants in white, and Jing province fell in a night.',
  },
  'rival-xiaoyaojin': {
    zh: '八百破十萬,江東小兒聞遼名不敢夜啼。',
    en: 'Eight hundred broke a hundred thousand; children south of the river were hushed with his name.',
  },
  'rival-dingjunshan': {
    zh: '黃忠居高臨下,鼓噪而進,一戰斬夏侯淵於陣。',
    en: 'Huang Zhong charged downhill with drums beating and cut down Xiahou Yuan in the field.',
  },
  'rival-longxi': {
    zh: '姜維九伐中原,鄧艾次次擋住;末了偷渡陰平的,也是他。',
    en: 'Nine northern campaigns, nine times blocked — and it was Deng Ai who finally slipped through Yinping.',
  },
  'rival-yiling': {
    zh: '連營七百里,一炬而盡。',
    en: 'Seven hundred li of linked camps, gone in a single fire.',
  },
  'rival-xiaopei': {
    zh: '一個奪城,一個奪馬 —— 徐州易手數次,兩人始終在對面。',
    en: 'One seized the city, the other the horses; Xuzhou changed hands again and again.',
  },
  'rival-feishui': {
    zh: '投鞭斷流的百萬之眾,敗於八千北府兵。風聲鶴唳,草木皆兵。',
    en: 'A million men who boasted they could dam a river broke before eight thousand.',
  },
  'rival-erwei': {
    zh: '沙苑、邙山、玉璧 —— 打了一輩子,誰也沒能過河。',
    en: 'Shayuan, Mangshan, Yubi: a lifetime of battles, and neither ever crossed the river for good.',
  },
  'rival-hulao': {
    zh: '三千五百騎破十萬,一戰擒兩王。',
    en: 'Three and a half thousand horsemen broke a hundred thousand and took two kings in one day.',
  },
  'rival-anshi': {
    zh: '一個把唐室掀翻,一個把它扶了回來。',
    en: 'One man toppled the Tang; the other set it back on its feet.',
  },
  'rival-yancheng': {
    zh: '背嵬軍破拐子馬,兀朮歎:「撼山易,撼岳家軍難。」',
    en: '"Easier to move a mountain than the Yue family army," said Wuzhu after Yancheng.',
  },
  'rival-huangtiandang': {
    zh: '八千人困十萬於江上四十八日,梁紅玉親自擊鼓。',
    en: 'Eight thousand penned a hundred thousand against the river for forty-eight days.',
  },
  'rival-yanmen': {
    zh: '契丹望「楊」字旗即走,號為楊無敵。',
    en: 'The Khitan turned at the sight of his banner; they called him Yang the Invincible.',
  },
  'rival-yashan': {
    zh: '人生自古誰無死,留取丹心照汗青。',
    en: 'All men die; let mine leave a red heart in the histories.',
  },
  'rival-beifa': {
    zh: '朱元璋稱王保保為「天下奇男子」—— 徐達追了他十年。',
    en: 'The emperor called Wang Baobao the finest man alive; Xu Da chased him for ten years.',
  },
  'rival-poyang': {
    zh: '六十萬對二十萬,舟艦相連數十里,中國史上最大的水戰。',
    en: 'Six hundred thousand against two hundred thousand — the largest naval battle in Chinese history.',
  },
  'rival-ningyuan': {
    zh: '紅夷大炮守孤城。努爾哈赤一生未嘗敗績,唯此一役。',
    en: 'Cannon on a lone wall — the only defeat Nurhaci ever took.',
  },
  'rival-shanhaiguan': {
    zh: '衝冠一怒為紅顏。一道關門開了,天下就換了主人。',
    en: 'One gate opened in a fit of rage, and the empire changed hands.',
  },

  // ---- 2026-08-08 补的十九条 ----
  'rival-jieting': {
    zh: '亮使守街亭,馬謖捨水上山,為張郃所破,蜀軍大敗 —— 第一次北伐止于此。',
    en: 'Ordered to hold Jieting, Ma Su left the water and camped on the hill. Zhang He broke him, and the first northern campaign ended there.',
  },
  'rival-taodong': {
    zh: '諸侯畏卓兵鋒,唯孫堅獨進,首入洛陽,掃除宗廟,得傳國玉璽於井中。',
    en: 'The lords feared Dong Zhuo. Sun Jian alone pressed on, entered Luoyang first, swept the ancestral shrines, and found the Imperial Seal in a well.',
  },
  'rival-jiuzhu': {
    zh: '龐德原馬超部;超降劉備,德隨張魯,後降曹操。樊城再見,已是敵國。',
    en: 'Pang De once served Ma Chao. Chao went over to Liu Bei; De followed Zhang Lu, then Cao Cao. When they met again at Fancheng, they met as enemies.',
  },
  'rival-bamen': {
    zh: '事劉備於新野,獻計破曹仁八門金鎖陣 —— 徐庶出手只此一回。',
    en: 'At Xinye he served Liu Bei, and broke Cao Ren’s Eight Gates formation. It was the only time Xu Shu ever took the field.',
  },
  'rival-nanpi': {
    zh: '從征,於南皮陣斬袁譚,於長坂大破劉備 —— 虎豹騎所向披靡。',
    en: 'He cut down Yuan Tan in the field at Nanpi and shattered Liu Bei at Changban. Nothing stood before the Tiger and Leopard Cavalry.',
  },
  'rival-jiangling': {
    zh: '江陵之役,以五千人拒夏侯尚數萬,固守半年,卒解圍。',
    en: 'At Jiangling, five thousand men held off tens of thousands under Xiahou Shang for half a year, until the siege broke.',
  },
  'rival-dongxing': {
    zh: '雪夜短兵,解鎧棄矛,直取魏軍前屯 —— 大破諸葛誕援兵於東興。',
    en: 'A snowy night, short blades, armour thrown off: they took the Wei forward camp head-on and shattered Zhuge Dan’s relief force at Dongxing.',
  },
  'rival-ruxu': {
    zh: '鎮濡須,大破曹仁五萬之眾,陣斬常雕,生擒王雙。',
    en: 'Holding Ruxu, he broke Cao Ren’s fifty thousand, cut down Chang Diao in the field, and took Wang Shuang alive.',
  },
  'rival-sunjun': {
    zh: '平山越、伐魏,初勝後敗;終為孫峻所殺,夷三族。',
    en: 'He pacified the Shanyue and marched on Wei — won, then lost. Sun Jun killed him, and his three kindreds with him.',
  },
  'rival-xiongdi': {
    zh: '袁紹卒,譚與弟尚相攻;辛評勸其聯曹圖尚,曹操乘隙渡河。',
    en: 'When Yuan Shao died, Tan and his brother Shang turned on each other. Xin Ping urged an alliance with Cao Cao — and Cao Cao crossed the river.',
  },
  'rival-liaodong': {
    zh: '曹操破鄴,袁尚奔遼東;公孫康畏曹操,斬其首送許都。',
    en: 'Cao Cao took Ye; Yuan Shang fled to Liaodong. Gongsun Kang, fearing Cao Cao, sent his head to Xu.',
  },
  'rival-bianshui': {
    zh: '中平六年汴水之戰,徐榮大破曹操、鮑信,曹操中流矢,賴曹洪救之。',
    en: 'At the Bian River, Xu Rong broke Cao Cao and Bao Xin. Cao Cao took an arrow, and lived only because Cao Hong gave him his horse.',
  },
  'rival-changan': {
    zh: '誅卓之後,王允不赦涼州兵;李傕、郭汜遂攻陷長安,允死之。',
    en: 'After Dong Zhuo fell, Wang Yun refused amnesty to the Liangzhou troops. Li Jue and Guo Si stormed Chang’an, and Wang Yun died in it.',
  },
  'rival-yushi': {
    zh: '卓敗,蔡邕在座聞之而嘆;王允怒,下之獄,死獄中。',
    en: 'When word came that Dong Zhuo was dead, Cai Yong sighed where he sat. Wang Yun had him thrown in prison, and there he died.',
  },
  'rival-hanzhong': {
    zh: '諸葛亮死後,奉遺命斬叛將魏延於漢中。',
    en: 'After Zhuge Liang died, he carried out the last order and cut down Wei Yan at Hanzhong.',
  },
  'rival-shishi': {
    zh: '于吉南遊吳會,士民多從之;孫策怒其惑眾,殺之於石室。',
    en: 'Yu Ji travelled south and the people flocked to him. Sun Ce, calling it sorcery, had him killed in the stone chamber.',
  },
  'rival-guangzong': {
    zh: '中平元年,皇甫嵩夜襲廣宗,陣斬張梁;黃巾大局自此而潰。',
    en: 'In 184, Huangfu Song attacked Guangzong by night and cut down Zhang Liang. The Yellow Turban cause never recovered.',
  },
  'rival-wancheng': {
    zh: '中平元年攻潁川、宛城,屢為皇甫嵩、朱儁所敗。',
    en: 'In 184 they struck at Yingchuan and Wancheng, and were beaten again and again by Huangfu Song and Zhu Jun.',
  },
  'rival-shuiyan': {
    zh: '隨父鎮荊州,助父出征襄樊;水淹七軍,擒于禁、斬龐德,父子之名震華夏。',
    en: 'He held Jing with his father and marched with him on Fancheng. The seven armies drowned, Yu Jin was taken, Pang De beheaded — and the two names shook the realm.',
  },
}
