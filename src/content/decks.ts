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

export const PRECON_DECKS: DeckList[] = [
  {
    heroId: 'liu-bei',
    name: { zh: '桃園仁德', en: 'Oath of the Peach Garden' },
    cardIds: [
      ...copies(2, 'liu-xie', 'liu-qi'), // 2费
      ...copies(2, 'sun-qian', 'yi-ji', 'cui-yan', 'strat-caochuan-jiejian'), // 3费
      ...copies(2, 'fei-yi', 'ma-liang'), // 4费
      ...copies(2, 'deng-zhi', 'liao-hua'), // 5费
      ...copies(1, 'ma-dai'),
      ...copies(2, 'zhang-fei'), // 6费
      ...copies(1, 'liu-bei', 'zhuge-liang', 'wei-yan'),
      ...copies(2, 'chen-dao'),
      ...copies(1, 'guan-yu', 'zhao-yun'), // 7费
    ],
  },
  {
    heroId: 'cao-cao',
    name: { zh: '魏武揮鞭', en: 'The Tyrant’s Vanguard' },
    cardIds: [
      ...copies(2, 'lady-bian'), // 2费
      ...copies(2, 'chen-jiao', 'wang-lang', 'strat-beishui-yizhan'), // 3费
      ...copies(1, 'strat-pofu-chenzhou'),
      ...copies(2, 'liu-ye', 'dong-zhao'), // 4费
      ...copies(2, 'cao-hong'), // 5费
      ...copies(1, 'chen-gong', 'strat-andu-chencang'),
      ...copies(2, 'hua-xiong'), // 5费
      ...copies(2, 'xu-chu', 'zhang-liao', 'xiahou-dun'), // 6费
      ...copies(1, 'dian-wei', 'hist-han-xin'),
      ...copies(1, 'cao-cao', 'hist-huo-qubing'), // 7费
      ...copies(1, 'hist-xiang-yu'), // 8费
    ],
  },
  {
    heroId: 'hist-confucius',
    name: { zh: '克己復禮', en: 'Rites and Righteousness' },
    cardIds: [
      ...copies(2, 'liu-ba', 'hist-sang-hongyang', 'hist-hai-rui', 'strat-yuanjiao-jingong'), // 3费
      ...copies(1, 'strat-huo-ji'),
      ...copies(2, 'xun-you', 'cheng-yu', 'tian-feng', 'zhang-zhao'), // 4费
      ...copies(1, 'hist-xunzi'),
      ...copies(2, 'hist-bao-zheng', 'xun-yu', 'hist-yan-zhenqing'), // 5费
      ...copies(1, 'hist-yu-qian', 'hist-fan-zhongyan', 'hist-confucius'),
      ...copies(2, 'huang-zhong'), // 6费
      ...copies(1, 'hist-wang-shouren'),
    ],
  },
  {
    heroId: 'sima-yi',
    name: { zh: '鷹視狼顧', en: 'The Patient Schemer' },
    cardIds: [
      ...copies(2, 'hist-gao-jianli', 'hist-yu-ji'), // 3费
      ...copies(1, 'hist-wei-jie'),
      ...copies(2, 'diaochan', 'guo-jia', 'fa-zheng', 'hist-su-qin', 'strat-lianhuan-ji'), // 4费
      ...copies(1, 'strat-fanjian-ji'),
      ...copies(2, 'jia-xu', 'cao-pi'), // 5费
      ...copies(1, 'sima-yi', 'sima-shi', 'zhang-jiao', 'hist-jing-ke', 'pang-tong'),
      ...copies(2, 'hist-yang-youji'), // 6费
      ...copies(1, 'zhou-yu', 'lu-xun', 'strat-meiren-ji'),
    ],
  },
  {
    heroId: 'sun-quan',
    name: { zh: '坐斷東南', en: 'Lords of the Riverlands' },
    cardIds: [
      ...copies(2, 'da-qiao', 'sun-liang', 'strat-kurou-ji'), // 2费
      ...copies(2, 'yu-fan', 'chen-jiao'), // 3费
      ...copies(2, 'hist-li-yu', 'kan-ze', 'bu-zhi', 'luo-tong'), // 4费
      ...copies(1, 'pan-zhang', 'zhou-tai'), // 5-6费
      ...copies(1, 'sun-quan', 'han-dang', 'hist-chen-sheng'),
      ...copies(2, 'taishi-ci', 'gan-ning', 'lu-meng'), // 6费
      ...copies(1, 'sun-ce'),
    ],
  },
  {
    heroId: 'hist-laozi',
    name: { zh: '大隱於市', en: 'The Hidden Sages' },
    cardIds: [
      ...copies(2, 'zhang-zhongjing', 'strat-shengdong-jixi'), // 2费
      ...copies(2, 'zuo-ci', 'yu-ji', 'hua-tuo', 'sima-hui', 'cui-zhouping', 'strat-huo-ji'), // 3费
      ...copies(2, 'ji-kang', 'xu-shu', 'hist-bian-que'), // 4费
      ...copies(2, 'hist-zhuangzi', 'hist-guiguzi'), // 5费
      ...copies(1, 'hist-laozi', 'hist-li-bai'),
      ...copies(1, 'hist-long-qu'), // 6费
      ...copies(1, 'lu-bu'), // 8费
    ],
  },
]

// 返回违规列表(空数组 = 合法)。
export function validateDeck(
  deck: DeckList,
  cardsById: Record<string, CardDef | undefined>,
  heroesById: Record<string, HeroDef | undefined>,
): string[] {
  const violations: string[] = []
  const hero = heroesById[deck.heroId]
  if (!hero) {
    violations.push(`unknown hero: ${deck.heroId}`)
    return violations
  }
  if (deck.cardIds.length !== DECK_SIZE) {
    violations.push(`deck must have exactly ${DECK_SIZE} cards, got ${deck.cardIds.length}`)
  }
  const counts = new Map<string, number>()
  for (const id of deck.cardIds) counts.set(id, (counts.get(id) ?? 0) + 1)
  for (const [id, count] of counts) {
    const card = cardsById[id]
    if (!card) {
      violations.push(`unknown card id: ${id}`)
      continue
    }
    if (count > 2) violations.push(`more than 2 copies of ${id} (${count})`)
    if (card.rarity === 'legendary' && count > 1) {
      violations.push(`more than 1 copy of legendary ${id} (${count})`)
    }
    if (card.doctrine !== 'neutral' && card.doctrine !== hero.doctrine) {
      violations.push(`${id} doctrine ${card.doctrine} does not match hero doctrine ${hero.doctrine}`)
    }
  }
  return violations
}
