import { describe, expect, it } from 'vitest'
import { COLLECTIBLE_CARDS } from './cards'
import { TITLE_OVERRIDES } from './overrides/titles'

// 爵位与尊号必须译出来,不能音译掉。
//
// 【为什么需要机器来查】
// 英文名来自源数据,而源数据是**逐条人工填的** —— 同一种结构在不同批次里
// 会填成不同样子:漢靈帝译成 Emperor Ling,漢武帝却留成 Han Wudi;
// 信陵君译成 Lord Xinling,毛公却留成 Mao Gong。
// 这类不一致人眼发现不了(要同时看见相隔两千张的两条),但英文玩家一眼就看得出
// ——「Emperor Ling 和 Han Wudi 是同一个朝代的两位皇帝?」
//
// 【这道闸门为什么不能写成「凡带王/公/君就必须有 Lord/King」】
// 因为同一个字在中文里有两种身份:卓文君、王昭君、駱賓王 里的「君」「王」
// 是名字的一部分,音译才是对的。所以闸门只钉**已经判定过的那批**,
// 外加一条方向性检查:不许再出现「把爵位和地名黏成一个词」的音译。
describe('爵位与尊号', () => {
  const byId = new Map(COLLECTIBLE_CARDS.map((c) => [c.id, c]))

  it('尊号层里的每一条都还指向真实存在的卡', () => {
    // 卡池重导之后 id 可能变,而覆盖层指到不存在的 id 会**静默失效** ——
    // 名字悄悄退回音译版,没有任何提示。
    const dangling = Object.keys(TITLE_OVERRIDES).filter((id) => !byId.has(id))
    expect(dangling, '这些 id 在卡池里找不到,尊号覆盖已经失效').toEqual([])
  })

  it('尊号层确实生效了(合并顺序没把它盖回去)', () => {
    const notApplied: string[] = []
    for (const [id, ov] of Object.entries(TITLE_OVERRIDES)) {
      const card = byId.get(id)
      if (card && ov.name && card.name.en !== ov.name.en) {
        notApplied.push(`${id}: 期望 ${ov.name.en},实际 ${card.name.en}`)
      }
    }
    expect(notApplied).toEqual([])
  })

  it('諡号帝王统一成 Emperor X of Y,不留 Han Wudi 这种音译', () => {
    // 「诸侯/朝代 + 諡号 + 帝」这个结构必须译出来。
    // 清代帝王按年号称呼(道光帝 → Daoguang Emperor)是另一套惯例,不在此列 ——
    // 判据是諡号只有一个字且前面带朝代名。
    const bad = COLLECTIBLE_CARDS.filter(
      (c) =>
        /^[漢唐宋明隋晉元魏蜀吳齊梁陳周秦][^帝]{1,2}帝$/.test(c.name.zh) &&
        !/\bEmperor\b|\bEmpress\b/.test(c.name.en),
    ).map((c) => `${c.name.zh} -> ${c.name.en}`)
    expect(bad).toEqual([])
  })

  it('封号不许和地名黏成一个词', () => {
    // Lanlingwang 这种:英文读者既断不了词也查不到人。
    // 拼音里连着出现 wang/gong/jun/hou/di 结尾且整体是一个词的,基本都是这种。
    const bad = COLLECTIBLE_CARDS.filter(
      (c) => /^[A-Z][a-z]+(wang|gong|jun|hou|di)$/.test(c.name.en) && c.name.zh.length >= 3,
    ).map((c) => `${c.name.zh} -> ${c.name.en}`)
    expect(bad).toEqual([])
  })
})
