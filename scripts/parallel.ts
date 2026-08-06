// 模拟并行化的公共外壳 —— 一个**保序**的 worker 池。
//
// 【为什么值得做】
// 所有平衡模拟原本都是单线程的:sim-campaign 12 分钟、sim-cards 扫 400 张 52 分钟,
// 而开发机普遍是 8–16 核。这不是「跑得慢一点」的问题,它改变的是**能不能做**:
//   · 闸门要十二分钟,就进不了 pre-commit,只能等 CI
//   · 扫全池要一小时,就没人会顺手扫一次
//   · 样本量想开到 2000 局,得先掂量一下要不要等一晚上
// 而这个仓库这一轮踩的坑,一大半根子都在「样本量不够又懒得加」。
//
// 【为什么并行不会破坏确定性】
// 这些模拟的每一局都由**索引**决定种子(`boss * 7919 + g * 31 + 1` 这类),
// 局与局之间没有任何共享状态 —— engine 是纯函数、RNG 走 GameState 显式传递(铁律 1)。
// 所以「谁先算完」不影响任何一局的结果,只要**按索引把结果装回去**就逐位一致。
// 这一点每个接入点都必须实测验证:并行前后输出逐格相同,不同就是接错了。
//
// 【为什么是 worker 池而不是「一任务一 worker」】
// 每个 worker 都要 import 一遍卡池(2,434 张)与引擎,约一两秒。
// 一任务一 worker 的话这笔开销要付几百次;池化之后只付 K 次。
import { Worker, isMainThread, parentPort } from 'node:worker_threads'
import { cpus } from 'node:os'

/**
 * 默认并发数。
 *
 * 【为什么不是简单的「核数 − 2」】
 * 留两个核给系统与主线程,在开发机上是对的(跑十分钟模拟时机器还能用)。
 * 但 CI runner 普遍只有 2–4 核 —— `2 - 2 = 0` → 夹到 1,**整个并行化在 CI 上等于没有**,
 * 而 CI 恰恰是这些闸门唯一每次都跑的地方。
 *
 * 所以分档:小机器(≤4 核)全用上,主线程本来就只是在等 worker 回消息、几乎不占 CPU;
 * 大机器才留两个核。上限 16 —— 再多的话 worker 启动开销(每个都要 import 一遍卡池)
 * 会吃掉收益。
 */
export function defaultConcurrency(): number {
  const cores = cpus().length
  return Math.max(1, Math.min(16, cores <= 4 ? cores : cores - 2))
}

interface Envelope {
  i: number
  task: unknown
}
interface Reply {
  i: number
  result?: unknown
  error?: string
}

/**
 * 把 tasks 丢给 workerFile 跑,**按输入顺序**返回结果。
 *
 * @param workerFile worker 模块的绝对路径(用 `fileURLToPath(new URL(...))` 拿)
 * @param onDone     每完成一个任务回调一次,用来打进度点
 */
export async function parallelMap<T, R>(
  workerFile: string,
  tasks: T[],
  onDone?: (finished: number, total: number) => void,
  concurrency = defaultConcurrency(),
): Promise<R[]> {
  if (tasks.length === 0) return []
  const k = Math.max(1, Math.min(concurrency, tasks.length))
  const results = new Array<R>(tasks.length)
  let next = 0
  let finished = 0

  await new Promise<void>((resolve, reject) => {
    let alive = k
    let failed: Error | null = null
    const workers: Worker[] = []

    const shutdown = () => {
      for (const w of workers) void w.terminate()
    }

    for (let n = 0; n < k; n++) {
      // tsx 的 loader 在 worker 里也得挂,否则拿到的是未编译的 TS
      const w = new Worker(workerFile, { execArgv: ['--import', 'tsx'] })
      workers.push(w)

      const feed = () => {
        if (next >= tasks.length) {
          void w.terminate()
          if (--alive === 0) {
            if (failed) reject(failed)
            else resolve()
          }
          return
        }
        const i = next++
        w.postMessage({ i, task: tasks[i] } satisfies Envelope)
      }

      w.on('message', (m: Reply) => {
        if (m.error) {
          failed ??= new Error(`worker 任务 ${m.i} 失败: ${m.error}`)
          shutdown()
          reject(failed)
          return
        }
        results[m.i] = m.result as R
        onDone?.(++finished, tasks.length)
        feed()
      })
      w.on('error', (e: Error) => {
        failed ??= e
        shutdown()
        reject(e)
      })
      feed()
    }
  })

  return results
}

/**
 * 现成的进度回调。**只在真终端里用 `\r` 原地刷新** ——
 * CI 与管道里 `\r` 不起作用,一百多个任务就是一百多行日志,把真正该看的结果冲掉。
 * 非终端环境下改成完成时打一行。
 */
export function progress(label: string): (done: number, total: number) => void {
  const tty = process.stdout.isTTY
  return (done, total) => {
    if (tty) {
      process.stdout.write(`\r  ${done}/${total} ${label}`)
      if (done === total) process.stdout.write('\r' + ' '.repeat(30) + '\r')
    } else if (done === total) {
      console.log(`  ${total} ${label} 跑完`)
    }
  }
}

/**
 * worker 那一侧:把一个纯函数接上消息循环。
 * 约定 `fn` 必须是**纯**的 —— 它跑在哪个线程、什么顺序,结果都必须一样。
 */
export function serveTasks<T, R>(fn: (task: T) => R): void {
  if (isMainThread) throw new Error('serveTasks 只能在 worker 里调用')
  parentPort!.on('message', (m: Envelope) => {
    try {
      parentPort!.postMessage({ i: m.i, result: fn(m.task as T) } satisfies Reply)
    } catch (e) {
      parentPort!.postMessage({ i: m.i, error: (e as Error).message } satisfies Reply)
    }
  })
}
