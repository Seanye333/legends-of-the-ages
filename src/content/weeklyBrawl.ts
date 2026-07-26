// 每周乱斗:十条乱斗规则从「固定列表」改成**按周轮换**的当值规则,首胜给功勋。
// 静态功能 → 每周回访仪式,成本极低(零引擎、零新内容)。
//
// 与每日谜题同一套做法:按周的确定性哈希取模,同一周全体玩家同一条规则。
import { BRAWLS } from './brawls'

// 本地日期 → ISO 周键 "YYYY-Www"(周一为一周之始)。应用层允许非确定性;测试传固定值。
export function weekKey(now = new Date()): string {
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  // ISO:把日期挪到本周四,用它所在年份与周序(避开跨年周的歧义)
  const day = (d.getDay() + 6) % 7 // 周一=0
  d.setDate(d.getDate() - day + 3)
  const isoYear = d.getFullYear()
  const firstThursday = new Date(isoYear, 0, 4)
  const fday = (firstThursday.getDay() + 6) % 7
  firstThursday.setDate(firstThursday.getDate() - fday + 3)
  const week = 1 + Math.round((d.getTime() - firstThursday.getTime()) / (7 * 86_400_000))
  return `${isoYear}-W${String(week).padStart(2, '0')}`
}

// 周键 → 当值乱斗下标(确定性,FNV-1a 取模)
export function weeklyBrawlIndexFor(key: string): number {
  if (BRAWLS.length === 0) return 0
  let h = 2166136261
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return Math.abs(h >>> 0) % BRAWLS.length
}

// 周键 → 当值乱斗
export function weeklyBrawlFor(key: string) {
  return BRAWLS[weeklyBrawlIndexFor(key)] ?? null
}

// 本周首胜奖励(功勋)。给得克制:乱斗是图一乐,不该成为刷功勋的农场。
export const WEEKLY_BRAWL_MERIT = 80
