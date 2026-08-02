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
  // 绝命诗。标准与名言相同 —— 必须是真的传世之作,不是我们替他写的。
  poem?: { zh: string; en: string }
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
    line: { zh: '睢陽尚在,江淮就在。', en: 'While Suiyang stands, the south stands.' },
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
  // ═══════════ 史诗档(254 名里补 34 条)═══════════
  // 标准与上面完全一致:有确切出处才写。史诗档缺 224 条,这里只补我能指着
  // 史料说出处的三分之一强 —— 剩下的留给下一轮,不是留给想象力。
  'zhang-jiao': {
    // 《后汉书·皇甫嵩传》—— 太平道起事口号
    quote: {
      zh: '蒼天已死,黃天當立;歲在甲子,天下大吉。',
      en: 'The Blue Heaven is dead; the Yellow Heaven shall rise. The year is jiazi — all under Heaven, be glad.',
    },
    line: { zh: '符水一碗,信者活。', en: 'A bowl of charmed water. The faithful live.' },
  },
  'yang-hu': {
    // 《晋书·羊祜传》—— 登岘山叹语
    quote: { zh: '天下不如意,恒十居七八。', en: 'Of all things under Heaven, seven or eight in ten go against our wishes.' },
    line: { zh: '對岸是陸抗,我不夜襲。', en: 'Lu Kang is on the far bank. I do not raid by night.' },
  },
  'lu-kang': {
    // 《晋书·陆抗传》—— 答部下问何以厚待对岸的羊祜
    quote: {
      zh: '彼專為德,我專為暴,是不戰而自服也。',
      en: 'If he deals only in virtue and I only in violence, we are beaten without a battle.',
    },
    line: { zh: '西陵在,吳在。', en: 'While Xiling stands, Wu stands.' },
  },
  'hist-shen-baoxu': {
    // 《左传·定公四年》—— 哭秦庭七日
    quote: { zh: '吳為封豕長蛇,以薦食上國。', en: 'Wu is a great boar, a long serpent, devouring the states of the north.' },
    line: { zh: '哭七日,不食,秦師出。', en: 'Seven days weeping, no food — and the armies of Qin marched.' },
  },
  'hist-jian-shu': {
    // 《左传·僖公三十二年》—— 谏秦穆公袭郑
    quote: { zh: '勞師以襲遠,非所聞也。', en: 'To wear out an army in a raid upon the far country — I have never heard of such a thing.' },
    line: { zh: '哭師於東門之外。', en: 'I wept for the army outside the eastern gate.' },
  },
  'hist-xian-zhen': {
    // 《左传·僖公三十三年》—— 免冑入狄师而死
    quote: { zh: '匹夫逞志於君而無討,敢不自討乎?', en: 'A common man vented his rage upon his lord and went unpunished. Dare I not punish myself?' },
    line: { zh: '免冑入狄師。', en: 'Helmet off — into the Di ranks.' },
  },
  'hist-ji-zha': {
    // 《史记·吴太伯世家》—— 挂剑于徐君墓树
    quote: { zh: '始吾心已許之,豈以死倍吾心哉!', en: 'My heart had already promised it. Shall his death make me betray my own heart?' },
    line: { zh: '劍掛於墓,諾未曾負。', en: 'The sword hangs at the tomb. The promise was never broken.' },
  },
  'hist-ximen-bao': {
    // 《史记·滑稽列传》—— 治邺,投巫于河
    quote: {
      zh: '即河伯不娶婦,煩大巫嫗為入報河伯。',
      en: 'If the River Earl takes no bride, then trouble the head shamaness to go down and tell him so.',
    },
    line: { zh: '渠成,鄴無水患。', en: 'The channels are cut. Ye fears the river no longer.' },
  },
  'hist-tian-dan': {
    // 《史记·田单列传》—— 火牛阵前托神
    quote: { zh: '神來下教我。', en: 'A spirit has come down to instruct me.' },
    line: { zh: '千牛束炬,夜出即墨。', en: 'A thousand oxen, torches bound — out of Jimo by night.' },
  },
  'hist-mozi': {
    // 《墨子·兼爱中》—— 墨家学说的核心主张
    quote: { zh: '兼相愛,交相利。', en: 'Love all alike; profit one another.' },
    line: { zh: '守城之器,吾有九備。', en: 'Nine engines of defence — I have them all.' },
  },
  'hist-xunzi': {
    // 《荀子·劝学》—— 青出于蓝的出处
    quote: { zh: '青,取之於藍,而青於藍。', en: 'Blue is drawn from the indigo plant, yet is bluer than the plant.' },
    line: { zh: '人之性惡,其善者偽也。', en: 'Human nature is bad; its goodness is made.' },
  },
  'hist-meng-tian': {
    // 《史记·蒙恬列传》—— 赐死前语
    quote: { zh: '臣何罪於天,無過而死乎?', en: 'What crime have I against Heaven, that I die without fault?' },
    line: { zh: '北築長城,萬餘里。', en: 'A wall in the north — ten thousand li and more.' },
  },
  'hist-xiao-he': {
    // 《史记·淮阴侯列传》—— 月下追韩信后荐于刘邦
    quote: { zh: '諸將易得耳,至如信者,國士無雙。', en: 'Generals are easy to come by. But a man like Xin — there is no second in the realm.' },
    line: { zh: '關中的糧,一粒不少。', en: 'The grain of Guanzhong — not one grain short.' },
  },
  'hist-li-guang': {
    // 《史记·李将军列传》—— 迷道失期,不愿受审
    quote: { zh: '廣結髮與匈奴大小七十餘戰,終不能復對刀筆之吏。', en: 'Seventy fights and more against the Xiongnu since I bound my hair — and now I will not face the clerks again.' },
    line: { zh: '射石沒鏃,那是暮色看錯了。', en: 'The arrow sank into stone — the dusk had deceived me.' },
  },
  'hist-zhou-yafu': {
    // 《史记·绛侯周勃世家》—— 细柳营
    quote: { zh: '軍中聞將軍令,不聞天子之詔。', en: 'In camp, men heed the general’s order — not the Son of Heaven’s edict.' },
    line: { zh: '天子至,亦按轡徐行。', en: 'Even the emperor rode in at a walk.' },
  },
  'hist-zhao-chongguo': {
    // 《汉书·赵充国传》—— 请自往金城视形势
    quote: { zh: '百聞不如一見,兵難隃度。', en: 'A hundred reports are worth less than one look. War cannot be judged from afar.' },
    line: { zh: '屯田湟中,不戰而羌自敝。', en: 'Farm the Huang valley — the Qiang will wear themselves out.' },
  },
  'hist-ma-yuan': {
    // 《后汉书·马援传》—— 马革裹尸
    quote: {
      zh: '男兒要當死於邊野,以馬革裹屍還葬耳。',
      en: 'A man should die on the frontier, and come home wrapped in a horse’s hide.',
    },
    line: { zh: '聚米為山谷,指畫形勢。', en: 'Rice heaped into hills and valleys — here is the ground.' },
  },
  'hist-su-wu': {
    // 《汉书·苏武传》—— 持节牧羊十九年
    quote: { zh: '屈節辱命,雖生何面目以歸漢!', en: 'To bend my office and shame my charge — though I lived, with what face would I return to Han?' },
    line: { zh: '節旄盡落,節猶在手。', en: 'The yak-tails are all fallen. The staff is still in my hand.' },
  },
  'hist-shi-le': {
    // 《晋书·石勒载记》—— 自评与古人高下
    quote: {
      zh: '朕若逢高皇,當北面而事之;若遇光武,當並驅中原,未知鹿死誰手。',
      en: 'Had I met the Founder of Han, I would have served him. Had I met Guangwu, we would have raced across the plain — and who can say whose hand the deer would fall to.',
    },
    line: { zh: '奴隸出身,又如何?', en: 'Born a slave. What of it?' },
  },
  'hist-tao-kan': {
    // 《晋书·陶侃传》—— 惜分阴
    quote: {
      zh: '大禹聖人,乃惜寸陰;至於眾人,當惜分陰。',
      en: 'Yu the Great, a sage, grudged the inch of shadow. Ordinary men should grudge the fraction of it.',
    },
    line: { zh: '運甓于齋外,朝夕不輟。', en: 'Bricks moved out at dawn and back at dusk — every day.' },
  },
  'hist-wang-dao': {
    // 《世说新语·言语》—— 新亭对泣
    quote: {
      zh: '當共戮力王室,克復神州,何至作楚囚相對!',
      en: 'Let us pool our strength for the royal house and win back the sacred land — why sit facing one another like captives of Chu?',
    },
    line: { zh: '王與馬,共天下。', en: 'The Wang and the Sima share the realm.' },
  },
  'hist-tan-daoji': {
    // 《宋书·檀道济传》—— 被诛前投帻于地
    quote: { zh: '乃壞汝萬里長城!', en: 'So you tear down your own Great Wall!' },
    line: { zh: '唱籌量沙,以少為多。', en: 'Count the sand aloud as grain — let little seem much.' },
  },
  'hist-li-ji': {
    // 《资治通鉴·唐纪》—— 高宗问废王立武
    quote: { zh: '此陛下家事,何必更問外人!', en: 'This is Your Majesty’s household matter. Why ask outsiders?' },
    line: { zh: '三朝老臣,不多言。', en: 'A minister of three reigns says little.' },
  },
  'hist-xuanzang': {
    // 《大唐大慈恩寺三藏法师传》所载西行誓语,传世久远
    quote: {
      zh: '寧向西天一步死,不向東土一步生。',
      en: 'Rather die one step toward the West than live one step back toward the East.',
    },
    line: { zh: '經在,人可以不在。', en: 'Let the sutras survive. I need not.' },
  },
  'hist-yan-zhenqing': {
    // 《旧唐书·颜真卿传》—— 使李希烈军中,不屈
    quote: {
      zh: '吾年八十,官太師,守吾兄之節,死而後已。',
      en: 'I am eighty, a Grand Preceptor. I keep my brother’s faith, and only death will end it.',
    },
    line: { zh: '筆正,則心正。', en: 'When the brush is upright, so is the heart.' },
  },
  'hist-li-guangbi': {
    // 《新唐书·李光弼传》
    quote: { zh: '戰,危事也;我為國大臣,不可死賊手。', en: 'War is a perilous business. I am a minister of the state — I will not die by a rebel’s hand.' },
    line: { zh: '太原孤城,守得住。', en: 'Taiyuan stands alone. Taiyuan will hold.' },
  },
  'hist-wang-yanzhang': {
    // 《新五代史·王彦章传》—— 他常挂在嘴边的俗谚
    quote: { zh: '豹死留皮,人死留名。', en: 'A leopard dies and leaves its hide; a man dies and leaves his name.' },
    line: { zh: '鐵槍在手,不降。', en: 'The iron spear is in my hand. I do not surrender.' },
  },
  'hist-li-keyong': {
    // 《新五代史·伶官传序》—— 三矢遗命
    quote: { zh: '此三矢,爾其無忘乃父之志。', en: 'These three arrows — do not forget your father’s purpose.' },
    line: { zh: '獨眼看天下,看得清。', en: 'One eye upon the realm — and it sees clearly.' },
  },
  'hist-yang-ye': {
    // 《宋史·杨业传》—— 陈家谷兵败被俘,绝食三日而死
    quote: {
      zh: '上遇我厚,期討賊捍邊以報,而反為奸臣所迫,何面目求活耶!',
      en: 'His Majesty used me well; I meant to repay him by holding the border. Driven to this by treacherous men — with what face should I beg to live?',
    },
    line: { zh: '無敵,是他們叫的。', en: '“Invincible” — that was their word, not mine.' },
  },
  'hist-zong-ze': {
    // 《宋史·宗泽传》—— 临终连呼三声,无一语及家事
    quote: { zh: '過河!過河!過河!', en: 'Cross the river! Cross the river! Cross the river!' },
    line: { zh: '二十四道奏疏,一道也沒回。', en: 'Twenty-four memorials. Not one answered.' },
  },
  'hist-han-shizhong': {
    // 《宋史·岳飞传》—— 诘问秦桧
    quote: { zh: '「莫須有」三字,何以服天下!', en: '“Perhaps there was” — with three such words, how will you satisfy the realm?' },
    line: { zh: '黃天蕩,困兀朮四十八日。', en: 'Huangtiandang — I held Wuzhu forty-eight days.' },
  },
  'hist-bao-zheng': {
    // 《宋史·包拯传》—— 家训刻于堂壁
    quote: {
      zh: '後世子孫仕宦,有犯贓濫者,不得放歸本家。',
      en: 'If any descendant of mine takes office and is corrupt, he shall not be received back into this house.',
    },
    line: { zh: '開封府,無不平之事。', en: 'In the Kaifeng court, no wrong goes unrighted.' },
  },
  'hist-yelu-chucai': {
    // 《元史·耶律楚材传》
    quote: {
      zh: '興一利不若除一害,生一事不若省一事。',
      en: 'Better to remove one harm than to raise one benefit; better to spare one undertaking than to begin one.',
    },
    line: { zh: '中原之民,可以賦,不可以屠。', en: 'The people of the plain can be taxed. They cannot be slaughtered.' },
  },
  'hist-yuan-chonghuan': {
    // 临刑绝命诗,《明季北略》等载
    quote: { zh: '死後不愁無勇將,忠魂依舊守遼東。', en: 'After my death there will be no want of brave generals — my loyal ghost will still guard Liaodong.' },
    poem: {
      zh: '一生事業總成空,半世功名在夢中。死後不愁無勇將,忠魂依舊守遼東。',
      en: 'A lifetime’s work comes to nothing; half a life of honour was a dream. After my death there will be no want of brave men — my loyal ghost still guards Liaodong.',
    },
    line: { zh: '寧遠不失,一步不退。', en: 'Ningyuan does not fall. Not one step back.' },
  },
  'hist-shi-kefa': {
    // 《明史·史可法传》—— 守扬州
    quote: { zh: '城存與存,城亡與亡。', en: 'If the city stands, I stand. If the city falls, I fall.' },
    line: { zh: '揚州十日,我在第一日。', en: 'Ten days of Yangzhou — I was there on the first.' },
  },
  'hist-fang-xiaoru': {
    // 《明史·方孝孺传》—— 拒草即位诏
    quote: { zh: '便十族奈我何!', en: 'Ten degrees of kin, then — what is that to me?' },
    line: { zh: '筆可奪,詔不可草。', en: 'Take the brush. The edict will not be written.' },
  },
  'hist-zeng-guofan': {
    // 曾国藩治军口诀,见其家书与幕僚记述
    quote: { zh: '結硬寨,打呆仗。', en: 'Build a hard camp. Fight a dull fight.' },
    line: { zh: '屢敗屢戰。', en: 'Defeated again and again — and fighting again and again.' },
  },
  'hist-li-hongzhang': {
    // 《筹议海防折》(同治十三年)
    quote: { zh: '此三千餘年一大變局也。', en: 'This is the great turning of three thousand years.' },
    line: { zh: '我不過是個裱糊匠。', en: 'I am nothing but a paperer of walls.' },
  },
  'hist-deng-shichang': {
    // 黄海海战,致远舰沉前语,《清史稿》及时人记述
    quote: { zh: '吾輩從軍衛國,早置生死於度外。', en: 'We took up arms to guard the country. Life and death were set aside long ago.' },
    line: { zh: '撞沉吉野!', en: 'Ram the Yoshino!' },
  },
  'hist-qiu-jin': {
    // 就义前绝笔七字,《秋瑾集》及时人记载
    quote: { zh: '秋風秋雨愁煞人。', en: 'Autumn wind, autumn rain — they grieve one to death.' },
    poem: { zh: '秋風秋雨愁煞人。', en: 'Autumn wind, autumn rain — they grieve one to death.' },
    line: { zh: '身不得,男兒列;心卻比,男兒烈。', en: 'My body may not stand in the ranks of men — my heart burns fiercer than theirs.' },
  },
  'hist-gu-yanwu': {
    // 《日知录·正始》—— 后世「天下兴亡,匹夫有责」即概括此语
    quote: {
      zh: '保天下者,匹夫之賤,與有責焉耳矣。',
      en: 'As for preserving all under Heaven — even the humblest commoner bears a share of that duty.',
    },
    line: { zh: '行萬里路,讀萬卷書。', en: 'Ten thousand li walked; ten thousand volumes read.' },
  },
  // ═══════════ 史诗档 · 第二批(21 条)═══════════
  'pang-tong': {
    // 《三国志·庞统传》—— 劝刘备取益州
    quote: { zh: '權變之時,固非一道所能定也。', en: 'In a time of shifting power, no single road decides the matter.' },
    line: { zh: '鳳雛在此,何必問路。', en: 'The Fledgling Phoenix is here. You need not ask the way.' },
  },
  'zhang-lu': {
    // 《三国志·张鲁传》裴注引《魏略》—— 降曹前语
    quote: { zh: '寧為曹公作奴,不為劉備上客。', en: 'Sooner a slave in Lord Cao’s house than an honoured guest in Liu Bei’s.' },
    line: { zh: '五斗米道,漢中三十年。', en: 'The Way of Five Pecks — thirty years in Hanzhong.' },
  },
  'hist-sima-rangju': {
    // 《司马法·仁本》—— 传世兵学名句
    quote: {
      zh: '國雖大,好戰必亡;天下雖安,忘戰必危。',
      en: 'A state though great, if it loves war, will perish; the realm though at peace, if it forgets war, stands in danger.',
    },
    line: { zh: '軍法無貴賤。', en: 'Military law knows no rank.' },
  },
  'hist-zheng-zhuanggong': {
    // 《左传·隐公元年》—— 与母誓于黄泉,后掘地及泉而见
    quote: { zh: '不及黃泉,無相見也。', en: 'Not until the Yellow Springs shall we meet again.' },
    line: { zh: '多行不義必自斃。', en: 'He who heaps up wrong will bring himself down.' },
  },
  'hist-li-kui-ws': {
    // 《汉书·食货志》—— 尽地力之教
    quote: { zh: '盡地力之教。', en: 'Teach the land to give all it can.' },
    line: { zh: '法經六篇,天下之法自此始。', en: 'Six chapters of the Canon of Law — from here all law begins.' },
  },
  'hist-guiguzi': {
    // 《鬼谷子·捭阖》
    quote: { zh: '捭闔者,天地之道。', en: 'Opening and closing — this is the way of Heaven and Earth.' },
    line: { zh: '我不出谷,谷中人出。', en: 'I do not leave the valley. Those I taught do.' },
  },
  'hist-huangshigong': {
    // 《史记·留侯世家》—— 圯上授书张良
    quote: { zh: '孺子可教矣。', en: 'The lad can be taught.' },
    line: { zh: '十三年後,濟北穀城山下黃石即我。', en: 'In thirteen years, the yellow stone at Gucheng will be me.' },
  },
  'hist-qi-weiwang': {
    // 《史记·田敬仲完世家》—— 答魏惠王问宝
    quote: {
      zh: '此四臣者,將照千里,豈特十二乘哉!',
      en: 'These four ministers will light a thousand li — what are twelve chariots beside them?',
    },
    line: { zh: '寡人之寶,不在車上。', en: 'My treasures are not carried on chariots.' },
  },
  'hist-tang-sui': {
    // 《战国策·魏策四》—— 唐雎不辱使命
    quote: {
      zh: '若士必怒,伏屍二人,流血五步,天下縞素。',
      en: 'If a man of resolve is angered — two corpses, five paces of blood, and all under Heaven in mourning white.',
    },
    line: { zh: '布衣之怒,也是怒。', en: 'The anger of a commoner is anger still.' },
  },
  'hist-li-zuoche': {
    // 《史记·淮阴侯列传》—— 井陉之战后答韩信
    quote: {
      zh: '智者千慮,必有一失;愚者千慮,必有一得。',
      en: 'The wise, in a thousand thoughts, must err once; the fool, in a thousand thoughts, must once be right.',
    },
    line: { zh: '井陘之計,可惜未用。', en: 'My plan for Jingxing — a pity it went unused.' },
  },
  'hist-gong-sui': {
    // 《汉书·龚遂传》—— 治渤海,劝民归农
    quote: { zh: '賣劍買牛,賣刀買犢。', en: 'Sell your sword and buy an ox; sell your knife and buy a calf.' },
    line: { zh: '盜賊本是良民。', en: 'The bandits were honest folk once.' },
  },
  'hist-shen-qingzhi': {
    // 《宋书·沈庆之传》—— 谏北伐,反对与文吏议兵
    quote: {
      zh: '治國譬如治家,耕當問奴,織當訪婢。',
      en: 'Governing a state is like governing a house: for ploughing ask the farmhand, for weaving ask the maid.',
    },
    line: { zh: '陛下要伐北,先問問帶兵的。', en: 'If Your Majesty would march north, ask the men who lead troops.' },
  },
  'hist-duan-xiushi': {
    // 《旧唐书·段秀实传》—— 以笏击朱泚
    quote: { zh: '我雖不能殺汝,豈能從汝反耶!', en: 'I cannot kill you — but shall I join you in rebellion?' },
    line: { zh: '手中無兵,有笏。', en: 'No weapon in my hand — only this tablet of office.' },
  },
  'hist-qian-liu': {
    // 《吴越备史》所载致夫人书,苏轼《陌上花》引之
    quote: { zh: '陌上花開,可緩緩歸矣。', en: 'The flowers are out along the field paths — you may come home slowly.' },
    line: { zh: '保境安民,不爭天下。', en: 'Guard the borders, keep the people. I do not contend for the realm.' },
  },
  'hist-yelu-deguang': {
    // 《资治通鉴》—— 入汴后北归途中语
    quote: { zh: '我不知中國之人難制如此。', en: 'I did not know the people of the Middle Kingdom were so hard to govern.' },
    line: { zh: '打草穀,原不該。', en: 'The foraging raids — they should never have been.' },
  },
  'hist-di-qing': {
    // 《宋史·狄青传》—— 仁宗劝其除去面上黥文
    quote: {
      zh: '陛下以功擢臣,不問門地,願留以勸軍中。',
      en: 'Your Majesty raised me for merit, not for birth. Let the mark stay — it will encourage the ranks.',
    },
    line: { zh: '面上這幾個字,是我的出身。', en: 'These characters on my face are where I came from.' },
  },
  'hist-chenheshang': {
    // 《金史·完颜陈和尚传》—— 兵败被执,不肯混死乱军
    quote: {
      zh: '我金國大將,欲死於亂軍中,人將謂我降也。',
      en: 'I am a great general of Jin. Were I to die in the press, men would say I had surrendered.',
    },
    line: { zh: '忠孝軍,四百破八千。', en: 'The Loyal and Filial — four hundred broke eight thousand.' },
  },
  'hist-lu-xiangsheng': {
    // 卢象升誓师军令,《明史·卢象升传》述其治军
    quote: {
      zh: '刀必見血,人必帶傷,馬必喘汗,違者以軍法從事。',
      en: 'Every blade must show blood, every man a wound, every horse a lather — or answer to military law.',
    },
    line: { zh: '天雄軍在,我在。', en: 'While the Tianxiong stand, I stand.' },
  },
  'hist-tang-yin': {
    // 唐寅《桃花庵歌》
    quote: { zh: '別人笑我太瘋癲,我笑他人看不穿。', en: 'They laugh at me for a madman; I laugh that they see nothing through.' },
    line: { zh: '不煉金丹不坐禪,不為商賈不耕田。', en: 'No elixirs, no meditation; no trade, no plough.' },
  },
  'hist-huang-daozhou': {
    // 黄道周临刑血书,《明史·黄道周传》
    quote: { zh: '綱常萬古,節義千秋。', en: 'The bonds endure ten thousand ages; honour and duty, a thousand autumns.' },
    line: { zh: '殺我可,改我不可。', en: 'Kill me — you will not change me.' },
  },
  'hist-wang-fuzhi': {
    // 王夫之自题堂联,见《船山遗书》
    quote: { zh: '六經責我開生面,七尺從天乞活埋。', en: 'The Six Classics charge me to open a new face; this seven-foot body begs of Heaven a living burial.' },
    line: { zh: '天下無必敗之理,只有未盡之力。', en: 'There is no law of defeat — only strength not yet spent.' },
  },
  // ═══════════ 史诗档 · 第三批 ═══════════
  //
  // 【这一批为什么以台词为主】
  // 名言那口井到这里见底了 —— 剩下的史诗人物,汉文史料里多是**事迹而无原话**
  // (北族君主、五代武将、明清督抚)。再往下写就得编,那条线不能越。
  // 所以这一批只补 7 条有出处的名言,其余全给**出战台词**:
  // 台词是游戏风味,不是史料主张,可以写 —— 但要写得像那个人。
  'hist-zhao-xiangzi': {
    // 《史记·刺客列传》—— 释豫让
    quote: { zh: '彼義士也,吾謹避之耳。', en: 'He is a man of honour. I shall simply keep out of his way.' },
    line: { zh: '三家分晉,自我始。', en: 'The three houses divide Jin — beginning with me.' },
  },
  'hist-pingyuan-jun': {
    // 《史记·平原君虞卿列传》—— 毛遂自荐之后
    quote: { zh: '勝不敢復相士。', en: 'I dare not judge men again.' },
    line: { zh: '食客三千,識人者幾?', en: 'Three thousand retainers — and how many did I truly know?' },
  },
  'hist-wei-liao': {
    // 《尉缭子·武议》
    quote: { zh: '兵者,凶器也;爭者,逆德也。', en: 'Arms are instruments of ill omen; strife is a violation of virtue.' },
    line: { zh: '不得已而用之。', en: 'One uses them only when there is no other way.' },
  },
  'hist-mingde-mahuanghou': {
    // 《后汉书·明德马皇后纪》—— 拒封外戚
    quote: { zh: '吾為天下母,而身服大練。', en: 'I am mother to the realm, and I wear coarse silk.' },
    line: { zh: '外戚封侯,非國之福。', en: 'Marquisates for the empress’s kin bring no good to the state.' },
  },
  'hist-liu-yuan': {
    // 《晋书·刘元海载记》—— 自述志向
    quote: {
      zh: '大丈夫當為漢高、魏武,呼韓邪何足效哉!',
      en: 'A true man should be a Han Gaozu or a Cao Cao. Why should I model myself on Huhanye?',
    },
    line: { zh: '我亦漢家外孫。', en: 'I too am a grandson of the House of Han.' },
  },
  'hist-li-mi-sui': {
    // 讨隋檄文(祖君彦代笔,署李密名),《旧唐书·李密传》载其文
    quote: {
      zh: '罄南山之竹,書罪無窮;決東海之波,流惡難盡。',
      en: 'Exhaust the bamboo of the southern hills — his crimes are not written out; loose the waves of the eastern sea — his evil is not washed away.',
    },
    line: { zh: '瓦崗一起,天下響應。', en: 'Wagang rises — and the realm answers.' },
  },
  'hist-gao-xianzhi': {
    // 《旧唐书·高仙芝传》—— 临刑辩诬
    quote: {
      zh: '我遇敵而退,死則宜矣;若言我盜減糧賜,則誣也。',
      en: 'That I fell back before the enemy — for that I deserve death. But that I stole from the ration silver is a lie.',
    },
    line: { zh: '蔥嶺之上,唐旗未倒。', en: 'On the Pamirs, the Tang banner has not fallen.' },
  },

  // ── 以下只给出战台词(游戏风味,不作史料主张)──
  'dong-zhuo': { line: { zh: '我不負天下,天下負我。', en: 'I have not wronged the realm. The realm has wronged me.' } },
  'sun-jian': { line: { zh: '江東的路,是我先走的。', en: 'The road east of the river — I walked it first.' } },
  'yuan-shu': { line: { zh: '傳國玉璽在此,誰敢不服?', en: 'The Imperial Seal is here. Who dares refuse?' } },
  'sima-shi': { line: { zh: '目疾未愈,手未曾抖。', en: 'My eye has not healed. My hand has not shaken.' } },
  'sima-zhao': { line: { zh: '蜀已入囊中,吳不過遲早。', en: 'Shu is in the bag. Wu is only a matter of time.' } },
  'chen-qun': { line: { zh: '九品定人,亦是定國。', en: 'To rank men in nine grades is to order the state.' } },
  'hist-gao-huan': { line: { zh: '敕勒川,陰山下 —— 唱給我聽。', en: 'The Chile plain, beneath the Yin Mountains — sing it for me.' } },
  'hist-hulu-guang': { line: { zh: '落雕都督,一箭一雕。', en: 'The Eagle-Felling Commander — one arrow, one eagle.' } },
  'hist-wei-rui': { line: { zh: '白袍不執刃,亦能破敵。', en: 'The white robe carries no blade, and still it breaks them.' } },
  'hist-chen-baxian': { line: { zh: '江南初定,朕從吏卒起。', en: 'The south is barely settled — and I began as a clerk.' } },
  'hist-yang-su': { line: { zh: '軍法之下,無人可退。', en: 'Under my law, no man may step back.' } },
  'hist-gao-jiong': { line: { zh: '平陳之策,臣已具矣。', en: 'The plan for taking Chen is already drawn.' } },
  'hist-su-dingfang': { line: { zh: '滅三國,皆生擒其主。', en: 'Three kingdoms broken — and each of their lords taken alive.' } },
  'hist-luo-cheng': { line: { zh: '槍出如龍,回馬更快。', en: 'The spear strikes like a dragon — and the turn is faster still.' } },
  'hist-li-su': { line: { zh: '雪夜入蔡州,不鳴鼓。', en: 'Into Caizhou through the snow — and no drum sounded.' } },
  'hist-di-renjie': { line: { zh: '斷案一萬七千,無一冤者。', en: 'Seventeen thousand cases judged. Not one man wronged.' } },
  'hist-yao-chong': { line: { zh: '十事不從,臣不敢奉詔。', en: 'If the ten articles are refused, I dare not accept the office.' } },
  'hist-guo-wei': { line: { zh: '朕死,以瓦棺紙衣葬。', en: 'When I die — a clay coffin and paper robes.' } },
  'hist-cao-bin': { line: { zh: '克金陵,不妄殺一人。', en: 'Jinling taken — and not one man killed without cause.' } },
  'hist-yang-yanzhao': { line: { zh: '父在時守北,父去了還守北。', en: 'My father held the north. He is gone. I hold the north.' } },
  'hist-liu-qi': { line: { zh: '順昌城下,見過我的旗。', en: 'Beneath the walls of Shunchang — they have seen my banner.' } },
  'hist-wu-jie': { line: { zh: '和尚原,一步不讓。', en: 'At Heshang Plateau — not one step given.' } },
  'hist-yu-yunwen': { line: { zh: '書生亦可督戰。', en: 'A scholar, too, may command a battle.' } },
  'hist-meng-gong': { line: { zh: '機動防禦,不與爭一城。', en: 'Move and strike. I do not quarrel over a single city.' } },
  'hist-liang-hongyu': { line: { zh: '鼓在我手,將士看我。', en: 'The drum is in my hands. The men watch me.' } },
  'hist-she-taijun': { line: { zh: '楊家還有人。', en: 'The House of Yang is not yet ended.' } },
  'hist-li-gang': { line: { zh: '京城可守,不可棄。', en: 'The capital can be held. It must not be abandoned.' } },
  'hist-yu-jie': { line: { zh: '山城為棋,蜀口為局。', en: 'Mountain forts for stones; the gate of Shu for a board.' } },
  'hist-wang-jian-song': { line: { zh: '釣魚城,不降。', en: 'Diaoyu Fortress does not surrender.' } },
  'hist-qin-liangyu': { line: { zh: '白桿兵,聽我號令。', en: 'White-Staff soldiers — on my word.' } },
  'hist-shi-dakai': { line: { zh: '大渡河前,我一人可死。', en: 'Before the Dadu River — I alone may die.' } },
  'hist-feng-zicai': { line: { zh: '七十歲了,還提得動刀。', en: 'Seventy years old — and the blade is not too heavy yet.' } },
  'hist-huang-xing': { line: { zh: '斷指之手,仍能持槍。', en: 'A hand with fingers gone can still hold a rifle.' } },
  'hist-yu-dayou': { line: { zh: '兵法在心,不在多。', en: 'The art of war lives in the mind, not in numbers.' } },
  'hist-sun-chengzong': { line: { zh: '關寧一線,築到底。', en: 'The Guanning line — I will build it to the end.' } },
  'hist-li-dingguo': { line: { zh: '兩蹶名王,天下震動。', en: 'Two royal princes felled — and the realm shook.' } },
  // ═══════════ 稀有档(挑有确切语录的写)═══════════
  // 稀有 660 名里 633 名缺名言,但**多数人史书只有一两行,本来就没有传世语录**。
  // 这里只挑十九位真有原话的 —— 剩下的靠生平、档案与关系网撑,那是诚实的做法。
  'xiahou-dun': {
    // 《三国志·夏侯惇传》裴注引《魏略》—— 拔矢啖睛
    quote: { zh: '父精母血,不可棄也。', en: 'The seed of my father, the blood of my mother — it is not to be cast away.' },
    line: { zh: '獨眼,照樣看得見你。', en: 'One eye. It still sees you.' },
  },
  'cao-zhi': {
    // 《世说新语·文学》—— 七步诗
    quote: { zh: '本自同根生,相煎何太急?', en: 'We grew from the selfsame root — why such haste to boil me?' },
    line: { zh: '七步成詩,不算難。', en: 'A poem in seven paces. That was not the hard part.' },
  },
  'cao-pi': {
    // 曹丕《典论·论文》
    quote: { zh: '文章者,經國之大業,不朽之盛事。', en: 'Letters are the great work of governing a state, the imperishable achievement.' },
    line: { zh: '兄弟之間,朕先是君。', en: 'Between brothers, I am first the sovereign.' },
  },
  'yuan-shao': {
    // 《三国志·袁绍传》—— 四世三公,起兵讨董时语
    quote: { zh: '吾南據河,北阻燕代,兼戎狄之眾,南向以爭天下。', en: 'I hold the river to the south, Yan and Dai to the north, with the tribes at my back — and so I contend for the realm.' },
    line: { zh: '四世三公,袁氏在此。', en: 'Four generations, three excellencies — the House of Yuan stands here.' },
  },
  'hao-zhao': {
    // 《三国志·明帝纪》裴注引《魏略》—— 陈仓拒诸葛亮,答故人劝降
    quote: {
      zh: '魏家科法,卿所練也;我之為人,卿所知也。',
      en: 'You know the laws of Wei; you know what manner of man I am.',
    },
    line: { zh: '陳倉雖小,足夠了。', en: 'Chencang is small. It is enough.' },
  },
  'gao-shun': {
    // 《三国志·吕布传》裴注引《英雄记》—— 谏吕布
    quote: { zh: '將軍舉措,不肯詳思,忿悖之言,一朝有失。', en: 'The general acts without weighing it; words spoken in anger cost a whole morning’s work.' },
    line: { zh: '陷陣營,七百人。', en: 'The Camp That Breaks Ranks — seven hundred men.' },
  },
  'zhang-zhongjing': {
    // 张仲景《伤寒杂病论·自序》
    quote: {
      zh: '上以療君親之疾,下以救貧賤之厄,中以保身長全。',
      en: 'Above, to heal the sickness of prince and parent; below, to relieve the distress of the poor; between, to keep one’s own body whole.',
    },
    line: { zh: '傷寒之論,已成。', en: 'The treatise on cold damage is finished.' },
  },
  'lu-zhi': {
    // 《后汉书·卢植传》—— 拒中官索贿而被槛车征
    quote: { zh: '君子不以其道得之,不居也。', en: 'What the gentleman does not gain by the right way, he does not keep.' },
    line: { zh: '海內大儒,亦能提兵。', en: 'A great scholar of the realm — and he can lead troops.' },
  },
  'huangfu-song': {
    // 《后汉书·皇甫嵩传》—— 拒阎忠劝其自立
    quote: { zh: '人未忘主,天不祐逆。', en: 'The people have not forgotten their sovereign, and Heaven does not favour rebellion.' },
    line: { zh: '黃巾已平,兵權可交。', en: 'The Yellow Turbans are put down. The command may be returned.' },
  },
  'zheng-xuan': {
    // 《后汉书·郑玄传》—— 注经不辍
    quote: { zh: '但念述先聖之元意,思整百家之不齊。', en: 'I think only of setting out the sages’ first meaning, and of ordering the discord of the hundred schools.' },
    line: { zh: '經有異同,我來理之。', en: 'The classics disagree. I shall put them in order.' },
  },
  'sima-hui': {
    // 《三国志·诸葛亮传》裴注引《襄阳记》—— 水镜先生荐卧龙凤雏
    quote: { zh: '臥龍、鳳雛,得一可安天下。', en: 'The Sleeping Dragon and the Fledgling Phoenix — win either, and the realm may be settled.' },
    line: { zh: '好,好。', en: 'Good. Good.' },
  },
  'chen-deng': {
    // 《三国志·陈登传》—— 许汜论求田问舍
    quote: { zh: '君有國士之名,今天下大亂,而君求田問舍,言無可采。', en: 'You bear the name of a knight of the realm; the world is in chaos, and you talk of buying fields and houses — there is nothing in your words.' },
    line: { zh: '湖海之士,豪氣未除。', en: 'A man of the lakes and seas — the swagger has not left me.' },
  },
  'zhuge-ke': {
    // 《三国志·诸葛恪传》—— 少时应对孙权,「诸葛子瑜之驴」添二字
    quote: { zh: '乞請筆益兩字。', en: 'I beg the brush, to add two characters.' },
    line: { zh: '新城不下,非我之過。', en: 'Xincheng did not fall. That was not my fault.' },
  },
  'zhong-yao': {
    // 《宣示表》与钟繇论书,见《法书要录》所引
    quote: { zh: '用筆者天也,流美者地也。', en: 'The wielding of the brush is Heaven; the flowing of beauty is Earth.' },
    line: { zh: '關中殘破,我來收拾。', en: 'Guanzhong lies in ruins. I shall gather it up.' },
  },
  'cui-yan': {
    // 《三国志·崔琰传》—— 直言获罪
    quote: { zh: '時乎時乎,會當有變時。', en: 'The times, the times — a turning will surely come.' },
    line: { zh: '鬚長四尺,聲亦不小。', en: 'A beard four chi long — and a voice to match.' },
  },
  'cao-chong': {
    // 《三国志·邓哀王冲传》—— 称象
    quote: { zh: '置象大船之上,而刻其水痕所至。', en: 'Set the elephant upon a great boat, and mark where the water rises.' },
    line: { zh: '稱象,不必殺象。', en: 'To weigh the elephant, one need not kill it.' },
  },
  'huang-quan': {
    // 《三国志·黄权传》—— 归魏后不肯发丧刘备
    quote: { zh: '臣與劉、葛推誠相信,明本志也。', en: 'Liu and Zhuge and I trusted one another in good faith. My purpose was plain.' },
    line: { zh: '降魏非我願,退路已絕。', en: 'I did not wish to yield to Wei. There was no road back.' },
  },
  'wen-yang': {
    // 《三国志·毌丘俭传》裴注引《魏氏春秋》—— 单骑退雄兵
    quote: { zh: '賊來甚急,吾當先擊之。', en: 'They come on hard. I shall strike first.' },
    line: { zh: '十八歲,單騎入陣。', en: 'Eighteen years old, and alone into the ranks.' },
  },
  'meng-huo': {
    // 《三国志·诸葛亮传》裴注引《汉晋春秋》—— 七擒七纵后
    quote: { zh: '公,天威也,南人不復反矣。', en: 'Yours is the awe of Heaven, my lord. The men of the south will not rebel again.' },
    line: { zh: '再放我一次,我還來。', en: 'Let me go once more — and I shall come again.' },
  },
}
