# 千古名将 · Legends of the Ages

全朝代名将卡牌对战(炉石类 1v1 CCG)。2,261 张可收集卡横跨 18 个朝代阵营:三国名将与孙武、项羽、韩信、李世民、岳飞同台竞技。六大主义为职业(王道/霸道/礼教/名利/割据/隐逸),各带一个每回合可用的**主公技**;朝代为羁绊,签名机制「单挑」。

Web + iOS (Tauri 2)。卡牌数据与立绘来自姊妹项目 [ThreeKingdomMastersIOS](../ThreeKingdomMastersIOS)(素材源头,脚本导入)。

## 快速开始

```bash
npm install
npm run import-content   # 从姊妹仓库生成全卡池 + 立绘 + 列传(输出已入 git,可跳过)
npm run dev              # http://localhost:5174
```

iOS 模拟器:`xcrun simctl boot 'iPhone 17 Pro' && npx tauri ios dev 'iPhone 17 Pro'`

## 命令

| 命令 | 作用 |
|---|---|
| `npm run dev` | 开发服务器(5174) |
| `npm run build` | 类型检查(app+test)+ 构建 |
| `npm test` | Vitest(引擎/内容/AI/收集/任务/存档/卡组码 129 测试) |
| `npm run lint` | ESLint(引擎纯度围栏 + 各运行时 globals) |
| `npx playwright test` | 浏览器端到端 14 例(对局/图鉴/构筑/开包/教程/军令/回放/主公技/卡组码/设置) |
| `npm run import-content` | 重新生成卡池与素材 |
| `npm run export-portraits` | 导出全池立绘到 `portraits-cdn/`(供上传当 CDN,见「部署」) |
| `npm run sim-balance` | 预组 AI 互搏胜率矩阵 + 两道平衡闸门(GAMES=N 控制局数) |
| `npm run deck-stats` | 预组体检:曲线 / 总身材 / 守护 / 抢攻 / 解场 并列对比 |

## 卡池

| | |
|---|---|
| 武将牌 | 2,211(公式生成 + 属性画像播种机制,其中 **233 张签名卡**手工调校 + 随包立绘 + 列传台词) |
| 锦囊牌 | 31(手工设计) |
| 装备牌 | 19(第二卡包「神兵天降」+ 第三卡包「附魔与谋略」) |
| 衍生物 | 3(死士 / 伏兵 / 江东水寨 —— 只能被召唤,不进卡包) |
| 关键词 | 冲锋 / 突袭 / 守护 / 连击 / **单挑** / 吸血 / 剧毒 / 铁壁 / 潜行 |

生成卡不再是清一色的白板:**66% 带关键词或效果**(共 16 种战吼),其余保留白板当曲线骨架。
关键词与效果一律从身材里扣点数,不是白送 —— 同费带效果的卡就是「更弱的身材 + 一个效果」。

六大主义作为职业,可构筑深度(非中立卡)分别是王道 409 / 名利 311 / 霸道 261 / 割据 177 / 礼教 173 / 隐逸 119。

平衡由 `npm run sim-balance` 把关,**两道闸门**:每套预组总胜率 40–60%,且任一对位 30–70%。
第二道是关键 —— 六套卡组互相克制、各自总分都在 50% 附近也能骗过第一道,但那种牌局胜负在选卡组时就定了。

## 架构

- `src/engine/` — 纯确定性规则引擎(种子 RNG、命令/事件、回放、视角裁剪),零依赖,为服务端权威对战设计
- `src/content/` — 生成层(公式)⊕ 手工层(签名卡/锦囊/装备/主公/预组)
- `src/ai/` — 贪心模拟评分 AI
- `src/app/` — Zustand stores(对局/收集/每日军令/战报)、transport、排行榜与天梯客户端
- `src/ui/` — React 界面(事件时间轴动效 + Web Audio 合成音效 + 闪卡/卡面导出 + 新手教程)
- `api/` — Vercel serverless 每日胜场榜(KV 未配置时优雅降级)
- `server/` — 联机服务器(Cloudflare Workers + Durable Objects),见下

## 玩法系统

- **主公技** — 六个主义各一个 2 费、每回合一次的技能,落在六条不同的资源轴上:
  王道「仁德」给友方 +1/+2、霸道「唯才是举」造成 1 点伤害、礼教「有教无类」抽牌换血、
  名利「鹰视狼顾」召死士、割据「制衡」立水寨、隐逸「无为」冻结敌将。
  在没发一张牌的时候,六个主义就已经是六种打法。

- **新手教程** — 标题页「新手教程」(零战绩时主动邀请)。条件驱动的教鞭:每步给「何时出现 / 何时算完成」谓词,玩家怎么打都跟得上,不存在卡步。
- **每日军令** — 每天三条任务(单挑击杀 / 主义获胜 / 锦囊施放…),按日期种子确定性生成,达标领卡包。
- **战报回放** — 每局自动留档(最近 5 场),回放播放器复用对战动效时间轴,支持暂停 / 单步 / 2×。
- **收藏与开包** — 闪卡演出(史诗流光、传奇彩虹 + 光芒爆点)、卡面 PNG 导出分享、全池图鉴 + 长按详情(全身立绘、列传、名言、单挑台词、关键词图例)。
- **功勋与合成** — 重复卡超上限自动折算功勋,功勋可**定向合成**任意一张卡;输一局给安慰功勋,20 包不出传说有保底。
- **卡组码** — `QG1.` 开头的短码,复制粘贴即可分享整副卡组(每套 120 字符以内)。
- **设置页** — 战绩总览、音量滑块、减少动效、语言、敌手强度、立即同步、设备 ID、清空进度。
- **AI 难度** — 新兵 / 宿将 / 名将三档。三档的差别不只是失误率:低两档**看不见多步斩杀线**,
  「名将」零失误且每回合先算一遍斩杀。教学局固定用最宽容的一档。
- **存档云同步** — 收藏 / 卡包 / 战绩 / 自组卡组 / 每日军令挂在匿名设备 ID 上,换设备或清缓存不再归零。本地优先,云端只是镜像 —— 没配服务器或断网时静默降级。
- **中英双语** — 界面、卡牌文本、关键词规则、列传、**战斗日志**全部双语;「双语」模式下战报中文主行 + 英文副行。

## 联机对战

```bash
cd server && npx wrangler dev          # 本地服务器 localhost:8787
node --import tsx server/drive-test.ts # 端到端验证(见下)
```

游戏内:标题页「联机对战」→ 填服务器地址 → 快速匹配(计天梯)或好友约战(房间码)。

- **权威对局** `MatchDO` — 每条命令过与客户端完全相同的 `applyCommand` 校验,客户端只收 redact 后的视角状态
- **断线重连** — 座位令牌 + 状态持久化;闪断自动指数退避重连,刷新/杀进程后标题页「回到对局」续局
- **天梯** `RatingsDO` — ELO(初始 1200,K=32),段位从兵卒到大将军;`QueueDO` 按分差 ≤300 撮合,等待超 15 秒放宽
- **好友房间** `RoomDO` — 四字符房间码直连,不计天梯
- **存档** `ProfileDO` — 一个玩家一个实例,单调版本号 + 后写覆盖
- **全部走 WebSocket Hibernation** — 等对手落子、排队、挂房间的空窗期 DO 可被驱逐而不计费;`MatchDO`/`RoomDO` 另设 alarm 自毁,弃坑对局不会永久占 storage

- **回合时限 90 秒** — 到点服务器代打 EndTurn,并把时限推给客户端显示成一根引信式的绳子
- **掉线判负** — 掉线 90 秒未回即代其投降,ELO 正常结算(此前拔网线是免费的逃分手段)
- **天梯 id 验签** — 天梯 matchId 由 QueueDO 用 `MATCH_SECRET` 签发,自选 id 的对局不计分(此前两个客户端串通即可刷分)
- **存档归属** — `ProfileDO` 首次带密钥写入即认主,之后读写都要带对同一密钥(此前知道 playerId 就能改别人存档)
- **限流** — 每连接 10 秒 120 条消息

`drive-test.ts` 一次跑完:天梯匹配 → 双 AI 完整对局 → 注入非法命令被拒 → 模拟闪断自动重连 → ELO 结算;
再走一遍房间码创建/加入并断言房间局不计分;然后验证存档推送/拉取/版本冲突;
最后验证加固项本身 —— 存档归属四态(认主/无密钥 401/错密钥 403/beacon POST)与「自选 matchId 不计分」。

**上线前必配 `MATCH_SECRET`**(`wrangler secret put MATCH_SECRET`),不配会用开发默认值。
安全边界的完整清单(包括**哪些没防**)见 [ARCHITECTURE.md](ARCHITECTURE.md#安全边界明确写清楚哪些防了哪些没防)。

部署:`cd server && npx wrangler deploy`(需 Cloudflare 账号,免费档即可),客户端填 `wss://qiangu-server.<你的子域>.workers.dev`。

详细约定见 [ARCHITECTURE.md](ARCHITECTURE.md)。

## 部署

- **CI**:`.github/workflows/ci.yml` —— lint / 构建 / 单测 / e2e 一个 job,**平衡闸门独立一个 job**,外加一个 job 断言生成物没被手改
- **Web**:Vercel 导入本仓库即可(`vercel.json` 就绪);要开全球排行榜,在 Vercel 项目加 KV/Upstash 集成,零代码改动。
  联机默认地址配 `VITE_MATCH_SERVER`,否则玩家看到的是连不上的 `localhost:8787`
- **PWA**:web 构建自动带 Service Worker(`vite-plugin-pwa`,可安装到主屏、离线可玩)。app shell 走 precache,立绘走 CacheFirst 运行时缓存(上限 800 张 / 60 天)。Tauri 构建(桌面/iOS)会自动跳过整个 PWA 插件 —— 自定义协议下 SW 注册无效,资源本来也都在包里
- **立绘 CDN**(可选,但强烈建议):见下
- **iOS TestFlight**:App Store Connect 建记录(`com.seanye.qiangulegends`)→ Xcode 打开 `src-tauri/gen/apple/app.xcodeproj` 设签名 Team → `npx tauri ios build --export-method app-store-connect`

### 立绘 CDN

全池 2,250 张卡的立绘共 **439MB**,不可能随包。分三层取图(`src/ui/portraitSource.ts`):

1. **随包** —— 233 张签名卡的头像 + 全身图(`public/portraits/`,49MB),由 `npm run import-content` 复制,清单落在 `src/content/generated/manifest.json`。运行时只对清单里有的文件发本地请求,不会去撞不存在的路径。
2. **CDN** —— 其余 ~2,100 张按 `VITE_PORTRAIT_CDN` 拼 URL 懒加载(`loading="lazy"`,滚到才请求;解析结果进内存缓存,重挂载不重试)。
3. **拓印兜底** —— 都取不到时显示主义色晕染 + 首字书法大字。

**不配 `VITE_PORTRAIT_CDN` 时行为与从前完全一致**:非签名卡直接走兜底,一个请求都不发。

```bash
npm run export-portraits            # → portraits-cdn/(已 gitignore),末尾打印完整上传说明
npx wrangler pages deploy portraits-cdn --project-name qiangu-portraits   # 或 Vercel / R2 / 任意静态托管
# 然后在主站构建环境里配:
VITE_PORTRAIT_CDN=https://<你的域名>/
```

托管侧两个要求:回 `Access-Control-Allow-Origin: *`(否则「保存卡面」会因 canvas 被污染而失败),以及 `Cache-Control: public, max-age=31536000, immutable`。
