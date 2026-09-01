// 「把一张卡换进一副预组」的**纯函数**。
//
// 【为什么要抽出来】
// 这段逻辑原来长在 sim-cards.ts 的中间,没有一行测试 —— 而它决定了
// **整把尺子量的是什么**:换掉谁、换几张、能不能换,直接决定 Δ 的含义。
// sim-cards 自己的注释里就记着一次教训:同一张白板 4/7 在一套预组里是 −15.8、
// 在另一套里只有 −1.2,差别不在这张卡,在**它换掉了谁**。
// 一段能左右所有读数的逻辑,不该是没人验过的。
//
// 【KIT:为什么需要「配合卡」这个概念】
// 有一整类条件是 sim-cards 此前**结构性量不了**的:
//   `ifChain`(本回合已结算的锦囊数)· `ifSupply`(屯粮)·
//   `ifHandCount`(手牌数)· `ifKeywordCount`(带某关键词的友方数)
// 它们的前置条件不是「打到第几回合」那种会自己发生的事,而是
// **牌库里得配着别的卡**。而这个脚本是单张换入 —— 于是量到的是
// 「前置条件没出现」,不是「这张卡强不强」。第三十三卡包为此停过一次手。
//
// KIT 的做法是把配合卡**同时换进基准和待测两副牌**:
//   基准 = 预组 ⊕ KIT
//   待测 = 预组 ⊕ KIT ⊕ 待测卡
// 于是 Δ 隔离出来的是「**在有配合的前提下**,这张卡值多少」——
// 而这正是那四个条件唯一有意义的问法。
// ⚠️ 反过来说,KIT 下的 Δ **不能**和无 KIT 的历史数字直接比:
// 基准不是同一副牌了。

export interface SwapOptions {
  /** 换几张 */
  copies: number
  /** 查一张卡的费用;查不到返回 99(排到最后) */
  costOf: (id: string) => number
  /** 不许被换掉的卡 —— KIT 换进去之后必须保住,否则待测卡会把使自己生效的东西挤掉 */
  protect?: ReadonlySet<string>
}

/**
 * 把 `cardId` 换进 `deck`,替换掉**费用最接近**的那张普通牌。
 *
 * 换费用最接近的很重要:否则量到的是曲线变化,不是这张牌本身。
 * 同费按 id 字典序,保证同一副牌同一张卡永远换掉同一个人(可复现)。
 *
 * 换不满 `copies` 张就返回 `null` —— **不返回换了一半的牌**:
 * 半套的读数没有意义,而且它会安静地混进结果里。
 */
export function swapInto(deck: readonly string[], cardId: string, opts: SwapOptions): string[] | null {
  const { copies, costOf, protect } = opts
  const out = [...deck]
  const cost = costOf(cardId)
  const counts = new Map<string, number>()
  for (const id of out) counts.set(id, (counts.get(id) ?? 0) + 1)
  const victims = [...counts.keys()]
    .filter((id) => id !== cardId && !protect?.has(id))
    .sort((a, b) => Math.abs(costOf(a) - cost) - Math.abs(costOf(b) - cost) || a.localeCompare(b))
  let need = copies
  for (const victim of victims) {
    while (need > 0) {
      const i = out.indexOf(victim)
      if (i < 0) break
      out[i] = cardId
      need--
    }
    if (need === 0) break
  }
  return need === 0 ? out : null
}

/**
 * 依次把 KIT 里的每张卡换进牌组,并把它们全部标为受保护 ——
 * 后换的不许挤掉先换的,待测卡也不许挤掉任何一张。
 *
 * 返回 `null` 表示这副牌塞不下这套 KIT(换不满),调用方应当跳过这张待测卡
 * 而不是拿一副残缺的牌去量。
 */
export function applyKit(
  deck: readonly string[],
  kit: readonly string[],
  opts: SwapOptions,
): { deck: string[]; protect: Set<string> } | null {
  const protect = new Set<string>(opts.protect ?? [])
  let cur = [...deck]
  for (const id of kit) {
    const next = swapInto(cur, id, { ...opts, protect })
    if (!next) return null
    cur = next
    protect.add(id)
  }
  return { deck: cur, protect }
}
