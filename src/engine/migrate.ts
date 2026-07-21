// 存档迁移:把**旧版本引擎写下的 GameState** 补成当前引擎能跑的形状。
//
// 为什么必须有这一层:GameState 会被持久化在两个地方 ——
// 服务端 Durable Object 的 `game` 键(一局打到一半服务端就部署了)、
// 以及客户端的战报回放。给 PlayerState 加一个**必填**字段,
// 这两处的旧数据立刻就是非法状态:第四卡包上线时 drive-test 就是这么炸的,
// redactState 在 `opp.secrets.map` 上抛 TypeError,整局广播中断。
//
// 原则:**只补,不改**。迁移只负责给缺失字段填上「什么都没发生」的默认值,
// 不试图推断旧局面里的语义 —— 推断出来的东西比缺字段更难查。
import type { GameState } from './types'

// 传入可能来自旧版本的对象,返回补全后的 GameState。
// 就地补全(不复制):调用点都是刚从存储里反序列化出来的对象,没有别人持有它。
export function migrateState(raw: GameState): GameState {
  for (const p of raw.players) {
    // ---- 第四卡包 ----
    p.secrets ??= []
    p.overloadNext ??= 0
    p.overloadLocked ??= 0
    p.cardsPlayedThisTurn ??= 0
  }
  return raw
}
