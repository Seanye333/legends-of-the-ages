# 上线清单

服务端代码是完整可跑的(1,266 行、五个 Durable Object、**引擎真的跑在服务端**),
但**从来没有部署过** —— 没有 routes、没有 `.env`、`VITE_MATCH_SERVER` 零设置,
最新构建产物里硬着 `localhost:8787`。也就是说现在联机只能本机对本机。

差的不是代码,是这份清单。三步,十分钟。

**2026-08 复核**:构建与绑定已经干跑验过了 ——

```
npx wrangler deploy --dry-run
  Total Upload: 1441.36 KiB / gzip: 232.26 KiB
  env.QUEUE (QueueDO) / env.MATCH (MatchDO) / env.ROOM (RoomDO)
  env.RATINGS (RatingsDO) / env.PROFILE (ProfileDO)      ← 五个绑定齐全
```

同一轮把 MatchDO / QueueDO / RoomDO 的**零单测**补上了(server 测试 30 → 81 条),
其中抓到一个只在线上才会犯的错:限流用「窗口起点 === 此刻」判新窗口,
而 workerd 为缓解 Spectre **把时钟冻在没有 I/O 的执行块内** ——
垃圾消息走不到任何 I/O,计数每条都被重置成 1,限流形同虚设。已修并钉了回归测试。
**这条如果带着上线,一个 while 循环就能把对局的存储刷爆(按次计费)。**

所以现在真正缺的只有下面这两条命令 —— `wrangler login` 要走浏览器 OAuth,
只能你本人来。

---

## 一、部署联机服务器

```bash
cd server
npx wrangler login          # 首次;要开浏览器授权,没法脚本化
npx wrangler deploy
```

部署成功会打印形如 `https://qiangu-server.<你的子域>.workers.dev` 的地址。
免费档够用:Durable Object 的免费额度对小规模对战绰绰有余。

**紧接着必须配签名密钥** —— 别跳过这一步:

```bash
# 随便生成一个高熵串
openssl rand -base64 32
npx wrangler secret put MATCH_SECRET   # 粘进去
```

不配的话服务端会回落到**公开在源码里**的开发密钥
(`server/src/matchId.ts` 的 `DEV_SECRET`)—— 任何读过这个仓库的人都能
自签合法的天梯 matchId,验签形同虚设。

从 2026-07 起回落时每次都会打日志,搜 `matchId.dev_secret` 即可确认线上是否裸奔:

```bash
npx wrangler tail | grep matchId.dev_secret
```

**验证部署**:

```bash
curl https://qiangu-server.<你的子域>.workers.dev/health
```

## 二、把地址烧进前端

```bash
# 仓库根目录
echo 'VITE_MATCH_SERVER=qiangu-server.<你的子域>.workers.dev' > .env.local
npm run build
```

`.env.local` 已被 `.gitignore` 忽略。不带协议头 —— `protocol.ts` 会自己按
`wss://` / `https://` 拼。

不配这一项也不会崩:玩家可以在联机面板手填服务器地址(存
`qiangu-server-addr`)。但默认值是 `localhost:8787`,等于"联机不可用"。

**验证**:构建后 `grep -r "workers.dev" dist/assets/*.js` 应当命中。

## 三、部署前端

`vercel.json` 已就绪。`npx vercel --prod`,或接 GitHub 自动部署。

`/api/leaderboard` 是同源的 Vercel 函数,跟着前端一起部署 —— 它**无鉴权**
(见下面「已知未防住的」)。

---

## 上架 iOS 之前

| 项 | 状态 |
|---|---|
| 应用图标(18 个尺寸) | ✅ 齐 |
| 启动屏 | ✅ 已定制(暗色 + 金字,不再是 Tauri 的纯白模板) |
| `PrivacyInfo.xcprivacy` | ✅ 已补(2026-07) |
| 构建号递增 | ✅ `CFBundleVersion` 改成整数 `1`,**每次上传前 +1** |
| bundle id | ✅ `com.seanye.qiangulegends` |
| 隐私政策 | ✅ `PRIVACY.md`(App Store Connect 里要填 URL,记得挂到线上) |
| **签名 Team** | ❌ 需要 Apple 开发者账号 —— 构建就卡在这一步 |
| `ExportOptions.plist` | ❌ 现在是 `debugging`,发布要 `app-store-connect` |
| **立绘授权** | ⚠️ **未确认,见 [ASSET-PROVENANCE.md](ASSET-PROVENANCE.md)** |

构建实测(2026-07,Xcode 26.6 / rustc 1.96):
`npx tauri ios build --debug` 一路走到代码签名才停,报
`Signing for "app_iOS" requires a development team`;
`cargo build --target aarch64-apple-ios --release` 干净通过。
**前端、资源、Rust 编译全通,唯一缺的是开发者团队。**

---

## 已知未防住的(上线前要知道自己在接受什么)

- **卡包与收藏是客户端权威**。`rollPack()` 跑在浏览器里,改本地存档能刷出
  全卡池、无限功勋、任意成就,并同步到云端。**但刷不到天梯 ELO** ——
  那条路要么走真实对局(MatchDO 服务端权威),要么依赖 MATCH_SECRET 没配。
- **每日胜场榜无鉴权**,而且**单机赢 AI 也会上报**(`matchStore.ts` 的
  `reportWin`)。上限 500/天。要真防得把它挪到 Worker 后面。
- **观战只能凭房间码**,天梯局无法围观。
- **没有账号系统**。存档归属靠 TOFU 密钥,换设备要用设置页的「搬迁码」。

完整的安全边界(包括哪些防了)见 [ARCHITECTURE.md](ARCHITECTURE.md)。
