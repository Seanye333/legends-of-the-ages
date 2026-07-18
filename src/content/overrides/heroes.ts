import type { HeroDef } from '../../engine/types'
import { START_HP } from '../../engine/types'

// 六主义主公。Phase 0 先立两位跑通流程,Phase 1 补齐六位。
export const HEROES: HeroDef[] = [
  { id: 'liu-bei', name: { zh: '劉備', en: 'Liu Bei' }, doctrine: 'royal', hp: START_HP },
  { id: 'cao-cao', name: { zh: '曹操', en: 'Cao Cao' }, doctrine: 'hegemonic', hp: START_HP },
]

export const HEROES_BY_ID: Record<string, HeroDef> = Object.fromEntries(
  HEROES.map((h) => [h.id, h]),
)
