import type { CardDef, HeroDef } from '../engine/types'
import { DECK_SIZE } from '../engine/types'

// 预组卡组:六主义各一套,随主公解锁。
// 构筑规则(validateDeck 强制):恰好30张;单卡≤2份;传奇≤1份;
// 卡牌主义 === 主公主义 或 'neutral';所有 id 必须存在于合并卡池。
export interface DeckList {
  heroId: string
  name: { zh: string; en: string }
  cardIds: string[]
}

const copies = (n: number, ...ids: string[]): string[] => ids.flatMap((id) => Array(n).fill(id) as string[])

// 六套预组共用一张「骨架」,主义只决定填进插槽的卡,不决定卡组能不能开局。
//
// 骨架(30 张,六套完全一致):
//   曲线 2费5 / 3费6 / 4费5 / 5费6 / 6费8,均费 4.20
//   22 随从 + 4 锦囊(聲東擊西×2 单体+随机、火計×2 单体 4 伤)+ 4 装备
//   守护 12 张,且**按费用分布对齐**:2费2(藤甲)/ 3费2(明光鎧)/ 5费2 / 6费6
//   抢攻 1~2 张(冲锋或突袭),总身材 89~100 攻 / 118~127 血(差 ≤5%)
//
// 三条来之不易的经验(改预组前先读):
// 1. **先手优势随卡组节奏放大**。引擎给后手多摸一张牌作为补偿(OPENING_HAND=[3,4]),
//    但这份补偿只够抵消慢速对局的先手红利:实测镜像对战里,快攻型卡组先手胜率
//    75~88%,慢速互拆型只有 43~55%。所以骨架刻意压低攻击、堆守护、把对局拉到
//    30 回合左右,让补偿追得上先手。
//    反向验证:同一副牌加 3 张冲锋/单挑,先手胜率 51% → 65%,对局 36 回合 → 23 回合。
//    (注:sim-balance 早期版本把「谁先手」从 seed 奇偶推导,而它恰好与座位互换同步
//    翻转,导致每个对位里永远是同一方先手 —— 已修,现在座位与先手独立跑满四种组合。
//    上面这些数字是修复后重测的。)
// 2. **守护的费用分布比总数更重要**。只有 6 费守护的卡组会被有 4~5 费守护的卡组压制,
//    哪怕两边总身材、总守护数完全一样。
// 3. **战吼点杀 ≈ 10 个百分点**。两张「战吼:造成 2~3 点伤害」的差距,足以让两套
//    身材几乎相同的卡组差出 10%+。治疗战吼在贪心 AI 里近乎白板(见铁律 6),
//    所以每套都配了 1~2 张点杀/AOE 战吼当解场答案;霸道卡池 6 费内没有点杀战吼,
//    改用龐德的「單挑」顶替这个位置。
export const PRECON_DECKS: DeckList[] = [
  {
    heroId: 'liu-bei',
    name: { zh: '桃園仁德', en: 'Oath of the Peach Garden' },
    // 王道:群体增益 + 守护墙。謝玄战吼 AOE 当解场,魏延冲锋收线,劉備上场全场 +1/+1。
    cardIds: [
      ...copies(1, 'liu-qi'), ...copies(2, 'eq-teng-jia', 'strat-shengdong-jixi'),
      ...copies(2, 'cui-yan', 'eq-mingguang-kai', 'strat-huo-ji'),
      ...copies(2, 'ma-liang', 'fei-yi'), ...copies(1, 'hist-xiao-he'),
      ...copies(2, 'wang-ping', 'deng-zhi'), ...copies(1, 'hist-wen-tianxiang', 'jiang-wan'),
      ...copies(2, 'chen-dao', 'zhang-fei'), ...copies(1, 'cheng-pu', 'hist-xie-xuan', 'wei-yan', 'liu-bei'),
    ],
  },
  {
    heroId: 'cao-cao',
    name: { zh: '魏武揮鞭', en: 'The Tyrant’s Vanguard' },
    // 霸道:全场最高攻。守护清一色自家猛将(周亞夫/許褚/樊噲),
    // 霸道 6 费内没有点杀战吼,改用龐德「單挑」上场就换掉一个敌将。
    cardIds: [
      ...copies(1, 'cao-lin'), ...copies(2, 'eq-teng-jia', 'strat-shengdong-jixi'),
      ...copies(2, 'wang-lang', 'eq-mingguang-kai', 'strat-huo-ji'),
      ...copies(2, 'cao-ang', 'cao-rui'), ...copies(1, 'mao-jie'),
      ...copies(2, 'wang-ping', 'li-dian'), ...copies(1, 'hist-tian-dan', 'hist-shang-yang'),
      ...copies(2, 'hist-zhou-yafu', 'xu-chu', 'hist-fan-kuai'), ...copies(1, 'zhang-liao', 'deng-ai'),
    ],
  },
  {
    heroId: 'hist-confucius',
    name: { zh: '克己復禮', en: 'Rites and Righteousness' },
    // 礼教:身材最低但战吼最稳(治疗/点杀/抽牌),顏真卿撑中期,文醜突袭补一刀。
    cardIds: [
      ...copies(1, 'liu-xie'), ...copies(2, 'eq-teng-jia', 'strat-shengdong-jixi'),
      ...copies(2, 'hist-hai-rui', 'eq-mingguang-kai', 'strat-huo-ji'),
      ...copies(2, 'hist-wei-zheng', 'hist-sima-guang'), ...copies(1, 'cheng-yu'),
      ...copies(2, 'hist-yan-zhenqing', 'hist-lin-zexu'), ...copies(1, 'hist-confucius', 'hist-fan-zhongyan'),
      ...copies(2, 'cheng-pu', 'zhou-tai', 'chen-dao'), ...copies(1, 'wen-chou', 'hist-wang-shouren'),
    ],
  },
  {
    heroId: 'sima-yi',
    name: { zh: '鷹視狼顧', en: 'The Patient Schemer' },
    // 名利:解场最多的一套(法正/周瑜点杀 + 火計/聲東擊西),司馬家高血站场磨死对手。
    cardIds: [
      ...copies(1, 'han-fu'), ...copies(2, 'eq-teng-jia', 'strat-shengdong-jixi'),
      ...copies(2, 'hist-gao-jianli', 'eq-mingguang-kai', 'strat-huo-ji'),
      ...copies(2, 'zhuge-ke', 'fa-zheng'), ...copies(1, 'hist-you-yu'),
      ...copies(2, 'wang-ping', 'sima-shi'), ...copies(1, 'cao-pi', 'sima-yi'),
      ...copies(2, 'zhou-tai', 'cheng-pu', 'chen-dao'), ...copies(1, 'hist-yang-su', 'zhou-yu'),
    ],
  },
  {
    heroId: 'sun-quan',
    name: { zh: '坐斷東南', en: 'Lords of the Riverlands' },
    // 割据:江东羁绊,馬騰/周泰 5/7 守护三对铺满六费,孫策冲锋收场。
    cardIds: [
      ...copies(1, 'zhang-bu'), ...copies(2, 'eq-teng-jia', 'strat-shengdong-jixi'),
      ...copies(2, 'hu-zong', 'eq-mingguang-kai', 'strat-huo-ji'),
      // 试过把 zhu-ran(6/6)换成 du-yu(4/6 守护+光环)、hist-li-yu 换成 zhou-fang
      // (3/4 潜行+冻结战吼):总胜率反而从 38% 掉到 36%。光环与控场的价值抵不过
      // 直接掉的 3 点身材 —— 割据这套是靠站场磨死对手的,身材就是它的答案本身。
      ...copies(2, 'man-chong', 'lu-fan'), ...copies(1, 'hist-li-yu'),
      ...copies(2, 'wang-ping', 'shi-xie'), ...copies(1, 'sun-quan', 'hist-wang-shichong'),
      ...copies(2, 'ma-teng', 'zhou-tai', 'cheng-pu'), ...copies(1, 'sun-ce', 'zhu-ran'),
    ],
  },
  {
    heroId: 'hist-laozi',
    name: { zh: '大隱於市', en: 'The Hidden Sages' },
    // 隐逸:抽牌续航 + 张衡/嵇康的点杀与遗计。隐逸卡池 6 费断档,顶端用中立猛将补齐。
    cardIds: [
      ...copies(1, 'ruan-xian'), ...copies(2, 'eq-teng-jia', 'strat-shengdong-jixi'),
      ...copies(2, 'shi-tao', 'eq-mingguang-kai', 'strat-huo-ji'),
      ...copies(2, 'hist-zhang-heng', 'ji-kang'), ...copies(1, 'hist-tang-yin'),
      ...copies(2, 'hist-kou-qianzhi', 'wang-ping'), ...copies(1, 'hist-laozi', 'hist-xu-xiake'),
      ...copies(2, 'cheng-pu', 'chen-dao', 'guan-xing'), ...copies(1, 'wen-chou', 'yu-jin'),
    ],
  },
]

// 结构化的违规项。UI 需要能翻成人话 ——
// 从前 collectionStore 把 validateDeck 的英文诊断信息当双语原样透传,
// 中文玩家会看到 `deck must have exactly 30 cards, got 27`。
export type DeckViolation =
  | { code: 'unknown-hero'; heroId: string }
  | { code: 'bad-size'; size: number }
  | { code: 'unknown-card'; cardId: string }
  | { code: 'too-many-copies'; cardId: string; count: number; limit: number }
  | { code: 'wrong-doctrine'; cardId: string; doctrine: string; heroDoctrine: string }
  | { code: 'not-collectible'; cardId: string }

export function validateDeckDetailed(
  deck: DeckList,
  cardsById: Record<string, CardDef | undefined>,
  heroesById: Record<string, HeroDef | undefined>,
): DeckViolation[] {
  const out: DeckViolation[] = []
  const hero = heroesById[deck.heroId]
  if (!hero) return [{ code: 'unknown-hero', heroId: deck.heroId }]
  if (deck.cardIds.length !== DECK_SIZE) {
    out.push({ code: 'bad-size', size: deck.cardIds.length })
  }
  const counts = new Map<string, number>()
  for (const id of deck.cardIds) counts.set(id, (counts.get(id) ?? 0) + 1)
  for (const [cardId, count] of counts) {
    const card = cardsById[cardId]
    if (!card) {
      out.push({ code: 'unknown-card', cardId })
      continue
    }
    // 衍生物只能被召唤,不可构筑
    if (card.token) out.push({ code: 'not-collectible', cardId })
    const limit = card.rarity === 'legendary' ? 1 : 2
    if (count > limit) out.push({ code: 'too-many-copies', cardId, count, limit })
    if (card.doctrine !== 'neutral' && card.doctrine !== hero.doctrine) {
      out.push({
        code: 'wrong-doctrine',
        cardId,
        doctrine: card.doctrine,
        heroDoctrine: hero.doctrine,
      })
    }
  }
  return out
}

// 英文诊断串。服务器日志与测试断言用这个;面向玩家的文案走 validateDeckDetailed。
export function validateDeck(
  deck: DeckList,
  cardsById: Record<string, CardDef | undefined>,
  heroesById: Record<string, HeroDef | undefined>,
): string[] {
  return validateDeckDetailed(deck, cardsById, heroesById).map((v) => {
    switch (v.code) {
      case 'unknown-hero':
        return `unknown hero: ${v.heroId}`
      case 'bad-size':
        return `deck must have exactly ${DECK_SIZE} cards, got ${v.size}`
      case 'unknown-card':
        return `unknown card id: ${v.cardId}`
      case 'not-collectible':
        return `token card is not collectible: ${v.cardId}`
      case 'too-many-copies':
        return v.limit === 1
          ? `more than 1 copy of legendary ${v.cardId} (${v.count})`
          : `more than 2 copies of ${v.cardId} (${v.count})`
      case 'wrong-doctrine':
        return `${v.cardId} doctrine ${v.doctrine} does not match hero doctrine ${v.heroDoctrine}`
    }
  })
}
