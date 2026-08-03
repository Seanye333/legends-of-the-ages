import { BIOGRAPHIES } from '../../ThreeKingdomMastersIOS/src/game/data/biographies'
import { LORE } from '../src/content/generated/lore.gen'
const bios = Object.entries(BIOGRAPHIES).filter(([id]) => LORE[id])
// 官职:只认「位至/官至/累遷至」这三种**明说最高位**的写法,不认「封X侯」(那是爵位)
const OFFICE = /(?:位至|官至|累官至|累遷至|終至|後至)([一-龥]{2,7})[,,。;;]/
// 爵位:封/追封/進封 + X王/公/侯
const TITLE = /(?:封|追封|進封|襲封)([一-龥]{1,4}(?:王|公|侯))[,,。;;]/
let o = 0, tt = 0, both = 0
const eo: string[] = [], et: string[] = []
for (const [id, b] of bios) {
  const m1 = b.zh.match(OFFICE), m2 = b.zh.match(TITLE)
  if (m1) { o++; if (eo.length < 14) eo.push(`${id}: ${m1[1]}`) }
  if (m2) { tt++; if (et.length < 14) et.push(`${id}: ${m2[1]}`) }
  if (m1 && m2) both++
}
console.log(`官职 ${o} (${(o/bios.length*100).toFixed(1)}%) · 爵位 ${tt} (${(tt/bios.length*100).toFixed(1)}%) · 两者都有 ${both}`)
console.log('官职:', eo.join(' · '))
console.log('爵位:', et.join(' · '))
