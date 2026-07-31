import { useAchievements } from './achievementStore'
import { useBossRush } from './bossRushStore'
import { useCampaign } from './campaignStore'
import { useCollection } from './collectionStore'
import { useExpedition } from './expeditionStore'
import { useHistory } from './historyStore'
import { useTower } from './towerStore'
import { rankOf, toNextRank, warMerit } from '../content/ranks'

// 战功的**唯一**采集口。
//
// 【为什么非要收成一处】
// 从前有三个调用点各自拼参数(标题页、書房、设置页),于是出了两个真 bug:
//   1. 权重表里 ladderWins 与 arenaWins 各值 3 分,但**三处都没传** ——
//      联机和竞技场打到天荒地老,军衔纹丝不动;
//   2. 设置页只传了 3 个字段,算出来的军衔比标题页系统性偏低,
//      而**卡背解锁读的正是设置页那个数** —— 玩家会看到
//      「我已经是都尉了,但朱雀卡背还没解锁」。
// 参数表和权重表分开维护,就一定会漂。这里让它只有一个地方可能写错。
//
// 【为什么放在 app 层而不是 content/ranks.ts】
// ranks.ts 是纯内容(可被脚本与测试直接调),不该 import zustand store。
// 这一层负责「从 store 里取数」,算法仍在 ranks.ts。
export function useWarMerit(): { merit: number; rank: ReturnType<typeof rankOf>; next: ReturnType<typeof toNextRank> } {
  const casualWins = useCollection((s) => s.wins)
  const campaignCleared = useCampaign((s) => s.cleared.length)
  const trialsCleared = useCampaign((s) => s.trialsCleared.length)
  const historyCleared = useHistory((s) => s.cleared.length)
  const expeditionDepth = useExpedition((s) => s.bestDepth)
  const towerBest = useTower((s) => s.best)
  const bossRushBest = useBossRush((s) => s.best)
  // 天梯胜场早就在记了(成就的 onlineWins),只是从没接进战功
  const ladderWins = useAchievements((s) => s.stats.onlineWins ?? 0)
  // 竞技场此前只记「最佳胜场」(取最大),累计胜场是这次补的
  const arenaWins = useAchievements((s) => s.stats.arenaWinsTotal ?? 0)

  const merit = warMerit({
    casualWins,
    ladderWins,
    arenaWins,
    campaignCleared,
    trialsCleared,
    historyCleared,
    expeditionDepth,
    towerBest,
    bossRushBest,
  })
  return { merit, rank: rankOf(merit), next: toNextRank(merit) }
}
