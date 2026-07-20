// 结构化日志。
//
// 此前服务端**每一条错误路径都是静默 `catch {}`** —— 天梯上报失败、
// 广播失败、闹钟处理抛异常,线上全都看不见。Cloudflare 的 Logs / Tail
// 只能看到 console 输出,所以「不打日志」等于「没有可观测性」。
//
// 两条原则:
// 1. **打 JSON,不打人话。** Workers 日志是给机器过滤的,一行一个对象才好按
//    `evt` / `do` 聚合。人话留给 msg 字段。
// 2. **日志绝不改变控制流。** 所有调用点仍然吞掉异常 —— 天梯挂了不该让对局崩掉。
//    日志只是让「我们决定忽略它」这件事变得可见。

type Level = 'info' | 'warn' | 'error'

export interface LogFields {
  // 事件名,做聚合用(如 'ratings.report.failed')
  evt: string
  [k: string]: unknown
}

function emit(level: Level, fields: LogFields): void {
  try {
    const line = JSON.stringify({ level, ts: Date.now(), ...fields })
    if (level === 'error') console.error(line)
    else if (level === 'warn') console.warn(line)
    else console.log(line)
  } catch {
    // 日志本身绝不能成为新的故障源
  }
}

export const log = {
  info: (fields: LogFields) => emit('info', fields),
  warn: (fields: LogFields) => emit('warn', fields),
  // 把 unknown 的异常压成可读字段;Error 之外的抛出物(字符串等)也接住
  error: (fields: LogFields, err?: unknown) =>
    emit('error', {
      ...fields,
      err: err instanceof Error ? err.message : err === undefined ? undefined : String(err),
      stack: err instanceof Error ? err.stack?.split('\n').slice(0, 3).join(' | ') : undefined,
    }),
}
