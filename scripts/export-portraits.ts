// 立绘 CDN 导出管线:把「全卡池对应的全部立绘」从姊妹仓库
// ThreeKingdomMastersIOS(素材源头,只读)导到 `portraits-cdn/`(已 gitignore),
// 供上传到任意静态托管当立绘 CDN。
//
// 运行:npm run export-portraits(幂等,已存在且大小一致的文件跳过)
//
// 为什么要这一步:全池 2,250 张卡的立绘 400MB+,不可能随包。随包的只有签名卡
// (`public/portraits/`,~27MB,见 import-content.ts);其余卡在运行时按
// `VITE_PORTRAIT_CDN` 拼 URL 懒加载(见 src/ui/portraitSource.ts)。
import { copyFileSync, existsSync, mkdirSync, readdirSync, statSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { CARDS } from '../src/content/cards'
import { HEROES } from '../src/content/overrides/heroes'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = join(HERE, '..')
const SIBLING_PORTRAITS = join(ROOT, '..', 'ThreeKingdomMastersIOS', 'public', 'portraits')
const OUT = join(ROOT, 'portraits-cdn')

const SUFFIXES = ['.webp', '-full.webp'] as const

const mb = (bytes: number) => `${(bytes / 1024 / 1024).toFixed(1)} MB`

if (!existsSync(SIBLING_PORTRAITS)) {
  console.error(`✗ 找不到素材源头:${SIBLING_PORTRAITS}`)
  console.error('  需要姊妹仓库 ThreeKingdomMastersIOS 与本仓库同级。')
  process.exit(1)
}

// 卡池里所有可能需要立绘的 id(武将 + 主公;锦囊/装备没有立绘)
const ids = [
  ...new Set([...CARDS.filter((c) => c.type === 'general').map((c) => c.id), ...HEROES.map((h) => h.id)]),
].sort()

mkdirSync(OUT, { recursive: true })

let copied = 0
let skipped = 0
let bytes = 0
const missing: string[] = []

for (const id of ids) {
  let any = false
  for (const suffix of SUFFIXES) {
    const name = `${id}${suffix}`
    const src = join(SIBLING_PORTRAITS, name)
    if (!existsSync(src)) continue
    any = true
    const dest = join(OUT, name)
    const srcSize = statSync(src).size
    if (existsSync(dest) && statSync(dest).size === srcSize) {
      skipped++
    } else {
      copyFileSync(src, dest)
      copied++
    }
    bytes += srcSize
  }
  if (!any) missing.push(id)
}

// 目录里可能残留上一次导出的多余文件(卡池缩减时),提示但不擅自删除
const onDisk = readdirSync(OUT).filter((f) => f.endsWith('.webp'))
const wanted = new Set(ids.flatMap((id) => SUFFIXES.map((s) => `${id}${s}`)))
const stale = onDisk.filter((f) => !wanted.has(f))

console.log('')
console.log(`卡池武将 + 主公:${ids.length} 个 id`)
console.log(`导出立绘:${onDisk.length - stale.length} 个文件(新复制 ${copied},已是最新 ${skipped}),共 ${mb(bytes)}`)
if (missing.length > 0) {
  console.log(`⚠ 源头无立绘的 id:${missing.length} 个(这些卡仍走拓印兜底)`)
  console.log(`  例:${missing.slice(0, 8).join(', ')}${missing.length > 8 ? ' …' : ''}`)
}
if (stale.length > 0) {
  console.log(`⚠ 目录里有 ${stale.length} 个不在当前卡池的旧文件,可手动清理`)
}

console.log(`
────────────────────────────────────────────────────────
上传说明(把 portraits-cdn/ 当成一个纯静态目录发出去即可)
────────────────────────────────────────────────────────

产物:${OUT}
      扁平结构,文件名就是 <卡 id>.webp / <卡 id>-full.webp
      已在 .gitignore 里 —— ${mb(bytes)} 绝不能进 git。

1) 传到任意静态托管,几个现成选项:
   · Vercel(单独一个项目,别混进主站)
       cd portraits-cdn && vercel deploy --prod
   · Cloudflare R2 / 任意 S3 兼容对象存储 + 公开访问
       rclone sync portraits-cdn/ r2:qiangu-portraits --transfers 16
   · Cloudflare Pages
       npx wrangler pages deploy portraits-cdn --project-name qiangu-portraits

2) 托管侧必须满足两条:
   · CORS:回 \`Access-Control-Allow-Origin: *\`
     —— 否则「保存卡面」会因 canvas 被污染而失败(纯展示不受影响)。
   · 长缓存:\`Cache-Control: public, max-age=31536000, immutable\`
     —— 文件名即内容标识,不会变。

3) 在主站构建环境里配基址(结尾带不带 / 都行):
       VITE_PORTRAIT_CDN=https://<你的域名>/
   Vercel:项目 Settings → Environment Variables 加这一条,重新部署。
   本地试跑:
       npx serve portraits-cdn -l 5186 --cors
       VITE_PORTRAIT_CDN=http://localhost:5186 npm run dev

   不配这个变量时,非签名卡直接走拓印兜底,一个请求都不发 —— 行为与从前一致。
`)
