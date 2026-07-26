import { CARDS_BY_ID, SIGNATURE_IDS } from './cards'
import { LORE } from './generated/lore.gen'

// 历史小测验「稽古」:结合卡池的历史知识小测。
//
// 题目**从列传数据生成**,不手写 —— 每位签名名将都带传记与时代,
// 于是「这句列传说的是谁」「此人属哪个朝代」天然就是两类题干。
// 题库随卡池自动生长,零维护。
//
// 教育向的差异化:别家 CCG 没有真历史可考,这一屏既是留存钩子也是传播素材。

export type QuizKind = 'whoIsIt' | 'whichDynasty'

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
export function makeQuestion(seed: number): QuizQuestion | null {
  if (QUIZ_POOL.length < 4) return null
  const rand = lcg(seed)
  const subjectId = QUIZ_POOL[Math.floor(rand() * QUIZ_POOL.length)]
  const card = CARDS_BY_ID[subjectId]
  const lore = LORE[subjectId]
  if (!card || !lore) return null
  const kind: QuizKind = rand() < 0.6 ? 'whoIsIt' : 'whichDynasty'

  if (kind === 'whoIsIt') {
    // 题干:传记片段(去掉人名本身,免得白送)
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
