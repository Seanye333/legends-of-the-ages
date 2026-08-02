import { readFileSync } from 'node:fs'
import { execSync } from 'node:child_process'
import { LESSONS } from '../src/content/lessons'

// 讲堂实练里出现的所有 defId(场上 + 手牌 + 敌方)
const ids = new Set<string>()
for (const l of LESSONS) {
  for (const side of l.scenario.players) {
    for (const u of side.board) ids.add(u.defId)
    for (const h of side.hand) ids.add(h)
  }
}
// 从 git HEAD 的 cards.gen 里读它们**改动前**的身材
const old = execSync('git show HEAD:src/content/generated/cards.gen.ts', { encoding: 'utf8', maxBuffer: 1 << 28 })
const pins: Record<string, { attack: number; health: number }> = {}
for (const id of ids) {
  const m = old.match(new RegExp(`"id":"${id}"[^}]*?"attack":(\\\\d+),"health":(\\\\d+)`))
  if (m) pins[id] = { attack: Number(m[1]), health: Number(m[2]) }
}
console.log(`讲堂实练用到 ${ids.size} 张卡,其中生成卡 ${Object.keys(pins).length} 张`)
console.log(JSON.stringify(pins, null, 2))
void readFileSync
