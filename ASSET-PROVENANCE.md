# 素材来源与授权状况

这份文件记录**查证到的事实**,不做法律判断。上架、商用或对外分发之前,
第 1 节的结论需要你自己或律师确认 —— 它是目前唯一没有闭合的合规风险。

最后核对:2026-07-30。核对方式写在每一节末尾,以便日后复核。

---

## 1. 武将立绘 —— AI 生成,授权状况未确认 ⚠️

**规模**:`public/portraits/` 共 2,429 个 `.webp`,62.5 MB,**全部已入 git**。
其中 233 张签名卡带全身立绘(`*-full.webp`),其余为 200px 宽的头像缩略图。

**链路**(逐段有码可查):

1. `scripts/import-content.ts` 顶部注释写明:从姊妹仓库
   **ThreeKingdomMastersIOS**(素材源头,只读)复制立绘;
   非签名卡由 `sharp` 生成缩略图(同文件,`THUMB_WIDTH = 200`)。
2. 姊妹仓库的 `portraits-checklist.md` 写明来源是 **`wujiang-portrait-forge.html`**。
3. 该文件的 `<title>` 是「**武将提示词工坊**」,正文中出现
   **Midjourney**(2 处)、**Stable Diffusion**(1 处)、「提示词」(8 处)。
4. 之后由 `scripts/import-portraits.py` 用 YuNet 人脸检测统一裁切入库。

**据此可以说**:立绘是按提示词经 AI 图像模型生成的产物,再统一裁切。

**不确定的部分(如实标注,不做推测)**:

- 仓库里**没有逐图的出处记录** —— 哪张图用了哪个模型、哪一天生成、
  用的哪个账号的订阅,都无从查起。
- **没有服务条款的存档**。Midjourney 与 Stable Diffusion 对商用的授权口径
  不同,且随订阅档位与版本变化;当时适用的是哪一版,无法从代码判断。
- 姊妹仓库 `portraits-src/` 下有 1,607 个源图文件,**是否全部为自产**
  无法确认 —— checklist 只记录了匹配情况,没有记录每张的来源。

**这意味着什么**:上架前需要确认(a)所用模型当时的服务条款是否允许商用,
(b)有没有混入非自产图。这两件事代码层面做不了,只能由你判断。

**核对方式**:`scripts/import-content.ts` 的头部注释与 554/582 行;
姊妹仓库的 `portraits-checklist.md:3` 与 `wujiang-portrait-forge.html`。

---

## 2. 四屏底图 —— 同一来源,同样未记录

`public/art/` 下 5 张 `.webp`(标题、牌桌、调度、胜、败),共 652 KB。
由 `import-content.ts:462-483` 从姊妹仓库 `public/` 复制而来,
**来源同样没有记录**。风险与第 1 节相同。

(这 5 张原本是 JPG 共 1.5 MB,2026-07 转成 WebP。)

---

## 3. 字体 —— 有正规许可 ✅

**马善政毛笔楷书(Ma Shan Zheng)**,SIL Open Font License 1.1。

- 许可证全文随包:`public/fonts/OFL-MaShanZheng.txt`
- 子集化到 28 个仪式用字(勝敗和斬、牌匾、印章、空态字形),8.8 KB
- 产物:`public/fonts/brush.woff2`,由 `--font-brush` 引用(`src/index.css`)

OFL 允许嵌入与再分发,包括商用;要求保留许可证文件(已随包)。

---

## 4. 历史人物、传记与台词

卡牌数据、人物传记、单挑台词导入自姊妹仓库(`import-content.ts:8-16`)。
姊妹仓库 `README.md:39-41` 的声明:

> Personal project — all rights reserved.
> 歷史人物與事件屬於公共領域;遊戲代碼與文案版權所有。

历史人物与史实属于公有领域;改写的传记与台词是本项目的原创文案。

---

## 5. 代码依赖 —— 干净 ✅

- 运行时依赖只有三个:`react` / `react-dom` / `zustand`(全部 MIT)
- `npm audit --omit=dev` → **0 vulnerabilities**(CI 已接入此闸门)
- 含 dev 依赖有若干 high,全在 `eslint`/`workbox` 的 `brace-expansion` 链上,
  不进浏览器产物;修它需要 `--force` 的破坏性升级,故不卡门
- **零第三方 SDK**:`index.html` 无外部脚本,字体自托管,埋点只写本机

---

## 6. 会出网的请求(全清单)

隐私政策(`PRIVACY.md`)基于这份清单撰写,两者要一起改。

| 请求 | 内容 | 目的地 |
|---|---|---|
| `POST /api/leaderboard` | 昵称、当日胜场、随机 playerId | 同源 Vercel 函数 |
| `GET /api/leaderboard` | — | 同源 |
| `GET {server}/rating` `/ladder` | playerId | 玩家自填或默认的联机服务器 |
| `GET/PUT/POST {server}/profile` | 存档快照、归属密钥 | 同上 |
| `GET {server}/room/watch/:code` | 房间码 | 同上 |
| WebSocket `/queue` `/room/*` `/match/:id` | 对局指令与状态 | 同上 |

`{server}` 默认是 `localhost:8787`(见 `src/app/protocol.ts` 的 `DEFAULT_SERVER`)
—— 也就是说**未配置服务器时,除排行榜外没有任何请求会真的出网**。
