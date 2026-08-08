import { test, expect } from '@playwright/test'

// 新兵之路。缺的从来不是内容,是顺序 —— 教学、讲堂、实练、六套预组、构筑器
// 全都做好了,而它们互相不知道对方存在:教学打完之后没有任何东西说下一步该干嘛。
//
// 两条判据各钉一头:**婉拒教程之后它才出现**(和教程邀请的第一句话是同一句,
// 并排放就是把注意力劈成两半),以及**四步做完就整块收起来**
// —— 老玩家的首屏不该冒出一张任务清单。

test('新兵之路:婉拒教程之后四步都在', async ({ page }) => {
  await page.goto('/')
  // 教程邀请还挂着时这条路不显示 —— 它俩的第一句话是同一句
  await expect(page.getByText('新兵之路')).toHaveCount(0)
  await page.getByRole('button', { name: '不必' }).click()
  await expect(page.getByText('新兵之路')).toBeVisible()
  await expect(page.getByText('用预组打一局')).toBeVisible()
  await expect(page.getByText('组一副自己的牌')).toBeVisible()
  await page.screenshot({ path: 'C:/Users/seany/AppData/Local/Temp/claude/c--Users-seany-Documents-All-Codes-legends-of-the-ages/5c533a0d-5067-43d0-a72b-b0a89964da43/scratchpad/onboard.png' })
})

test('四步做完就收起来 —— 老玩家的首屏不该冒出一张任务清单', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('qiangu-tutorial-done', '1')
    localStorage.setItem('qiangu-collection', JSON.stringify({ state: { owned: {}, packs: 0, merit: 0, wins: 9, losses: 2, customDecks: [{ name: { zh: 'x', en: 'x' }, heroId: 'liu-bei', cardIds: [] }], collectionClaimed: [] }, version: 0 }))
    localStorage.setItem('qiangu-achievements', JSON.stringify({ state: { stats: { lessonsDone: 3 }, claimed: [] }, version: 0 }))
  })
  await page.goto('/')
  await expect(page.getByText('新兵之路')).toHaveCount(0)
})
