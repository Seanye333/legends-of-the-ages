import type { LocalizedText } from '../engine/types'
import { CARDS_BY_ID } from './cards'
import { ERA_NAME, ERA_OF } from './eras'
import { ALL_RIVALS } from './relations'

// 戰前檄文 —— 开局那一句话。
//
// 每一局的开场都是同一屏调度界面:同样的版式、同样的「点击要换掉的卡牌」。
// 而这个游戏的对局其实每次都不一样 —— 曹操打岳飞和曹操打刘备,
// 是两件**隔了九百年**的事,界面上却一个字都不提。
//
// 檄文从两位主公的**真实关系**里推,不是随机抽风味句:
//   1. 两人是宿敌 → 直接引那段史料(最强的一档,机制与叙事对上了)
//   2. 同一势力   → 同室操戈
//   3. 同一时代   → 同世之争
//   4. 跨时代     → 千载之下,隔空相逢(点出年代差,这是本作独有的场面)
// 推导是**确定性**的:同样两个人永远同一句,玩家能记住「哦,又是这一句」。

// 时代块从 **dynasty** 推,不从 LORE.era 推。
// 踩过:LORE.era 存的是**称号**(刘备的「蜀汉昭烈帝」、张角的「大贤良师」),
// 不是年代 —— 拿它比时代会把同为三国的两个人判成「隔世相逢」。
function eraOf(heroId: string) {
  const c = CARDS_BY_ID[heroId]
  return c ? ERA_OF[c.dynasty] : undefined
}

export function proclamation(a: string, b: string): LocalizedText | null {
  const ca = CARDS_BY_ID[a]
  const cb = CARDS_BY_ID[b]
  if (!ca || !cb) return null
  const na = ca.name
  const nb = cb.name

  // 1) 宿敌:机制上他们本来就互相加成,叙事上这是最该说的一句
  const rival = ALL_RIVALS.find(
    (r) =>
      (r.anchor.id === a && r.rival.foe === b) || (r.anchor.id === b && r.rival.foe === a),
  )
  if (rival) {
    return {
      zh: `${na.zh} 對 ${nb.zh} —— ${rival.rival.name.zh}。史上真打過的兩個人,今日又碰上了。`,
      en: `${na.en} against ${nb.en} — ${rival.rival.name.en}. Two who truly fought, met again.`,
    }
  }

  // 2) 同势力:同室操戈
  if (ca.dynasty === cb.dynasty) {
    return {
      zh: `${na.zh} 對 ${nb.zh} —— 同室操戈,相煎何急。`,
      en: `${na.en} against ${nb.en} — kin turned on kin.`,
    }
  }

  const ea = eraOf(a)
  const eb = eraOf(b)

  // 3) 同时代不同势力:同世之争
  if (ea && eb && ea === eb) {
    return {
      zh: `${na.zh} 對 ${nb.zh} —— 同生於${ERA_NAME[ea].zh},本就該有這一戰。`,
      en: `${na.en} against ${nb.en} — both of the ${ERA_NAME[ea].en} age. This battle was always owed.`,
    }
  }

  // 4) 跨时代:本作独有的场面 —— 把年代差直接说出来
  if (ea && eb) {
    return {
      zh: `${na.zh} 對 ${nb.zh} —— ${ERA_NAME[ea].zh}與${ERA_NAME[eb].zh}隔世相逢,史書上沒有這一頁。`,
      en: `${na.en} against ${nb.en} — ${ERA_NAME[ea].en} meets ${ERA_NAME[eb].en}. No chronicle records this page.`,
    }
  }

  return {
    zh: `${na.zh} 對 ${nb.zh} —— 兩軍既列,鼓行而進。`,
    en: `${na.en} against ${nb.en} — the lines are drawn; advance to the drums.`,
  }
}
