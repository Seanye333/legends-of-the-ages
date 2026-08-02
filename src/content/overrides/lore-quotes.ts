// 手写列传补遗:名言与出战台词。
//
// 【为什么要有这一层】
// 生成层从姊妹仓库导来的档案已经覆盖 95.9% 的生平,但**名言只有 5.0%、
// 出战台词 6.5%** —— 而这两样恰恰是让一张牌「有人味」的东西:
// 生平是史书的口吻,名言是他自己的声音。
//
// 【两条不同的标准,别混】
//   · `quote` 名言 —— **必须有确切出处**。这一层只写我能指着史料说出处的那些,
//     拿不准的宁可空着。124 名传奇里缺 80 条,这里补 36 条 ——
//     剩下 44 位不是忘了,是**他们没有可靠的传世语录**(多为北族君主与武将,
//     汉文史料里只有事迹没有原话)。编一句放上去,这个游戏就不值得信了。
//   · `line` 出战台词 —— 是**游戏风味**,不是史料主张。它可以写,
//     但要写得像那个人:韩信的台词不该和项羽一个语气。
//     源头的 officerLines.ts 走的也是这个标准(147 位名将的挑衅/必杀词)。
//
// 出处标在注释里,不进游戏内文案 —— 卡面上摆一行「《史记·卷七》」太学术,
// 但代码里必须留着,否则下一个人无从核对。
export interface LoreOverride {
  quote?: { zh: string; en: string }
  line?: { zh: string; en: string }
}

export const LORE_OVERRIDES: Record<string, LoreOverride> = {
  // ─────────────── 先秦 ───────────────
  'hist-jin-wen-gong': {
    // 《左传·僖公二十三年》—— 流亡楚国时答楚成王,退避三舍出此
    quote: {
      zh: '若以君之靈,得反晉國,其辟君三舍。',
      en: 'If by your grace I regain Jin, I shall withdraw three marches before you.',
    },
    line: { zh: '十九年流亡,寡人記得每一里路。', en: 'Nineteen years in exile — I remember every li of it.' },
  },
  'hist-chu-zhuang-wang': {
    // 《史记·楚世家》—— 伍举以隐语进谏,庄王答此,一鸣惊人出处
    quote: {
      zh: '三年不蜚,蜚將沖天;三年不鳴,鳴將驚人。',
      en: 'Three years without flight — then it will pierce the sky. Three years without a cry — then it will startle the world.',
    },
    line: { zh: '問鼎之輕重?先問問寡人的兵。', en: 'You ask the weight of the cauldrons? Ask my army first.' },
  },
  'hist-qin-mugong': {
    // 《左传·僖公三十三年》所载秦誓,崤之战败后自责
    quote: { zh: '孤違蹇叔,以辱二三子。', en: 'I defied Jian Shu, and so brought shame upon you all.' },
    line: { zh: '東出的路,寡人走了一輩子。', en: 'The road east — I have walked it all my life.' },
  },
  'hist-sunshu-ao': {
    // 《新序·杂事》—— 孙叔敖少时埋两头蛇的故事
    quote: {
      zh: '吾聞見兩頭蛇者死,恐他人又見,已埋之矣。',
      en: 'They say whoever sees the two-headed snake dies. I feared another would see it, so I buried it.',
    },
    line: { zh: '治水如治民,堵不如疏。', en: 'Govern the people as you govern a river: guide it, do not dam it.' },
  },
  'hist-zhou-wuwang': {
    // 《尚书·泰誓》—— 武王伐纣誓师
    quote: { zh: '予有亂臣十人,同心同德。', en: 'I have ten ministers of order, of one heart and one virtue.' },
    line: { zh: '牧野在前,天命在此。', en: 'Muye lies ahead. Heaven’s mandate is here.' },
  },
  'hist-yi-yin': {
    // 《孟子·万章上》所引伊尹自述
    quote: { zh: '予,天民之先覺者也。', en: 'I am the first among Heaven’s people to awaken.' },
    line: { zh: '調和鼎鼐,亦是治國。', en: 'To balance a cauldron is also to govern a state.' },
  },
  'hist-sun-bin': {
    // 《史记·孙子吴起列传》—— 马陵之战前的分析,因势利导出此
    quote: {
      zh: '善戰者因其勢而利導之。',
      en: 'He who fights well takes the momentum as it is, and guides it to his profit.',
    },
    line: { zh: '減灶而行,龐涓自來。', en: 'Fewer cook-fires each day — and Pang Juan comes to me.' },
  },
  'hist-zhao-wuling': {
    // 《史记·赵世家》—— 武灵王推行胡服骑射时语
    quote: { zh: '今吾將胡服騎射以教百姓。', en: 'I shall teach my people the Hu dress and mounted archery.' },
    line: { zh: '衣冠可改,國不可弱。', en: 'Dress may be changed. A weak state may not be endured.' },
  },
  'hist-chuli-ji': {
    // 《史记·樗里子甘茂列传》—— 自择葬地时所作的预言
    quote: {
      zh: '後百歲,是當有天子之宮夾我墓。',
      en: 'In a hundred years, the palaces of a Son of Heaven will stand on either side of my tomb.',
    },
    line: { zh: '智囊在此,何須多言。', en: 'The bag of wits is here. What more need be said?' },
  },
  'hist-qin-xiaogong': {
    // 《史记·秦本纪》所载秦孝公求贤令
    quote: {
      zh: '賓客群臣有能出奇計強秦者,吾且尊官,與之分土。',
      en: 'Any guest or minister who can devise a plan to strengthen Qin — high office, and land, shall be his.',
    },
    line: { zh: '變法,是要流血的。', en: 'Reform is paid for in blood.' },
  },

  // ─────────────── 秦汉 ───────────────
  'hist-cao-can': {
    // 《史记·曹相国世家》—— 答惠帝责问,萧规曹随出此
    quote: { zh: '陛下自察聖武孰與高帝?', en: 'Does Your Majesty judge himself the equal of the Founding Emperor?' },
    line: { zh: '蕭何定的法,一個字都不必改。', en: 'Xiao He set the laws. Not one word needs changing.' },
  },
  'hist-wei-qing': {
    // 《史记·卫将军骠骑列传》—— 答苏建劝其养士
    quote: { zh: '人臣奉法遵職而已,何與招士!', en: 'A subject keeps the law and does his office. What has he to do with gathering retainers?' },
    line: { zh: '出塞七戰,未嘗敗績。', en: 'Seven campaigns beyond the passes. Never once defeated.' },
  },
  'hist-deng-yu': {
    // 《后汉书·邓禹传》—— 初见光武时献策
    quote: { zh: '延攬英雄,務悅民心。', en: 'Gather the heroes; make it your business to win the people’s hearts.' },
    line: { zh: '二十四歲拜大司徒,不敢不慎。', en: 'Grand Minister at twenty-four — I dare not be careless.' },
  },

  // ─────────────── 魏晋南北朝 ───────────────
  'du-yu': {
    // 《晋书·杜预传》—— 灭吴前答众议,势如破竹出此
    quote: {
      zh: '今兵威已振,譬如破竹,數節之後,皆迎刃而解。',
      en: 'Our momentum is made. It is like splitting bamboo — after a few joints, the rest falls apart at the blade.',
    },
    line: { zh: '江陵已下,順流而東。', en: 'Jiangling has fallen. Now downstream, and east.' },
  },
  'tian-feng': {
    // 《三国志·袁绍传》裴注引《先贤行状》—— 田丰狱中闻败语
    quote: {
      zh: '若軍有利,吾必全;今軍敗,吾其死矣。',
      en: 'Had the army prevailed, I would have lived. It has lost — so I shall die.',
    },
    line: { zh: '主公,此戰不可行。', en: 'My lord — this battle must not be fought.' },
  },
  'sun-quan': {
    // 《三国志·吕蒙传》裴注引《江表传》—— 劝吕蒙读书,吴下阿蒙出此
    quote: {
      zh: '孤豈欲卿治經為博士邪!但當涉獵,見往事耳。',
      en: 'Do I ask you to become a scholar of the classics? Only read enough to know what has gone before.',
    },
    line: { zh: '坐斷東南,戰未休。', en: 'I hold the southeast. The war is not over.' },
  },
  'hist-fu-jian': {
    // 《晋书·苻坚载记》—— 南伐前答群臣谏阻,投鞭断流出此
    quote: {
      zh: '以吾之眾旅,投鞭於江,足斷其流。',
      en: 'With my host, we could throw our whips into the Yangtze and dam it.',
    },
    line: { zh: '百萬之師,何懼一水。', en: 'A million men. What is one river to us?' },
  },
  'hist-yuan-hong': {
    // 《魏书·高祖纪》—— 假南伐之名行迁都洛阳之实
    quote: { zh: '苟不南伐,當遷都於此。', en: 'If we do not march south, then let us move the capital here.' },
    line: { zh: '改姓元,說漢話,朕先做給你們看。', en: 'A new surname, the Han tongue — I shall do it first, and you will follow.' },
  },

  // ─────────────── 隋唐五代 ───────────────
  'hist-li-jing': {
    // 《资治通鉴·唐纪》—— 夜袭阴山前,答张公谨劝阻
    quote: { zh: '此兵機也,時不可失。', en: 'This is the moment of war. It must not be let slip.' },
    line: { zh: '三千騎,踏陰山。', en: 'Three thousand horse — and over the Yin Mountains.' },
  },
  'hist-wu-zetian': {
    // 《资治通鉴·唐纪》—— 太宗问驯狮子骢,武后答以三物
    quote: {
      zh: '妾能制之,然須三物:一鐵鞭,二鐵楇,三匕首。',
      en: 'I can master it — but I need three things: an iron whip, an iron mace, and a dagger.',
    },
    line: { zh: '朕的碑上,一個字也不必刻。', en: 'On my stele, let not one word be carved.' },
  },
  'hist-zhang-xun': {
    // 《旧唐书·张巡传》—— 睢阳城破被执时语
    quote: { zh: '吾志吞逆賊,但力不遂耳。', en: 'I meant to swallow the rebels whole. Only my strength fell short.' },
    line: { zh: '睢陽still在,江淮就在。', en: 'While Suiyang stands, the south stands.' },
  },
  'hist-yan-gaoqing': {
    // 《旧唐书·颜杲卿传》—— 被执后骂安禄山;文天祥《正气歌》「为颜常山舌」即指此
    quote: { zh: '汝本營州牧羊羯奴,天子擢汝為將,何負於汝而反!', en: 'You were a shepherd slave of Yingzhou. The Son of Heaven made you a general. How did he wrong you, that you rebel?' },
    line: { zh: '舌可斷,罵不可止。', en: 'Cut out my tongue — the curses will not stop.' },
  },
  'hist-chai-rong': {
    // 《旧五代史·周世宗纪》—— 答王朴问在位年数
    quote: {
      zh: '以十年開拓天下,十年養百姓,十年致太平。',
      en: 'Ten years to open the realm, ten to nourish the people, ten to bring peace.',
    },
    line: { zh: '朕只求三十年。', en: 'I ask only for thirty years.' },
  },

  // ─────────────── 宋辽金元 ───────────────
  'hist-zhao-kuangyin': {
    // 《续资治通鉴长编》—— 答南唐使者徐铉求缓兵
    quote: { zh: '臥榻之側,豈容他人鼾睡!', en: 'Beside my own bed — shall I let another man snore?' },
    line: { zh: '杯酒之間,兵權已解。', en: 'Over a cup of wine, the commands changed hands.' },
  },
  'hist-lu-xiufu': {
    // 《宋史·陆秀夫传》—— 崖山兵败,负幼帝投海前语
    quote: { zh: '國事至此,陛下當為國死。', en: 'It has come to this. Your Majesty must die for the state.' },
    line: { zh: '負帝蹈海,宋不絕於此。', en: 'I carry the emperor into the sea. Song does not end here.' },
  },

  // ─────────────── 明清近代 ───────────────
  'hist-zhu-yuanzhang': {
    // 《明太祖实录》—— 自述出身,「淮右布衣」是他常用的自称
    quote: { zh: '朕本淮右布衣,天下於我何加焉。', en: 'I was a commoner of Huaiyou. What more can the realm add to me?' },
    line: { zh: '要飯的也能坐龍椅。', en: 'A beggar, too, may sit the dragon throne.' },
  },
  'hist-chang-yuchun': {
    // 《明史·常遇春传》—— 军中称他「常十万」即出于此
    quote: { zh: '願提十萬眾,橫行天下。', en: 'Give me a hundred thousand men, and I shall sweep the realm.' },
    line: { zh: '十萬足矣。', en: 'A hundred thousand will do.' },
  },
  'hist-wang-shouren': {
    // 《王阳明年谱》—— 临终前弟子问遗言,答此八字
    quote: { zh: '此心光明,亦復何言。', en: 'This heart is luminous. What more is there to say?' },
    line: { zh: '知而不行,只是未知。', en: 'To know and not to act is not yet to know.' },
  },
  'hist-zhang-juzheng': {
    // 张居正《答南台谏元丹山》,化用《华严经》语,是他自述心志最常被引的一句
    quote: {
      zh: '願以深心奉塵剎,不予自身求利益。',
      en: 'I would give my whole heart to this dusty world, and seek no profit for myself.',
    },
    line: { zh: '考成法一立,天下無空文。', en: 'With the accountability law in place, no order stays mere paper.' },
  },
  'hist-yao-guangxiao': {
    // 《明史·姚广孝传》—— 朱棣忧民心不附,广孝以此作答
    quote: { zh: '臣知天道,何論民心。', en: 'I read the way of Heaven. What is the will of the people to me?' },
    line: { zh: '臣送殿下一頂白帽子。', en: 'I offer Your Highness a white cap — and a king becomes emperor.' },
  },
  'hist-kangxi': {
    // 《清圣祖实录》—— 康熙自述亲书三事悬于宫柱
    quote: {
      zh: '三藩及河務、漕運為三大事,夙夜廑念,曾書而懸之宮中柱上。',
      en: 'The Three Feudatories, the river works, the grain transport — three great matters. I wrote them out and hung them on the palace pillar.',
    },
    line: { zh: '八歲登基,十四親政。', en: 'Enthroned at eight. Ruling at fourteen.' },
  },
  'hist-yongzheng': {
    // 雍正常用印文,亦见于其朱批 —— 他对帝王之职的自述
    quote: { zh: '為君難。', en: 'It is hard to be a sovereign.' },
    line: { zh: '朕就是這樣漢子。', en: 'This is simply the man I am.' },
  },
  'hist-cai-e': {
    // 1915 年云南护国讨袁通电,他自述举兵的理由
    quote: { zh: '為四萬萬人爭人格。', en: 'To win dignity for four hundred million people.' },
    line: { zh: '雲南首義,天下響應。', en: 'Yunnan rises first. The realm will answer.' },
  },
  'hist-huang-zongxi': {
    // 《明夷待访录·原君》—— 中国近世最早的君主批判
    quote: { zh: '為天下之大害者,君而已矣。', en: 'The greatest harm to all under Heaven is the sovereign, and nothing else.' },
    line: { zh: '天下為主,君為客。', en: 'The realm is the host; the ruler is the guest.' },
  },

  // ─────────────── 不是历史人物的两张 ───────────────
  // 「說客」与「長蛇陣旗」是本作自己造的卡(纵横家的泛称 / 阵形旗)。
  // 它们没有史料,所以**不给 quote**,只给一句风味 —— 这条界线要守住。
  'gen-fame-lobbyist': {
    line: { zh: '一言可以興邦,一言可以喪邦。', en: 'One word may raise a state. One word may ruin it.' },
  },
  'gen-chang-she-qi': {
    line: { zh: '擊首則尾至,擊尾則首至。', en: 'Strike the head and the tail comes; strike the tail and the head comes.' },
  },
}
