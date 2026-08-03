import { BIOGRAPHIES } from '../../ThreeKingdomMastersIOS/src/game/data/biographies'
import { LORE } from '../src/content/generated/lore.gen'
const bios = Object.entries(BIOGRAPHIES).filter(([id]) => LORE[id])
// 1) 官职最高位
const OFFICE = /(?:位至|官至|累(?:官|遷)至|終於|拜為|拜|遷|封)([一-龥]{2,6}(?:將軍|太守|刺史|尚書|司徒|司空|太尉|丞相|都督|中郎將|校尉|令|相|王|公|侯|卿))/
let n1 = 0; const e1: string[] = []
for (const [id, b] of bios) { const m = b.zh.match(OFFICE); if (m) { n1++; if (e1.length < 12) e1.push(`${id}: ${m[1]}  ←「${b.zh.slice(Math.max(0,b.zh.indexOf(m[0])-6), b.zh.indexOf(m[0])+m[0].length+2)}」`) } }
console.log(`官职:${n1} 条 (${(n1/bios.length*100).toFixed(1)}%)`)
for (const e of e1) console.log('   ' + e)
// 2) 师承
const TEACH = /(?:師事|受業於|從.{1,4}學|門下|弟子|授業|師從)/
let n2 = 0; const e2: string[] = []
for (const [id, b] of bios) { const m = b.zh.match(TEACH); if (m) { n2++; if (e2.length < 12) e2.push(`${id}: ${b.zh.slice(Math.max(0,b.zh.indexOf(m[0])-8), b.zh.indexOf(m[0])+12)}`) } }
console.log(`\n师承:${n2} 条 (${(n2/bios.length*100).toFixed(1)}%)`)
for (const e of e2) console.log('   ' + e)
// 3) 战役名
const WAR = /(官渡|赤壁|夷陵|街亭|定軍山|長平|馬陵|鉅鹿|垓下|昆陽|淝水|漠北|白登|安史|郾城|采石|釣魚城|崖山|土木|薩爾滸|山海關|鄱陽)/g
const tally = new Map<string, number>()
for (const [, b] of bios) for (const m of b.zh.matchAll(WAR)) tally.set(m[1], (tally.get(m[1]) ?? 0) + 1)
console.log(`\n战役点名:` + [...tally.entries()].sort((a,b)=>b[1]-a[1]).map(([k,v])=>`${k}${v}`).join(' '))
