import type { CardLibrary } from '../engine/types'
import { DECK_SIZE } from '../engine/types'
import type { DeckList } from './decks'

// 卡组码:把一副卡组编成一串可复制的文本,再解回来。
// 此前完全没有 —— 玩家能导出**单张卡面的 PNG**,却没法把卡组分享给任何人。
//
// 格式(v1):`QG1.<base64url>`,载荷是一串 varint:
//   [版本, 主公序号, 单张卡数, (卡序号, 份数)...]
// 用 collectorNo 而不是字符串 id:2250 张卡的 id 平均十几个字符,
// 直接编 id 的话码长会到七八百字符,没法手工传递。collectorNo 是稳定的小整数。
//
// 兼容性:码里带版本号,且解码时逐个校验卡是否存在 —— 卡池调整后旧码只会
// 报「有卡不存在」,不会静默解出一副错的牌。

const PREFIX = 'QG1.'

function writeVarint(out: number[], n: number): void {
  let v = n >>> 0
  while (v >= 0x80) {
    out.push((v & 0x7f) | 0x80)
    v >>>= 7
  }
  out.push(v)
}

function readVarint(bytes: number[], cursor: { i: number }): number {
  let result = 0
  let shift = 0
  for (let guard = 0; guard < 5; guard++) {
    if (cursor.i >= bytes.length) throw new Error('truncated')
    const b = bytes[cursor.i++]
    result |= (b & 0x7f) << shift
    if ((b & 0x80) === 0) return result >>> 0
    shift += 7
  }
  throw new Error('varint too long')
}

function toBase64Url(bytes: number[]): string {
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function fromBase64Url(s: string): number[] {
  const padded = s.replace(/-/g, '+').replace(/_/g, '/')
  const bin = atob(padded + '='.repeat((4 - (padded.length % 4)) % 4))
  return [...bin].map((c) => c.charCodeAt(0))
}

export function encodeDeck(deck: DeckList, lib: CardLibrary, heroNo: number): string {
  const counts = new Map<number, number>()
  for (const id of deck.cardIds) {
    const no = lib[id]?.collectorNo
    if (no === undefined) throw new Error(`unknown card: ${id}`)
    counts.set(no, (counts.get(no) ?? 0) + 1)
  }
  const entries = [...counts.entries()].sort((a, b) => a[0] - b[0])
  const bytes: number[] = []
  writeVarint(bytes, 1) // 版本
  writeVarint(bytes, heroNo)
  writeVarint(bytes, entries.length)
  for (const [no, n] of entries) {
    writeVarint(bytes, no)
    writeVarint(bytes, n)
  }
  return PREFIX + toBase64Url(bytes)
}

export interface DecodedDeck {
  heroId: string
  cardIds: string[]
}

// 解码失败一律抛 Error,调用方翻成人话给玩家看
export function decodeDeck(code: string, lib: CardLibrary): DecodedDeck {
  const trimmed = code.trim()
  if (!trimmed.startsWith(PREFIX)) throw new Error('bad-prefix')
  let bytes: number[]
  try {
    bytes = fromBase64Url(trimmed.slice(PREFIX.length))
  } catch {
    throw new Error('bad-base64')
  }
  const cursor = { i: 0 }
  const version = readVarint(bytes, cursor)
  if (version !== 1) throw new Error('bad-version')

  // collectorNo → id 的反查表。同号取第一个(卡池里 collectorNo 唯一,
  // 这里的兜底只为不让一条脏数据把整次解码搞崩)。
  const byNo = new Map<number, string>()
  for (const c of Object.values(lib)) {
    if (!byNo.has(c.collectorNo)) byNo.set(c.collectorNo, c.id)
  }

  const heroNo = readVarint(bytes, cursor)
  const heroId = byNo.get(heroNo)
  if (!heroId) throw new Error('unknown-hero')

  const count = readVarint(bytes, cursor)
  const cardIds: string[] = []
  for (let i = 0; i < count; i++) {
    const no = readVarint(bytes, cursor)
    const n = readVarint(bytes, cursor)
    const id = byNo.get(no)
    if (!id) throw new Error(`unknown-card:${no}`)
    if (n < 1 || n > DECK_SIZE) throw new Error('bad-count')
    for (let k = 0; k < n; k++) cardIds.push(id)
  }
  if (cardIds.length !== DECK_SIZE) throw new Error('bad-size')
  return { heroId, cardIds }
}
