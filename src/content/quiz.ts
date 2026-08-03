import { CARDS_BY_ID, SIGNATURE_IDS } from './cards'
import { LORE, TRAIT_NAMES } from './generated/lore.gen'
import { ALL_RIVALS, rivalPair } from './relations'
import { ERA_OF } from './eras'

// 历史小测验「稽古」:结合卡池的历史知识小测。
//
// 题目**从列传数据生成**,不手写 —— 每位签名名将都带传记与时代,
// 于是「这句列传说的是谁」「此人属哪个朝代」天然就是两类题干。
// 题库随卡池自动生长,零维护。
//
// 教育向的差异化:别家 CCG 没有真历史可考,这一屏既是留存钩子也是传播素材。

// 三种题型。前两种从列传生成,第三种从**关系**生成 ——
// 这一轮把 31 条羁绊与 29 对宿敌做进了内容层,而它们恰好是最好的题干:
// 「谁和谁是宿敌」比「谁是哪个朝代的」更能考出真读过史料的人。
// 【2026-08 新增三类】档案层这一轮补齐之后,题库的原料多了三样:
// 表字(1,203 名)、籍贯(1,916 名)、性格特质(967 名)。
// 「谁的字是子仲」比「谁是哪个朝代的」更能考出真读过传的人 ——
// 朝代题看一眼卡面就能猜,表字与籍贯只写在列传里。
export type QuizKind =
  | 'whoIsIt'
  | 'whichDynasty'
  | 'whoIsRival'
  | 'whoseCourtesy' // 这个「字」是谁的
  | 'whereFrom' // 此人是哪里人
  | 'whoseTrait' // 史书说谁「嗜酒」「多疑」

export interface QuizQuestion {
  kind: QuizKind
  prompt: { zh: string; en: string } // 题干(传记片段 / 人名)
  subjectId: string // 正确答案对应的卡 id
  options: string[] // 选项(人名 id 或朝代 tag)
  answer: string // 正确选项
}

// 有列传的签名卡 —— 题库来源
export const QUIZ_POOL: string[] = SIGNATURE_IDS.filter(
  (id) => CARDS_BY_ID[id] && LORE[id]?.bio?.zh,
)

// 确定性伪随机(种子 → [0,1)),让同一场测验可复现
function lcg(seed: number): () => number {
  let s = seed >>> 0 || 1
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0
    return s / 0x100000000
  }
}

function pickDistinct<T>(pool: T[], n: number, exclude: T[], rand: () => number): T[] {
  const out: T[] = []
  let guard = 0
  while (out.length < n && guard++ < 500) {
    const v = pool[Math.floor(rand() * pool.length)]
    if (v === undefined) continue
    if (exclude.includes(v) || out.includes(v)) continue
    out.push(v)
  }
  return out
}

// 生成一道题。kind 由种子决定,选项四选一。
export function makeQuestion(seed: number, depth = 0): QuizQuestion | null {
  if (QUIZ_POOL.length < 4) return null
  // 新三类依赖档案字段(覆盖率 50–85%),抽到没有表字的人很正常 ——
  // 那时候换一道而不是给空题。**必须有界**:池子极端时可能一直换不到,
  // 递归下去就是栈溢出。八次换不出来就退回传记题(它的题库永远够)。
  if (depth > 8) return null
  const rand = lcg(seed)
  const subjectId = QUIZ_POOL[Math.floor(rand() * QUIZ_POOL.length)]
  const card = CARDS_BY_ID[subjectId]
  const lore = LORE[subjectId]
  if (!card || !lore) return null
  const roll = rand()
  // 六类的配比:传记题仍是主力(题库最大、也最好玩),关系题占两成
  //(29 对宿敌,占比高了会重复),新的三类各占一成左右。
  // **出不了就退回传记题** —— 新三类依赖档案字段,而档案覆盖率是 50–85%,
  // 抽到没有表字的人很正常,那时候不该给一道空题。
  const kind: QuizKind =
    roll < 0.34
      ? 'whoIsIt'
      : roll < 0.5
        ? 'whichDynasty'
        : roll < 0.66
          ? 'whoIsRival'
          : roll < 0.78
            ? 'whoseCourtesy'
            : roll < 0.9
              ? 'whereFrom'
              : 'whoseTrait'

  // ---- 表字题:「子仲」是谁的字 ----
  if (kind === 'whoseCourtesy') {
    const cz = lore.courtesy?.zh
    // 干扰项也必须**真有表字**,否则四个选项里三个是「没有字的人」,一眼看穿
    const pool = QUIZ_POOL.filter((id) => LORE[id]?.courtesy?.zh)
    if (!cz || pool.length < 4) return makeQuestion(seed + 1, depth + 1)
    const wrong = pickDistinct(pool, 3, [subjectId], rand)
    if (wrong.length < 3) return makeQuestion(seed + 1, depth + 1)
    return {
      kind,
      prompt: { zh: cz, en: cz },
      subjectId,
      options: shuffle([subjectId, ...wrong], rand),
      answer: subjectId,
    }
  }

  // ---- 籍贯题:此人是哪里人 ----
  if (kind === 'whereFrom') {
    const home = lore.home?.zh
    const pool = QUIZ_POOL.filter((id) => LORE[id]?.home?.zh)
    if (!home || pool.length < 4) return makeQuestion(seed + 1, depth + 1)
    // 选项是**籍贯**而不是人名 —— 于是去重要按**地名**去重,不是按人。
    // 不同的人同籍贯太常见了(「潁川人」一抓一把),按人挑三个干扰项
    // 很容易挑出两个「潁川人」,四个选项变三个(测试在种子 513 抓到过)。
    const wrongHomes: string[] = []
    for (const id of pool) {
      const h = LORE[id]?.home?.zh
      if (!h || h === home || wrongHomes.includes(h)) continue
      wrongHomes.push(h)
      if (wrongHomes.length >= 12) break
    }
    const chosen3 = pickDistinct(wrongHomes, 3, [home], rand)
    if (chosen3.length < 3) return makeQuestion(seed + 1, depth + 1)
    return {
      kind,
      prompt: { zh: card.name.zh, en: card.name.en ?? card.name.zh },
      subjectId,
      options: shuffle([home, ...chosen3], rand),
      answer: home,
    }
  }

  // ---- 性格题:史书说谁「嗜酒」「多疑」 ----
  if (kind === 'whoseTrait') {
    const traits = lore.traits ?? []
    const pool = QUIZ_POOL.filter((id) => (LORE[id]?.traits ?? []).length > 0)
    if (traits.length === 0 || pool.length < 4) return makeQuestion(seed + 1, depth + 1)
    const tr = traits[Math.floor(rand() * traits.length)]
    // 干扰项必须**不带这条特质**,否则会有两个正确答案
    const wrong = pickDistinct(
      pool.filter((id) => !(LORE[id]?.traits ?? []).includes(tr)),
      3,
      [subjectId],
      rand,
    )
    if (wrong.length < 3) return makeQuestion(seed + 1, depth + 1)
    const label = TRAIT_NAMES[tr]
    if (!label) return makeQuestion(seed + 1, depth + 1)
    return {
      kind,
      prompt: label,
      subjectId,
      options: shuffle([subjectId, ...wrong], rand),
      answer: subjectId,
    }
  }

  if (kind === 'whoIsRival') {
    // 从宿敌里出题:「此人的宿敌是谁」。答案与干扰项都是真实名将,
    // 干扰项刻意从**同一时代块**里挑 —— 随便挑的话「隔了八百年那个」一眼就排除了。
    if (ALL_RIVALS.length === 0) return null
    const ref = ALL_RIVALS[Math.floor(rand() * ALL_RIVALS.length)]
    const [a, b] = rivalPair(ref)
    const askAnchor = rand() < 0.5
    const askId = askAnchor ? a : b
    const ansId = askAnchor ? b : a
    const askCard = CARDS_BY_ID[askId]
    const ansCard = CARDS_BY_ID[ansId]
    if (!askCard || !ansCard) return null
    const sameEra = QUIZ_POOL.filter(
      (id) => CARDS_BY_ID[id] && ERA_OF[CARDS_BY_ID[id].dynasty] === ERA_OF[ansCard.dynasty],
    )
    const wrong = pickDistinct(sameEra.length >= 6 ? sameEra : QUIZ_POOL, 3, [askId, ansId], rand)
    if (wrong.length < 3) return null
    return {
      kind,
      prompt: { zh: askCard.name.zh, en: askCard.name.en ?? askCard.name.zh },
      subjectId: askId,
      options: shuffle([ansId, ...wrong], rand),
      answer: ansId,
    }
  }

  if (kind === 'whoIsIt') {
    // 题干:传记片段(去掉人名本身,免得白送)
    // 生平现在是可选的(源头查不到就空着,不用程序编)——
    // 没有生平就出不了「这是谁」这种题,直接换一道
    if (!lore.bio?.zh) return null
    const zh = lore.bio.zh.replace(new RegExp(card.name.zh, 'g'), '□□')
    const en = (lore.bio.en ?? '').replace(new RegExp(card.name.en ?? '', 'g'), '—')
    const wrong = pickDistinct(QUIZ_POOL, 3, [subjectId], rand)
    if (wrong.length < 3) return null
    const options = shuffle([subjectId, ...wrong], rand)
    return { kind, prompt: { zh, en }, subjectId, options, answer: subjectId }
  }

  // whichDynasty:此人属哪个朝代阵营
  const dynPool = [...new Set(QUIZ_POOL.map((id) => CARDS_BY_ID[id].dynasty))]
  if (dynPool.length < 4) return null
  const wrong = pickDistinct(dynPool, 3, [card.dynasty], rand)
  if (wrong.length < 3) return null
  const options = shuffle([card.dynasty, ...wrong], rand)
  return {
    kind,
    prompt: { zh: card.name.zh, en: card.name.en ?? card.name.zh },
    subjectId,
    options,
    answer: card.dynasty,
  }
}

function shuffle<T>(arr: T[], rand: () => number): T[] {
  const a = arr.slice()
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

// 人名题的选项显示名。朝代题的选项是 dynasty tag,由 UI 用 dynastyName() 翻译
//(内容层不依赖 ui 层 —— 那是反向依赖)。
export function personLabel(id: string): { zh: string; en: string } {
  const c = CARDS_BY_ID[id]
  return { zh: c?.name.zh ?? id, en: c?.name.en ?? id }
}

export const QUIZ_LENGTH = 5 // 一轮五题
export const QUIZ_MERIT_PER_CORRECT = 12 // 每答对一题的功勋(每日封顶见 store)
