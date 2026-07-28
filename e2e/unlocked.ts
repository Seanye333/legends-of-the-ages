import type { Page } from '@playwright/test'

// 端到端用的「老玩家档」。
//
// 标题页的深度模式(谜题/乱斗/登楼/远征/校场)现在按进度渐进解锁
// (见 src/content/unlocks.ts)—— 而 e2e 每次都是全新 profile,
// 于是这些入口在测试里默认是灰的、点不动。
//
// 两种做法里选了播种而不是「测试里绕过解锁」:
// 绕过意味着测试跑的是一条玩家永远走不到的代码路径,
// 而播种跑的就是真实老玩家看到的那个界面。
//
// 播的量刻意给足(通关 12 关、打过 30 局),这样以后调门槛不用回来改测试;
// 真正钉住门槛数值的是 src/content/unlocks.test.ts,不是这里。
export async function seedUnlockedProfile(page: Page): Promise<void> {
  await page.addInitScript(() => {
    // **必须是合并写入,不能覆盖。**
    // addInitScript 在**每一次导航**上都会重跑,包括测试中途的 page.reload() ——
    // 而有些用例正是靠「evaluate 改 localStorage → reload」来注入自己的前置条件的
    // (校场那条注入 500 功勋)。直接 setItem 会把那份注入冲掉,
    // 表现为「报名参战按钮永远不出现」,而且看不出和解锁有什么关系。
    // 实测踩过一次,记在这儿。
    const merge = (key: string, patch: Record<string, unknown>) => {
      let box: { state?: Record<string, unknown>; version?: number } = {}
      try {
        box = JSON.parse(localStorage.getItem(key) ?? '{}')
      } catch {
        box = {}
      }
      // 已经有的字段优先保留;这里只补「缺的那几个」
      box.state = { ...patch, ...(box.state ?? {}) }
      box.version = box.version ?? 0
      localStorage.setItem(key, JSON.stringify(box))
    }
    merge('qiangu-campaign', {
      cleared: Array.from({ length: 12 }, (_, i) => `seed-boss-${i}`),
      trialsCleared: [],
      active: null,
      activeTrial: false,
    })
    merge('qiangu-collection', { wins: 20, losses: 10 })
  })
}
