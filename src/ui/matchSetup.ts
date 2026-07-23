import { useMatch, type StartMatchArgs } from '../app/matchStore'

// 记录最近一次开局参数,供「再来一局」复用(换新种子)。
let lastArgs: StartMatchArgs | null = null

export function launchMatch(args: StartMatchArgs): void {
  lastArgs = args
  useMatch.getState().startMatch(args)
}

export function rematch(): boolean {
  if (!lastArgs) return false
  const store = useMatch.getState()
  store.reset()
  store.startMatch({ heroIds: lastArgs.heroIds, deckIds: lastArgs.deckIds })
  return true
}

// 原样重开上一次开局(保留残局/谜题配置)—— 斩杀谜题的「重试」用它,
// 不能走 rematch:那个只带 heroIds/deckIds,会把 scenario/puzzle 丢掉。
export function retryLast(): boolean {
  if (!lastArgs) return false
  useMatch.getState().startMatch(lastArgs)
  return true
}
