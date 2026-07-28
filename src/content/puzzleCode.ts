import type { GameConfig, PuzzleScenario, PuzzleSide, PuzzleUnit } from '../engine/types'
import { CARDS_BY_ID } from './cards'
import { HEROES_BY_ID } from './overrides/heroes'
import type { LethalPuzzle } from './lethalPuzzles'

// 殘局分享碼 —— 玩家之间传递斩杀谜题。
//
// 【为什么这件事在这里特别便宜】
// UGC 最难的一环从来不是编辑器,是**审核**:谁来保证这道题真的有解?
// 而这个游戏有 `solveLethal` —— 一个完备的单回合求解器。
// 导入的时候当场跑一遍,无解的、或者「全体打脸就赢」的平凡题**直接拒收**。
// 别家做 UGC 要请人审,这里是一行断言。
//
// 【为什么是码而不是文件/服务器】
// 残局本身很小(两侧血量法力 + 十来个单位 + 手牌 id),压成一串码几百字节,
// 微信/贴吧/截图都能传。而战报是几 MB(见 recapExport 的说明),那才需要服务器。
//
// 【格式】
// `QGP1.<base64url>`,里面是紧凑 JSON。用 collectorNo 而不是字符串 id ——
// id 是给代码读的,编号是给码读的,后者短得多且随卡池演进稳定。
const PREFIX = 'QGP1.'

interface WireUnit {
  n: number // collectorNo
  d?: number // damage
  x?: 1 // exhausted
  f?: 1 // frozen
  s?: 1 // silenced
}
interface WireSide {
  hp: number
  a?: number
  m: number
  b: WireUnit[]
  h: number[]
}
interface Wire {
  p: [string, string] // heroIds
  s: [WireSide, WireSide]
  t: 0 | 1 // activePlayer
}

function noOf(defId: string): number {
  const n = CARDS_BY_ID[defId]?.collectorNo
  if (n === undefined) throw new Error(`unknown card: ${defId}`)
  return n
}

const BY_NO = new Map<number, string>()
for (const c of Object.values(CARDS_BY_ID)) BY_NO.set(c.collectorNo, c.id)

function idOf(no: number): string {
  const id = BY_NO.get(no)
  if (!id) throw new Error(`unknown collector no: ${no}`)
  return id
}

function toWireSide(s: PuzzleSide): WireSide {
  return {
    hp: s.heroHp,
    a: s.armor || undefined,
    m: s.mana,
    b: s.board.map((u) => ({
      n: noOf(u.defId),
      d: u.damage || undefined,
      x: u.exhausted ? 1 : undefined,
      f: u.frozen ? 1 : undefined,
      s: u.silenced ? 1 : undefined,
    })),
    h: s.hand.map(noOf),
  }
}

function fromWireSide(w: WireSide): PuzzleSide {
  return {
    heroHp: w.hp,
    armor: w.a,
    mana: w.m,
    board: w.b.map(
      (u): PuzzleUnit => ({
        defId: idOf(u.n),
        damage: u.d,
        exhausted: u.x === 1 ? true : undefined,
        frozen: u.f === 1 ? true : undefined,
        silenced: u.s === 1 ? true : undefined,
      }),
    ),
    hand: w.h.map(idOf),
  }
}

function b64urlEncode(s: string): string {
  const bytes = new TextEncoder().encode(s)
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function b64urlDecode(s: string): string {
  const pad = s.replace(/-/g, '+').replace(/_/g, '/')
  const bin = atob(pad + '='.repeat((4 - (pad.length % 4)) % 4))
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0))
  return new TextDecoder().decode(bytes)
}

export function encodePuzzle(heroes: [string, string], scenario: PuzzleScenario): string {
  const wire: Wire = {
    p: heroes,
    s: [toWireSide(scenario.players[0]), toWireSide(scenario.players[1])],
    t: scenario.activePlayer,
  }
  return PREFIX + b64urlEncode(JSON.stringify(wire))
}

export type PuzzleDecodeError =
  | 'bad-prefix'
  | 'bad-payload'
  | 'unknown-card'
  | 'unknown-hero'
  | 'empty-board'

export function decodePuzzle(
  code: string,
): { ok: true; heroes: [string, string]; scenario: PuzzleScenario } | { ok: false; error: PuzzleDecodeError } {
  const trimmed = code.trim()
  if (!trimmed.startsWith(PREFIX)) return { ok: false, error: 'bad-prefix' }
  let wire: Wire
  try {
    wire = JSON.parse(b64urlDecode(trimmed.slice(PREFIX.length))) as Wire
  } catch {
    return { ok: false, error: 'bad-payload' }
  }
  if (!wire?.p || !wire.s || wire.s.length !== 2) return { ok: false, error: 'bad-payload' }
  if (!HEROES_BY_ID[wire.p[0]] || !HEROES_BY_ID[wire.p[1]]) return { ok: false, error: 'unknown-hero' }
  try {
    const scenario: PuzzleScenario = {
      activePlayer: wire.t === 1 ? 1 : 0,
      players: [fromWireSide(wire.s[0]), fromWireSide(wire.s[1])],
    }
    // 空场空手的「残局」不是题 —— 它只会开局就无事可做
    if (scenario.players[0].board.length === 0 && scenario.players[0].hand.length === 0) {
      return { ok: false, error: 'empty-board' }
    }
    return { ok: true, heroes: wire.p, scenario }
  } catch {
    return { ok: false, error: 'unknown-card' }
  }
}

// 导入来的残局包成一道题。标题/提示是占位 —— 分享码里不带文案,
// 那是刻意的:码要短,而且**别人写的提示不该被当成官方题面**。
export function puzzleFromCode(
  heroes: [string, string],
  scenario: PuzzleScenario,
  zhTitle = '導入的殘局',
): LethalPuzzle {
  return {
    id: 'shared-puzzle',
    title: { zh: zhTitle, en: 'Imported Puzzle' },
    situation: { zh: '别人传给你的一道残局。', en: 'A position someone shared with you.' },
    hint: { zh: '没有提示 —— 分享码里不带文案。', en: 'No hint: shared codes carry no text.' },
    difficulty: 2,
    heroes,
    scenario,
  }
}

export function sharedPuzzleConfig(heroes: [string, string], scenario: PuzzleScenario): GameConfig {
  return {
    seed: 1,
    heroIds: heroes,
    deckIds: [[], []],
    first: scenario.activePlayer,
    heroPowers: [HEROES_BY_ID[heroes[0]]?.power, HEROES_BY_ID[heroes[1]]?.power],
    scenario,
  }
}
