import { expect, test } from '@playwright/test'
import { seedUnlockedProfile } from './unlocked'

// 远征选路:此前是「系统给你一个态势,接受它」—— 路本身没有分叉。
// 这条闸门钉住「选完牌之后会停在选路,选定才进下一关」。
test('远征:关间要先选一条路', async ({ page }) => {
  await seedUnlockedProfile(page)
  await page.addInitScript(() => {
    // 直接摆一个「刚打完第 1 关、已选宝物、正在选牌」的 run
    localStorage.setItem(
      'qiangu-expedition',
      JSON.stringify({
        state: {
          run: {
            heroId: 'liu-bei',
            deck: Array(30).fill('guan-yu'),
            stage: 0,
            relics: [],
            offered: null,
            cardOffer: ['guan-yu', 'zhang-fei', 'zhao-yun'],
            stageMod: null,
            routeOffer: null,
            rngState: 7,
          },
          bestDepth: 1,
          totalRuns: 1,
        },
        version: 0,
      }),
    )
  })
  await page.goto('/')
  await page.getByRole('button', { name: /远征逐鹿|Expedition/ }).click()
  await page.getByRole('button', { name: /不必扩军|Take none/ }).click()
  await expect(page.getByText(/前路有二|Two roads ahead/)).toBeVisible()
})
