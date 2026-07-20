# 千古名将 · 工程约定与架构铁律

炉石类 1v1 对战 CCG,全朝代名将卡池(2,250 张 = 2,211 武将 + 23 锦囊 + 16 装备,数据来自姊妹仓库)。目标平台:Web + iOS (Tauri 2)。
完整设计方案见项目笔记(未入库)。

## 命令

- `npm run dev` — 开发服务器,端口 **5174**(5173 留给姊妹项目)
- `npm run build` — **类型检查 + 构建**(不要单独跑 `tsc --noEmit`;Vercel 对未使用 import 报错)
- `npm test` — Vitest(引擎测试在 `src/engine/*.test.ts`)
- `npx playwright test` — 浏览器端到端(对局/图鉴/构筑/开包/教程/军令/回放)
- `npm run import-content` — 从姊妹仓库重新生成卡池 + 签名卡立绘 + 列传台词(幂等)
- `npm run sim-balance` — 六套预组互搏胜率矩阵 + 两道平衡闸门(默认 100 局/对 ≈30 秒;`GAMES=40` 只配试探,**下结论别用**:40 局噪声达 ±8 个百分点)
- `npm run deck-stats` — 预组体检(曲线/身材/守护/抢攻/解场并列),调平衡时先看它再动手

## 架构铁律

1. **引擎纯度**(`src/engine/`):纯函数、确定性、可序列化。禁止 `Date`/`Math.random`/`performance`/React/zustand/任何引擎外 import。随机数只走 `rng.ts` 种子 RNG,状态经 `GameState.rng` 显式传递。ESLint 围栏 + `purity.test.ts` 双重把守。这是 Phase 3 服务端权威对战的生命线。
2. **内容生成**:`src/content/generated/cards.gen.ts` 由脚本生成,**禁止手改**(但要入 git,构建不依赖姊妹仓库)。手工调校一律写进 `src/content/overrides/signature.ts`。
3. **素材源头**:`/Users/sean/Developer/ThreeKingdomMastersIOS` 只读。武将数据、立绘、主义推导(`deriveDoctrine`)都从那边导入。
4. **效果是数据**:卡牌效果用 `EffectScript` DSL(`src/engine/types.ts`),不写闭包。某张卡需要新操作码 → 进下个卡包,不为单卡改引擎。现有 11 个操作码(第二卡包新增 `gainArmor`/`returnToHand`/`discardRandom`)。
5. **事件驱动 UI**:UI 动画只消费 `applyCommand` 返回的事件流,不做状态 diff。新增 `GameEvent` 变体后要同步 `eventText.ts`(战报文案)与 `floats.ts`/`useEventAnimations.ts`(动效),否则事件在 UI 里静默丢失。
6. **改签名卡数值必跑 `sim-balance`**:两道闸门 —— 每套预组总胜率 40–60%,且**任一对位 30–70%**。只看总胜率会漏掉「六套互相克制、各自都是 50%」的猜拳局面,那种牌局胜负在选卡组时就定了。教训:把张仲景从 2 费挪到 3 费,隐逸预组掉了 14 个百分点 —— 单卡看着「在曲线上」,卡组曲线却塌了。治疗/护甲类效果在贪心 AI 评分里近乎为零,带这类战吼的卡身材要按满曲线给。

## 结构

- `src/engine/` — 规则引擎(types/rng/init/reducer/legal;Phase 1 加 combat/effects/redact/replay)
- `src/content/` — 卡池(generated 生成层 ⊕ overrides 手工层 → cards.ts 合并)
- `src/app/` — Zustand stores、transport(Phase 1)
- `src/ui/` — React 层(screens/components/i18n)
- `scripts/` — 导入管线、平衡模拟(Phase 1)

## iOS (Tauri 2)

- 模拟器运行:先 `xcrun simctl boot <设备>`(关机状态部署会 149 报错),再 `npx tauri ios dev 'iPhone 17 Pro'`
- CocoaPods **不需要**:Podfile 为空、工程零 Pods 引用;`tauri ios init` 会因缺 pod 报错,但 Xcode 工程已在 gen/apple 复刻好,勿删
- `vendor/wry` 是 iOS 26 启动崩溃补丁,tauri 升级需重测;`package.json` 里 `"tauri": "tauri"` 脚本是 Xcode 构建脚本的依赖,勿删
- 图标源图 `assets/logo.svg`(朱砂印 +「將」+ 鎏金边);改设计后跑 `node scripts/make-logo.mjs` 重出位图,再 `npx tauri icon assets/logo-1024.png`。同一脚本顺带出 `public/` 的 favicon / apple-touch-icon
- TestFlight:App Store Connect 建记录(bundle id `com.seanye.qiangulegends`)→ Xcode 设一次签名 Team → `npx tauri ios build --export-method app-store-connect`

## 联机(Phase 3)

- `server/` 是 Cloudflare Workers + DO;`npx wrangler dev`(server 目录)本地起服,无需登录。**别把 wrangler 的输出接管道**(`| head` 之类),写满就 SIGPIPE 把它杀了
- 五个 DO:`QueueDO`(分段匹配)/ `MatchDO`(权威对局)/ `RoomDO`(房间码)/ `RatingsDO`(ELO)/ `ProfileDO`(存档同步)
- 服务器直接打包 `src/engine` 与 `src/content`(零依赖纯 TS);引擎改动天然同步两端
- 客户端 `src/app/remoteMatch.ts` 负责座位翻转(UI 恒定我=0)与裁剪态重建;MatchScreen 对本地/联机无感知
- **全部 DO 走 WebSocket Hibernation**:不能用 `server.accept()`,要 `ctx.acceptWebSocket()` + `webSocketMessage/Close` 处理器。代价是内存态随时会没 —— 每个入口先 `load()`,座位归属放 `serializeAttachment`,报名信息必须落盘(两人 join 之间可能被驱逐)
- `MatchDO`/`RoomDO` 都设了 alarm 自毁,弃坑对局不会永久占 storage
- 端到端验证:`node --import tsx server/drive-test.ts`(需先起服)—— 天梯匹配 + 完整对局 + 非法命令拒绝 + 闪断重连 + ELO 结算 + 房间码流 + 存档同步版本冲突
- server/*.ts 不在 tsc 项目内(wrangler esbuild 打包),改协议时跑 drive-test 兜底

## 存档同步(`src/app/profileSync.ts`)

- **本地优先**:读写照旧走 localStorage,云端只是镜像。没配服务器/断网/没部署一律静默降级,绝不阻塞操作 —— 任何网络异常都不该冒泡到 UI
- 单调 `version` + 后写覆盖;服务器拒收低版本并回传自己那份,客户端据此对齐
- **这不是反作弊**:客户端仍能上传任意数据。真要防作弊得把卡包发放搬到服务器(联机胜负已由 MatchDO 权威判定,是现成的落点)
- 加了会变的存档字段,记得同步 `ProfileData` 与 `snapshot()`/`adopt()` 两侧

## 包体红线

签名卡立绘随包(`public/portraits/`,~27MB),其余走 CDN 懒加载。`npm run import-content` 会打印立绘总大小,超 **150MB** 必须缩签名集。

取图三层在 `src/ui/portraitSource.ts` 收口(**所有取立绘 URL 的地方都走 `portraitCandidates()`,不要再手拼路径**):随包 → `VITE_PORTRAIT_CDN`(可选)→ 拓印兜底。判断「本地有没有」读的是 `manifest.json`,所以不会对不存在的文件发请求;`VITE_PORTRAIT_CDN` 未配置时非签名卡一个请求都不发。CDN 产物用 `npm run export-portraits` 生成(439MB,`portraits-cdn/` 已 gitignore),托管需开 CORS,否则卡面导出会污染 canvas。

PWA(`vite-plugin-pwa`)只在 web 构建挂载:立绘 CacheFirst 运行时缓存,app shell precache,`.webp` 一律不进 precache。Tauri 构建靠 `TAURI_ENV_PLATFORM` 整体跳过插件 —— 自定义协议下 SW 注册无效。
