import { PROTOCOL_VERSION } from '../../src/app/protocol'

// 协议版本闸门。
//
// 客户端是 PWA,Service Worker 会把旧构建缓存住 —— 玩家可能连着好几天跑旧代码。
// 服务端一改消息结构,旧客户端不会报错,而是**静默地按旧字段解析新消息**,
// 表现为「牌打不出去」「状态对不上」这类没法归因的诡异 bug。
//
// 所以宁可明确拒绝:版本不够就回一条 `protocol-outdated`,UI 直接请玩家刷新。
//
// MIN_CLIENT_VERSION 是**服务端还愿意伺候的最低客户端版本**。
// 改协议时:bump src/app/protocol.ts 的 PROTOCOL_VERSION,
// 然后决定这次改动是否破坏兼容 —— 破坏就把 MIN 一起抬上来。
export const MIN_CLIENT_VERSION = 1

// 缺省视为 0:版本机制上线之前的客户端根本不会带这个字段
export function clientVersionOf(v: unknown): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : 0
}

export function isSupported(v: unknown): boolean {
  return clientVersionOf(v) >= MIN_CLIENT_VERSION
}

// 给客户端的说明:告诉它服务端要什么版本、自己是什么版本,便于排查
export function outdatedError(v: unknown): string {
  return `protocol-outdated:${clientVersionOf(v)}<${MIN_CLIENT_VERSION}`
}

// 服务端当前实现的版本,用于 /health 自检与部署核对
export const SERVER_PROTOCOL_VERSION = PROTOCOL_VERSION
