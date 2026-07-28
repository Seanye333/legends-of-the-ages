import type { LocalizedText } from '../engine/types'

// 关底 Boss 的战场台词。
//
// PvE 沉浸感最便宜的一笔投资:对手已经有立绘、有称号、有一段战前介绍,
// 但**打起来之后就再也不说话了** —— 十六个历史人物在牌桌上是同一个沉默的机器。
//
// 四个触发点,都从事件流里认得出来,不需要引擎配合:
//   open —— 开局第一回合
//   kill —— 它斩掉你一员武将(每局最多播几次,别刷屏)
//   low  —— 它自己掉到半血以下
//   win  —— 它赢了
// 台词全部贴人物:张角说谶语、吕布只关心谁能挡他、诸葛亮说的是史书里那几句。
export interface BossLines {
  open: LocalizedText
  kill: LocalizedText
  low: LocalizedText
  win: LocalizedText
}

export const BOSS_LINES: Record<string, BossLines> = {
  'boss-zhang-jiao': {
    open: { zh: '蒼天已死,黃天當立。', en: 'The blue heaven is dead; the yellow heaven shall rise.' },
    kill: { zh: '天意如此,非我之過。', en: 'It is the will of heaven, not my doing.' },
    low: { zh: '歲在甲子,天下大吉……', en: 'In the year of jiazi, all under heaven shall prosper…' },
    win: { zh: '信我者,得太平。', en: 'Those who believe in me find peace.' },
  },
  'boss-dong-zhuo': {
    open: { zh: '洛陽我能燒,人心我也能燒。', en: 'I burned Luoyang. I can burn men as easily.' },
    kill: { zh: '死了便死了,誰記得?', en: 'Dead is dead. Who will remember?' },
    low: { zh: '你們……都想殺我。', en: 'All of you… want me dead.' },
    win: { zh: '這天下,本就沒有道理可講。', en: 'This realm never ran on reason.' },
  },
  'boss-lu-bu': {
    open: { zh: '誰能擋我?', en: 'Who can stand against me?' },
    kill: { zh: '再來一個。', en: 'Send me another.' },
    low: { zh: '有點意思 —— 你是第幾個?', en: 'Interesting. How many have tried before you?' },
    win: { zh: '人中呂布,馬中赤兔。', en: 'Among men, Lü Bu. Among horses, Red Hare.' },
  },
  'boss-yuan-shao': {
    open: { zh: '四世三公,袁氏門生遍天下。', en: 'Four generations of ministers. My house has clients everywhere.' },
    kill: { zh: '折一員將而已,我還有百員。', en: 'One general lost. I have a hundred more.' },
    low: { zh: '不對……我的兵呢?', en: 'This is wrong… where are my men?' },
    win: { zh: '本就該如此。', en: 'It was always going to end this way.' },
  },
  'boss-sun-ce': {
    open: { zh: '轉鬥千里 —— 我沒空慢慢打。', en: 'A thousand li of running battle. I have no time to be slow.' },
    kill: { zh: '快了些,見諒。', en: 'A little quick. Forgive me.' },
    low: { zh: '好,這才像場仗。', en: 'Good. Now this is a battle.' },
    win: { zh: '江東,是打下來的。', en: 'Jiangdong was taken, not given.' },
  },
  'boss-zhou-yu': {
    open: { zh: '風向,已經在我這邊了。', en: 'The wind has already turned my way.' },
    kill: { zh: '談笑之間。', en: 'Amid talk and laughter.' },
    low: { zh: '既生瑜……', en: 'Since heaven made Yu…' },
    win: { zh: '檣櫓灰飛煙滅。', en: 'Masts and oars, gone to ash.' },
  },
  'boss-zhuge-liang': {
    open: { zh: '謀定而後動,知止而有得。', en: 'Plan first, then move; know when to stop, and you will gain.' },
    kill: { zh: '此乃兵法,非我好殺。', en: 'This is the art of war, not a taste for killing.' },
    low: { zh: '鞠躬盡瘁,死而後已。', en: 'I will give my all until my heart stops.' },
    win: { zh: '天下事,盡在此局。', en: 'The fate of the realm was in this game all along.' },
  },
  'boss-cao-cao': {
    open: { zh: '寧我負人,毋人負我。', en: 'Better I wrong the world than let the world wrong me.' },
    kill: { zh: '可惜了 —— 本可為我所用。', en: 'A pity. He could have served me.' },
    low: { zh: '設使天下無孤,不知幾人稱帝。', en: 'Were it not for me, how many would have called themselves emperor?' },
    win: { zh: '周公吐哺,天下歸心。', en: 'As the Duke of Zhou welcomed the worthy, the realm turns to me.' },
  },
  'boss-bai-qi': {
    open: { zh: '我不受降。', en: 'I do not accept surrender.' },
    kill: { zh: '一個。', en: 'One.' },
    low: { zh: '長平之後,我已不在意生死。', en: 'After Changping, life and death stopped mattering to me.' },
    win: { zh: '戰,只有一種結果。', en: 'War has only one outcome.' },
  },
  'boss-xiang-yu': {
    open: { zh: '力拔山兮氣蓋世。', en: 'My strength uproots mountains; my spirit covers the age.' },
    kill: { zh: '擋路的,都一樣。', en: 'All who stand in the way end the same.' },
    low: { zh: '此天亡我,非戰之罪。', en: 'Heaven destroys me — the fault is not in my fighting.' },
    win: { zh: '虞兮虞兮奈若何。', en: 'Yu, my Yu — what is to become of you?' },
  },
  'boss-han-xin': {
    open: { zh: '多多益善。', en: 'The more troops, the better.' },
    kill: { zh: '算到了。', en: 'Accounted for.' },
    low: { zh: '置之死地而後生。', en: 'Put them where they must die, and they will live.' },
    win: { zh: '兵者,詭道也。', en: 'War is the way of deception.' },
  },
  'boss-huo-qubing': {
    open: { zh: '匈奴未滅,何以家為?', en: 'The Xiongnu are not yet destroyed — why should I have a home?' },
    kill: { zh: '不必收兵,繼續。', en: 'No need to regroup. Press on.' },
    low: { zh: '孤軍深入,本就如此。', en: 'This is what striking deep alone means.' },
    win: { zh: '封狼居胥。', en: 'The altar is raised at Langjuxu.' },
  },
  'boss-tang-taizong': {
    open: { zh: '以銅為鏡,可以正衣冠。', en: 'With bronze as a mirror, one straightens one’s robes.' },
    kill: { zh: '可惜 —— 良將難得。', en: 'A pity. Good generals are hard to find.' },
    low: { zh: '以人為鏡,可以明得失。', en: 'With men as a mirror, one sees gain and loss.' },
    win: { zh: '水能載舟,亦能覆舟。', en: 'Water bears the boat, and water overturns it.' },
  },
  'boss-zhao-kuangyin': {
    open: { zh: '臥榻之側,豈容他人鼾睡。', en: 'How can I let another snore beside my bed?' },
    kill: { zh: '兵權,還是收回來的好。', en: 'Command is better held close.' },
    low: { zh: '朕不欲多殺 —— 但也不會退。', en: 'I do not wish to kill. Nor will I withdraw.' },
    win: { zh: '一杯酒的事。', en: 'It only ever took a cup of wine.' },
  },
  'boss-yue-fei': {
    open: { zh: '直搗黃龍,與諸君痛飲。', en: 'Straight to Huanglong — and we will drink together there.' },
    kill: { zh: '陣不可亂。', en: 'The formation must not break.' },
    low: { zh: '莫等閒,白了少年頭。', en: 'Do not idle, and let a young head turn white.' },
    win: { zh: '撼山易,撼岳家軍難。', en: 'Easier to move a mountain than the Yue family army.' },
  },
  // ---- 第三章 · 山河永寂 ----
  'boss-xie-xuan': {
    open: { zh: '八千人,足夠了。', en: 'Eight thousand. That will do.' },
    kill: { zh: '陣不許亂。', en: 'The line does not break.' },
    low: { zh: '風聲鶴唳的是你們,不是我。', en: 'It is you who hear cranes in the wind, not I.' },
    win: { zh: '投鞭斷流?水還在流。', en: 'They said they could dam the river. The river still runs.' },
  },
  'boss-an-lushan': {
    open: { zh: '長安還在唱歌 —— 讓他們唱完。', en: 'Chang’an is still singing. Let them finish.' },
    kill: { zh: '擋路的,一個也留不得。', en: 'No one in the way is left standing.' },
    low: { zh: '我起兵那天就沒想過回頭。', en: 'I never planned to turn back.' },
    win: { zh: '漁陽鼙鼓,動地而來。', en: 'The drums of Yuyang shake the earth.' },
  },
  'boss-di-qing': {
    open: { zh: '臉上的字我沒去掉 —— 那是我從哪來的。', en: 'I never had the tattoo removed. It says where I came from.' },
    kill: { zh: '快些,天亮之前要拿下。', en: 'Quickly. It must be taken before dawn.' },
    low: { zh: '行伍出身的人,不怕挨這一下。', en: 'A man risen from the ranks does not flinch at this.' },
    win: { zh: '關已在手。', en: 'The pass is ours.' },
  },
  'boss-yu-yunwen': {
    open: { zh: '主帥未至,那便由我來。', en: 'The commander has not come. Then it falls to me.' },
    kill: { zh: '書生也會殺人。', en: 'A scholar can kill too.' },
    low: { zh: '江在我身後,退不得。', en: 'The river is behind me. There is nowhere to withdraw.' },
    win: { zh: '采石一戰,我只是站在了那裡。', en: 'At Caishi I did nothing but stand there.' },
  },
  'boss-wen-tianxiang': {
    open: { zh: '國已亡,我還在。', en: 'The realm has fallen. I have not.' },
    kill: { zh: '此身可死,此志不改。', en: 'This body may die; this will does not change.' },
    low: { zh: '惶恐灘頭說惶恐。', en: 'At Fear Rapids I spoke of fear.' },
    win: { zh: '人生自古誰無死。', en: 'Since ancient times, which man has not died?' },
  },
  'boss-chen-youliang': {
    open: { zh: '六十萬眾,樓船連鎖。你有多少?', en: 'Six hundred thousand, ships chained abreast. And you?' },
    kill: { zh: '人多的一方,不必講道理。', en: 'The side with the numbers need not argue.' },
    low: { zh: '風向……風向不對。', en: 'The wind. The wind is wrong.' },
    win: { zh: '鄱陽湖上,舟連數十里。', en: 'On Lake Poyang the ships stretched for tens of li.' },
  },
  'boss-yu-qian': {
    open: { zh: '言南遷者,可斬。', en: 'Whoever speaks of fleeing south may be executed.' },
    kill: { zh: '九門已閉,誰也別想進來。', en: 'Nine gates shut. No one comes through.' },
    low: { zh: '社稷為重,君為輕。', en: 'The altars of state come first; the sovereign second.' },
    win: { zh: '城在,人在。', en: 'The city stands, and so do we.' },
  },
  'boss-zheng-chenggong': {
    open: { zh: '大陸已無我立足之地 —— 海上還有。', en: 'No ground left for me on the mainland. There is still the sea.' },
    kill: { zh: '船上的人,一個都不能少。', en: 'Not one man aboard is to be lost.' },
    low: { zh: '這是最後一支船隊了。', en: 'This is the last fleet.' },
    win: { zh: '開闢荊榛,以待後人。', en: 'We clear the thornland and leave it for those who come after.' },
  },
  'boss-xu-da': {
    open: { zh: '持重而行,不爭一時。', en: 'Move with weight. I do not fight for a single moment.' },
    kill: { zh: '穩住,繼續推進。', en: 'Hold steady. Keep advancing.' },
    low: { zh: '孤軍在外,更不能亂。', en: 'Alone in the field, all the more reason not to falter.' },
    win: { zh: '大將者,不恃勇。', en: 'A great general does not rely on courage.' },
  },
}

export function bossLines(bossId: string | null | undefined): BossLines | undefined {
  return bossId ? BOSS_LINES[bossId] : undefined
}
