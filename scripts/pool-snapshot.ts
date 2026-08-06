// 重新生成卡池快照。运行:npm run pool-snapshot
//
// 这**不是**闸门(闸门是 src/content/poolSnapshot.test.ts,`npm test` 里跑)。
// 这里是「我确实改了卡池,把快照更新一下」的那一步。
//
// 更新完**务必把 pool-snapshot.json 的 diff 一起提交** —— 那份 diff 就是
// 这次改了哪些卡的清单,评审时看的正是它。悄悄更新快照等于把闸门关掉。
import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { poolDigests } from '../src/content/poolSnapshot'

// Windows 下 `new URL(...).pathname` 会给出 `/C:/…`,fs 读不了 —— 走 fileURLToPath。
const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'content', 'pool-snapshot.json')

const digests = poolDigests()
writeFileSync(OUT, JSON.stringify(digests, null, 1) + '\n')
console.log(
  `已写出 ${Object.keys(digests).length} 张的卡池快照 → src/content/pool-snapshot.json\n` +
    `记得把它的 diff 一起提交 —— 那份 diff 就是这次的改动清单。`,
)
