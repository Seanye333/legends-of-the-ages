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
}

// 史料一句 —— 图鉴/列传点开宿敌时显示。放在内容层,引擎不需要知道它。
export const RIVAL_LORE: Record<string, LocalizedText> = {
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
}
