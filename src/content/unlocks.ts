import type { LocalizedText } from '../engine/types'

// 模式渐进解锁 —— 第一次打开游戏时,不要把十四个入口一次性摊在他面前。
//
// 【问题是什么】
// 标题页现在有十四个入口:冒险、名局、校场、登楼、连斩、远征、乱斗、谜题、
// 演武、列传、问答、讲堂、图鉴、构筑。对一个刚下载的人来说,这不是「内容丰富」,
// 这是**不知道该点哪个**。而里面有一半(校场要 100 功勋报名、远征要自己的收藏、
// 登楼要一套成型卡组)在他有卡之前点进去也玩不明白。
//
// 【为什么是「灰着 + 写清条件」而不是「藏起来」】
// 藏起来的问题是游戏看着很空,而这游戏最大的卖点恰恰是内容量。
// 灰着并写清「打通 3 关解锁」,同一块屏幕就同时说了两件事:
// 现在该干嘛(亮着的那几个),以及往后还有什么(灰着的那几个)。
// 后者是留存,前者是引导 —— 藏起来的话两件事都没了。
//
// 唯一的例外是**群雄连斩**:它藏到冒险全通才出现,那是通关奖励的一部分,
// 提前剧透就不是惊喜了。那条规则不在这张表里,写在 TitleScreen 的渲染分支上。
//
// 【门槛怎么定的】
// 一条原则:**门槛必须落在玩家自然会经过的路上**,不能要求他绕路。
// 所以全部挂在「打了几局」和「冒险通了几关」两个计数上 ——
// 一个新玩家只要顺着最显眼的「群雄逐鹿」往下打,四个模式会依次自己亮起来,
// 他不需要知道解锁条件存在。
export interface UnlockProgress {
  matches: number // 总对局数(胜 + 负)
  campaignCleared: number // 冒险通关数
}

export interface UnlockRule {
  need: (p: UnlockProgress) => boolean
  hint: (p: UnlockProgress) => LocalizedText
}

const afterMatches = (n: number): UnlockRule => ({
  need: (p) => p.matches >= n,
  hint: (p) => ({
    zh: `再打 ${n - p.matches} 局解锁`,
    en: `${n - p.matches} more match${n - p.matches === 1 ? '' : 'es'} to unlock`,
  }),
})

const afterBosses = (n: number): UnlockRule => ({
  need: (p) => p.campaignCleared >= n,
  hint: (p) => ({
    zh: `群雄逐鹿通 ${n} 关解锁(还差 ${n - p.campaignCleared})`,
    en: `Clear ${n} Contenders (${n - p.campaignCleared} to go)`,
  }),
})

// 顺序就是新玩家该走的顺序:先打两局熟悉规则 → 谜题教他算斩杀 →
// 通两关说明卡组能用了 → 登楼考耐力 → 远征考构筑 → 校场是最后一档(要报名费)。
export const UNLOCKS: Record<string, UnlockRule> = {
  lethal: afterMatches(2),
  brawl: afterMatches(4),
  tower: afterBosses(2),
  expedition: afterBosses(4),
  arena: afterBosses(6),
}

export function isUnlocked(mode: string, p: UnlockProgress): boolean {
  const rule = UNLOCKS[mode]
  return rule ? rule.need(p) : true
}

export function unlockHint(mode: string, p: UnlockProgress): LocalizedText | null {
  const rule = UNLOCKS[mode]
  if (!rule || rule.need(p)) return null
  return rule.hint(p)
}
