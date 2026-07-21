# 千古名将 · 工程约定与架构铁律

炉石类 1v1 对战 CCG,全朝代名将卡池(可收集 2,261 张 = 2,211 武将 + 31 锦囊 + 19 装备,另有 3 张衍生物只能被召唤;数据来自姊妹仓库)。目标平台:Web + iOS (Tauri 2)。
完整设计方案见项目笔记(未入库)。

## 命令

- `npm run dev` — 开发服务器,端口 **5174**(5173 留给姊妹项目)
- `npm run build` — **类型检查 + 构建**(不要单独跑 `tsc --noEmit`;Vercel 对未使用 import 报错)
- `npm test` — Vitest(`src/**` 与 `server/**` 的 `*.test.ts`)。
  server 的单测用 `server/src/testStorage.ts` 里的内存 DO 替身,只覆盖**纯逻辑**
  (ELO 数学、赛季换算、TOFU 判定、协议闸门);需要 workerd 语义的部分
  (hibernation / alarm 真被调度 / WebSocketPair)仍然只能靠 drive-test
- `npx playwright test` — 浏览器端到端(对局/图鉴/构筑/开包/教程/军令/回放/主公技/卡组码/设置)
- `npm run import-content` — 从姊妹仓库重新生成卡池 + 签名卡立绘 + 列传台词(幂等)
- `npm run sim-balance` — 六套预组互搏胜率矩阵 + 两道平衡闸门(默认 100 局/对 ≈60 秒;`GAMES=40` 只配试探,**下结论别用**:40 局噪声达 ±8 个百分点)
- `npm run typecheck` — 四个 tsc 项目全跑一遍(应用 / 测试 / Workers / drive-test)。`npm run build` 会先跑它
- `npm run deck-stats` — 预组体检(曲线/身材/守护/抢攻/解场并列),调平衡时先看它再动手
- `npm run sim-campaign` — 关底战难度曲线 + 三道闸门(首关够友好 / 末关够难 / 整体递减)
- `npm run tune-campaign` — 对每关二分搜索难度参数,只打印建议值,不改代码
- `node --import tsx server/drive-test.ts` — 联机端到端(需先在 `server/` 起 `npx wrangler dev`)

CI 在 `.github/workflows/ci.yml`:lint / 构建 / 单测 / e2e 一个 job,**平衡闸门独立一个 job**(sim-balance 会 exit 1),外加一个 job 断言 `src/content/generated` 没被手改。

## 架构铁律

1. **引擎纯度**(`src/engine/`):纯函数、确定性、可序列化。禁止 `Date`/`Math.random`/`performance`/React/zustand/任何引擎外 import。随机数只走 `rng.ts` 种子 RNG,状态经 `GameState.rng` 显式传递。ESLint 围栏 + `purity.test.ts` 双重把守。这是服务端权威对战的生命线。

2. **附魔层是唯一的写入路径**(`resolve.ts`)。`CardInstance` 的 `attack` / `health` / `maxHealth` / `keywords` 是**派生字段**:由 `refreshInstance()` 从卡面基础值 ⊕ `enchants` ⊖ `silenced` 算出。
   **任何对数值的修改都必须记成一条 `Enchant` 再 refresh,不能直接赋值。**
   直接改数值就没有撤销路径 —— 沉默、临时增益、光环这三件事全靠它。
   受伤记在 `damage` 字段,`health = maxHealth - damage`;这样上限变化(光环消失、沉默)能正确导出死亡,而不是把血量算成负数。
   两个抑制标记 `shieldUsed` / `stealthBroken`:铁壁与潜行一旦消耗,refresh 会从卡面把它加回来,必须压住。
   撤销增益该不该杀人分情况:**临时增益到期不能杀**(截断到 1 血),**光环消失可以杀**(炉石规则)。这是 `removeEnchants` 的 `clampAlive` 参数。

3. **内容生成**:`src/content/generated/cards.gen.ts` 由脚本生成,**禁止手改**(但要入 git,构建不依赖姊妹仓库)。手工调校写进 `overrides/signature.ts`(签名卡)或 `overrides/packN.ts`(各卡包;目前到第四包「伏兵與連擊」)。
   播种规则见 `scripts/import-content.ts`,三条原则:**确定性**(走 id 的 FNV 哈希,不用 `Math.random`,产物必须逐字节可复现)、**要付账**(关键词与效果从身材扣点数,费用按扣点前算)、**留白板**(约三分之一保持白板当曲线骨架)。

   **费用是按名次分配的,不是从数值算出来的。** 从前 `cost ≈ (攻+血)/2`,而攻血又是武力/统率的线性映射;历史人物的能力值是钟形分布,线性映射不会把它拉平 —— 实测 2211 张武将 **72% 挤在 3-5 费**,0/9/10 费一张也没有。现在先按战力分排名次、按 `COST_CURVE` 落进费用档,再由 `statBudget(cost)`(攻+血 ≈ 2×费+1)给身材预算,最后按武将的攻守倾向劈成攻和血。曲线形状由我们说了算,「谁更强谁更贵」的相对关系仍然保留。
   **副作用要记住:身材总点数现在是费用的函数。** 任何「同费挑身材更好的卡」式的选牌逻辑都因此失效了 —— 关底战的 `bossDeck` 就是这么被打平的(见下)。
   **预组用到的卡完全不参与播种。** 那批卡的身材与曲线是跨很多轮 sim-balance 手调出来的;第一次没排除它们,矩阵直接被打成 70% / 33%、七个对位极化。

4. **素材源头**:`/Users/sean/Developer/ThreeKingdomMastersIOS` 只读。武将数据、立绘、主义推导(`deriveDoctrine`)都从那边导入。稀有以上的主义归属**完全遵循**源头的 `deriveDoctrine`;只有把普通卡拉出中立池时才用放宽版判定(`widenedDoctrine`),否则隐逸/割据的可构筑池薄到没法组牌。

5. **效果是数据**:卡牌效果用 `EffectScript` DSL(`src/engine/types.ts`),不写闭包。某张卡需要新操作码 → 进下个卡包,不为单卡改引擎。现有 16 个操作码。

   **伏兵是引擎里唯一「一方的动作会跑另一方脚本」的机制**(`secrets.ts`),三条不变量都有断言:一次动作最多翻一个伏兵;脚本跑完立刻 `processDeaths`;伏兵**先离开伏兵区再跑脚本**(否则脚本里触发同类动作会把自己再翻一次)。
   最危险的是 `enemyAttack`:它在伤害结算**之前**触发,可以把攻击者打死或弹回手牌。`performAttack` 因此必须在触发后**重新取一次**攻击者引用 —— 触发前抓的那个引用可能已经不在场上了。复检用的是 `canAttackNow2` 而不是 `canAttackNow`:后者会看 `attacksUsed`,而这次的次数在触发前就扣了,用它会把每一次「触发了伏兵的攻击」都误判成无效。

6. **持久化的 GameState 必须能迁移**(`migrate.ts`)。`GameState` 存在两个地方会跨版本存活:服务端 DO 的 `game` 键(一局打到一半服务端就部署了)、客户端 localStorage 的战报。
   **给 `PlayerState` 加一个必填字段,这两处的旧数据立刻是非法状态。** 第四卡包上线时 drive-test 就是这么炸的:`redactState` 在 `opp.secrets.map` 上抛 TypeError,那一局双方都停在最后一帧。tsc 兜不住 —— 反序列化出来的东西没有类型。
   加字段时:在 `migrateState` 里补默认值,在 `matchDO.load()` 与 `listReplays()` 的读取点调用它。原则是**只补不改**,不推断旧局面的语义。`migrate.test.ts` 里有一条断言专门验证「不迁移就会崩」,守着这一层存在的理由。

7. **事件驱动 UI**:UI 动画只消费 `applyCommand` 返回的事件流,不做状态 diff。新增 `GameEvent` 变体后要同步 `eventText.ts`(战报文案)与 `floats.ts`/`useEventAnimations.ts`(动效),否则事件在 UI 里静默丢失。

8. **改签名卡数值或主公技必跑 `sim-balance`**:两道闸门 —— 每套预组总胜率 40–60%,且**任一对位 30–70%**。只看总胜率会漏掉「六套互相克制、各自都是 50%」的猜拳局面。
   **主公技是全局触发频率最高的效果**(每回合都能用),一点数值差会在三十回合里被放大成压倒性优势。实测:同样是「给一个关键词」,铁壁 64% / 潜行 27%,差 37 个百分点。
   治疗与护甲类效果在贪心 AI 评分里近乎为零 —— 割据从「获得 3 点护甲」改成「召唤 0/4 守护」才从 29% 拉回来。
   **反直觉的一条**:给割据预组换上「4/6 守护 + 光环」替代「6/6 白板」,总胜率反而从 38% 掉到 36%。光环与控场抵不过直接掉的 3 点身材。

9. **AI 有三档,差别不只是失误率。** 新兵看不见多步斩杀,宿将偶尔失误,名将零失误、必算斩杀、而且**会看对手下一回合**(`foresight`)。
   前瞻是个粗糙近似:假设对手全场下回合都能动,守护墙按「总血量要先被啃穿」折算,不展开真搜索。对打实测**前瞻方 64.4% 胜率**(360 局,轮流先后手)。
   它补的是贪心最后一个大盲区 —— 看得见「这一步换得赚不赚」,看不见「我这样收手会不会被一波带走」。
   **`AI_NORMAL` 刻意不开前瞻**:它是 sim-balance / sim-campaign 一路调平衡用的基准尺,换掉就没法和历史数字比了。

10. **sim-balance 测的是贪心 AI 的游戏,不是人类的游戏。** 它只覆盖六套预组,不覆盖 2,250 张卡的单卡强度。AI 现在会看卡牌身份与关键词(早期版本 `void lib` 把卡牌身份整个丢掉),但依然不会留牌、不做多回合铺垫。**别为了让矩阵好看而过度拟合。**

## 结构

- `src/engine/` — 规则引擎(types/rng/init/reducer/legal/combat/resolve/redact/replay)
- `src/content/` — 卡池(generated 生成层 ⊕ overrides 手工层 → cards.ts 合并)+ 卡组码
- `src/ai/` — 贪心 AI(评分 + 斩杀搜索)
- `src/app/` — Zustand stores、transport、联机客户端、存档同步
- `src/ui/` — React 层(screens/components/i18n)
- `scripts/` — 导入管线、平衡模拟、预组体检
- `server/` — Cloudflare Workers + DO

## 三种玩法

| | 入口 | 用什么卡组 | 计分 |
|---|---|---|---|
| 随便打 / 天梯 | 标题页 | 自己的收藏 | 天梯局计 ELO |
| **竞技场「校场点将」** | 标题页 | **现抽 30 张,不看收藏** | 不计 |
| **冒险「群雄逐鹿」** | 标题页 | 自己的收藏 | 不计,首通发奖 |

竞技场:100 功勋报名 → 主公三选一 → 三选一抽满 30 张 → 打到 3 败或 12 胜。
份数不限,抽到几张同名就能带几张。它是唯一不依赖收藏的模式,
也是**播种后卡池的第一个真正消费者**——生成卡还是白板的时候这个模式立不住。

冒险:八场关底战按顺序解锁,Boss = 「血更厚 + 主公技更强 + 卡组更好」的普通对手。
不给 Boss 特权卡 —— 引擎是对称的,开后门要改引擎。
难度三个旋钮的强弱差别很大,详见 `src/content/campaign.ts` 顶部注释:
**卡组质量分位是强旋钮**(同一个 Boss 能从 35% 拨到 97%),血量是弱旋钮(30→23 血只差 2 个点)。

## 主公技

六个主义各一个 **2 费、每回合一次**的技能,落在六条不同的资源轴上(王道增益 / 霸道点杀 / 礼教换牌 / 名利铺场 / 割据守墙 / 隐逸控场)。定义在 `content/overrides/heroes.ts`。

技能随 `PlayerState.heroPower` 走,**不是查 HeroDef 表** —— 引擎必须状态自足、可序列化。服务器侧由 `MatchDO.startGame()` 发放,客户端说了不算。教学局不给技能(第一局先讲清基本操作)。

## iOS (Tauri 2)

- 模拟器运行:先 `xcrun simctl boot <设备>`(关机状态部署会 149 报错),再 `npx tauri ios dev 'iPhone 17 Pro'`
- CocoaPods **不需要**:Podfile 为空、工程零 Pods 引用;`tauri ios init` 会因缺 pod 报错,但 Xcode 工程已在 gen/apple 复刻好,勿删
- `vendor/wry` 是 iOS 26 启动崩溃补丁,tauri 升级需重测;`package.json` 里 `"tauri": "tauri"` 脚本是 Xcode 构建脚本的依赖,勿删
- 图标源图 `assets/logo.svg`;改设计后跑 `node scripts/make-logo.mjs` 重出位图,再 `npx tauri icon assets/logo-1024.png`
- 对战画面是**横屏**布局。Info.plist 允许竖屏,窄屏竖持时 `MatchScreen` 会盖一层「请横持设备」(纯 CSS 控制,不锁转向 —— 平板/桌面竖窗是合理的)
- TestFlight:App Store Connect 建记录(bundle id `com.seanye.qiangulegends`)→ Xcode 设一次签名 Team → `npx tauri ios build --export-method app-store-connect`

## 联机

- `server/` 是 Cloudflare Workers + DO;`npx wrangler dev`(server 目录)本地起服,无需登录。**别把 wrangler 的输出接管道**(`| head` 之类),写满就 SIGPIPE 把它杀了
- 五个 DO:`QueueDO`(分段匹配)/ `MatchDO`(权威对局)/ `RoomDO`(房间码)/ `RatingsDO`(ELO)/ `ProfileDO`(存档同步)
- 服务器直接打包 `src/engine` 与 `src/content`(零依赖纯 TS);引擎改动天然同步两端
- 客户端 `src/app/remoteMatch.ts` 负责座位翻转(UI 恒定我=0)与裁剪态重建;MatchScreen 对本地/联机无感知
- **全部 DO 走 WebSocket Hibernation**:不能用 `server.accept()`,要 `ctx.acceptWebSocket()` + `webSocketMessage/Close` 处理器。代价是内存态随时会没 —— 每个入口先 `load()`,座位归属放 `serializeAttachment`,报名信息必须落盘
- **DO 只有一个 alarm 槽**,而 MatchDO 有三种时限(掉线判负 90s / 回合超时 90s / 弃坑清理 6h)。做法:三个 deadline 一起落盘,闹钟设在最早的那个,醒来后按紧急程度依次判断
- 回合时限**只在回合号真正推进时重置**。按出牌次数重置的话,反复出无关的牌就能把绳子无限续下去
- 解冻放在**持有者自己回合结束时**,不是回合开始 —— 放回合开始的话,在对手回合冻结他的单位,他一开局就化了,等于没冻
- **协议有版本号。** 改 `MatchClientMsg` / `MatchServerMsg` / `QueueClientMsg` 的结构,
  必须 bump `src/app/protocol.ts` 的 `PROTOCOL_VERSION`;若破坏兼容,同步抬高
  `server/src/protocolGuard.ts` 的 `MIN_CLIENT_VERSION`。
  老客户端会收到 `protocol-outdated`,UI 直接请玩家刷新(PWA autoUpdate 能拉到新构建)。
  只加**可选字段**不用 bump。`/health` 会自报 `protocol` 与 `minClient`,部署后可核对。
  为什么非要有:客户端是 PWA,Service Worker 会把旧构建缓存住 —— 不拒绝的话,
  旧客户端会静默按旧字段解析新消息,表现为「牌打不出去」这类没法归因的 bug。
- **`server/` 现在有类型检查了,但仍然**必须**跑 `drive-test.ts`。**
  很长一段时间里 `server/*.ts` 不在任何 tsc 项目内(wrangler 用 esbuild 打包,不看类型),
  代价是它抓不到「调了不存在的方法」「忘了 import」这类最基础的错 —— 各踩过一次。
  现在 `tsconfig.server.json`(Workers 运行时)与 `tsconfig.drivetest.json`(node 里的客户端)
  各管一半,`npm run typecheck` 会跑它们。
  **分成两个配置是必要的**,不是洁癖:drive-test 直接 import 真正的 `src/app/remoteMatch`,
  要的是 DOM 的 `WebSocket`(`onopen`/`onmessage`);而 DO 代码用 Workers 的 `WebSocket`
  (有 `READY_STATE_OPEN`)。两套类型互不兼容,硬塞进一个配置只能靠 `any` 抹平,那就白检了。

  **类型检查替代不了 drive-test。** 第四卡包上线时炸的那个迁移问题
  (DO 里存着旧版引擎写的 GameState)就完全在类型系统之外 ——
  反序列化出来的东西没有类型。跨会话的状态、hibernation 唤醒、协议闸门这些,
  只有真跑一遍才知道。

### 安全边界(明确写清楚哪些防了、哪些没防)

**防住的:**
- 对局内一切:`MatchDO` 持权威状态,每条命令过与客户端相同的 `applyCommand`,只推 redact 后的视角
- **天梯刷分**:天梯 matchId 由 QueueDO 用 `MATCH_SECRET` 签发(`<uuid>~<HMAC>`),`MatchDO` 结算前验签。自选 id 的对局照常进行,只是不计分
- **拔网线逃分**:掉线 90 秒未回即代其投降,ELO 正常结算
- **拖回合**:90 秒到点服务器代打 EndTurn,并把时限推给客户端显示(`TurnRope`)
- **改别人存档**:`ProfileDO` 做 TOFU —— 首次带密钥写入即认主,之后读写都要带对同一密钥
- **刷消息**:按连接滑动窗口限流(10 秒 120 条)

- **观战泄漏手牌**:观战席拿的是 `redactForSpectator` 的视角,双方手牌牌面都被抹空
- **再战刷分**:再战局不计天梯分(同一对玩家反复再战是经典刷分路径)

**没防住的(有意为之,写清楚免得误以为安全):**
- **卡包与收藏仍是客户端权威**。`rollPack()` 跑在浏览器里,`owned` 直接上传。真要防得把发放搬到服务器
- **每日军令进度**同上
- **没有账号系统**。身份是 localStorage 里一个 UUID;TOFU 挡的是「拿到 id 就能改」,挡不住「一开始就冒名一个从没同步过的 id」
- **每日胜场榜**(`api/leaderboard.js`)无鉴权。已改成以 playerId 为榜位主键(此前是**显示名**,谁都能顶别人名字写),并加了「一天不可能赢 500 局」的下限校验,仅此而已
- 无区域/延迟感知匹配、无举报/封禁、无自由聊天(只有六句固定表情)
- 观战只能凭**房间码**进(没有对局浏览器),天梯局无法围观

## 可观测性

服务端此前**每一条错误路径都是静默 `catch {}`** —— 天梯上报失败、广播失败、
闹钟抛异常,线上全都看不见。`server/src/log.ts` 打 JSON 结构化日志(Workers 的
Logs/Tail 只能看 console 输出),按 `evt` 聚合:
`ratings.report.failed` / `match.illegal_command` / `match.rate_limited` /
`match.forfeit` / `match.turn_timeout` / `match.abandoned` /
`profile.no_secret` / `profile.bad_secret`。

**日志绝不改变控制流** —— 所有调用点仍然吞掉异常(天梯挂了不该让对局崩掉),
日志只是让「我们决定忽略它」这件事变得可见。

客户端仍然**没有**崩溃上报与埋点,只有一个错误边界(带一键复制错误信息)。

## 经济(功勋)

重复卡超上限自动折算功勋,功勋可定向合成任意卡。分解只吃「多出来的」那张,不会拆散在用的卡组。
输一局给 15 点安慰功勋、和局 8 点 —— 输了颗粒无收对新手太劝退。20 包不出传说有保底。

功勋的出入口(改经济前先看这张表,别把某一侧撑爆):
- **入**:重复卡折算 / 败局 15、和局 8 / 成就(以功勋为主)/ 冒险首通 / 竞技场结算
- **出**:定向合成 / 竞技场报名 100

成就与卡包的关系刻意保守:卡包产出会直接冲击「一局一包」的基线,
所以 25 条成就里只有两条最难的给卡包。
比例参照炉石(分解:合成 ≈ 1:4)但整体压缩过,本作一局一包,用炉石原数值合一张传说要六十多包。

**加了会变的存档字段,必须同时改 `ProfileData` 与 `snapshot()`/`adopt()` 两侧。** 只改一边的表现是「换设备后这个字段悄悄归零」,而且不报错。

## 存档同步(`src/app/profileSync.ts`)

- **本地优先**:读写照旧走 localStorage,云端只是镜像。没配服务器/断网/没部署一律静默降级,绝不阻塞操作
- 单调 `version` + 后写覆盖;服务器拒收低版本并回传自己那份
- `sendBeacon` 只能发 **POST** 且不能设请求头 —— 所以 `ProfileDO` 把 POST 与 PUT 等价处理,密钥可走查询串。(在这之前 beacon 一直是 404,「关页面前尽力推一把」其实从没生效过)

## 包体红线

签名卡立绘随包(`public/portraits/`,~49MB),其余走 CDN 懒加载。`npm run import-content` 会打印立绘总大小,超 **150MB** 必须缩签名集。

取图三层在 `src/ui/portraitSource.ts` 收口(**所有取立绘 URL 的地方都走 `portraitCandidates()`,不要再手拼路径**):随包 → `VITE_PORTRAIT_CDN`(可选)→ 拓印兜底。判断「本地有没有」读的是 `manifest.json`,所以不会对不存在的文件发请求。CDN 产物用 `npm run export-portraits` 生成(439MB,`portraits-cdn/` 已 gitignore),托管需开 CORS,否则卡面导出会污染 canvas。

PWA(`vite-plugin-pwa`)只在 web 构建挂载:立绘 CacheFirst 运行时缓存,app shell precache,`.webp` 一律不进 precache。Tauri 构建靠 `TAURI_ENV_PLATFORM` 整体跳过插件 —— 自定义协议下 SW 注册无效。

## 构建期环境变量

| 变量 | 作用 | 不配时 |
|---|---|---|
| `VITE_PORTRAIT_CDN` | 非签名卡立绘的 CDN 根 | 非签名卡走拓印兜底,一个请求都不发 |
| `VITE_MATCH_SERVER` | 联机服务器默认地址 | 回落 `localhost:8787`(只对本地开发有意义) |
| `MATCH_SECRET`(服务端) | 天梯 matchId 的签名密钥 | 用开发默认值 —— **上线必须配** |
