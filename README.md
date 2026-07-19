# 千古名将 · Legends of the Ages

全朝代名将卡牌对战(炉石类 1v1 CCG)。~2,226 张卡横跨 18 个朝代阵营:三国名将与孙武、项羽、韩信、李世民、岳飞同台竞技。六大主义为职业(王道/霸道/礼教/名利/割据/隐逸),朝代为羁绊,签名机制「单挑」。

Web + iOS (Tauri 2)。卡牌数据与立绘来自姊妹项目 [ThreeKingdomMastersIOS](../ThreeKingdomMastersIOS)(素材源头,脚本导入)。

## 快速开始

```bash
npm install
npm run import-content   # 从姊妹仓库生成全卡池 + 复制立绘(输出已入 git,可跳过)
npm run dev              # http://localhost:5174
```

iOS 模拟器:`xcrun simctl boot 'iPhone 17 Pro' && npx tauri ios dev 'iPhone 17 Pro'`

## 命令

| 命令 | 作用 |
|---|---|
| `npm run dev` | 开发服务器(5174) |
| `npm run build` | 类型检查(app+test)+ 构建 |
| `npm test` | Vitest(引擎/内容/AI/收集 66 测试) |
| `npx playwright test` | 浏览器冒烟(对局全流程/图鉴/构筑/开包) |
| `npm run import-content` | 重新生成卡池与素材 |
| `npm run sim-balance` | 预组 AI 互搏胜率矩阵(GAMES=N 控制局数) |

## 架构

- `src/engine/` — 纯确定性规则引擎(种子 RNG、命令/事件、回放、视角裁剪),零依赖,为服务端权威对战设计
- `src/content/` — 生成层(公式)⊕ 手工层(签名卡/锦囊/主公/预组)
- `src/ai/` — 贪心模拟评分 AI
- `src/app/` — Zustand stores、LocalMatch transport、收集系统、排行榜客户端
- `src/ui/` — React 界面(事件时间轴动效 + Web Audio 合成音效)
- `api/` — Vercel serverless 每日胜场榜(KV 未配置时优雅降级)
- `server/` — 联机对战服务器(Cloudflare Workers + Durable Objects):QueueDO 匹配、MatchDO 权威对局(同一个 `applyCommand` 校验每条命令,客户端只收 redact 后的视角状态)

## 联机对战

```bash
cd server && npx wrangler dev          # 本地服务器 localhost:8787
node --import tsx server/drive-test.ts # 双 AI 客户端端到端验证
```

游戏内:标题页「联机对战」→ 填服务器地址 → 开始匹配。部署:`cd server && npx wrangler deploy`(需 Cloudflare 账号,免费档即可),客户端填 `wss://qiangu-server.<你的子域>.workers.dev`。

详细约定见 [CLAUDE.md](CLAUDE.md);完整设计方案见 `~/.claude/plans/14-groovy-flame.md`。

## 部署

- **Web**:Vercel 导入本仓库即可(`vercel.json` 就绪);要开全球排行榜,在 Vercel 项目加 KV/Upstash 集成,零代码改动
- **iOS TestFlight**:App Store Connect 建记录(`com.seanye.qiangulegends`)→ Xcode 打开 `src-tauri/gen/apple/app.xcodeproj` 设签名 Team → `npx tauri ios build --export-method app-store-connect`
