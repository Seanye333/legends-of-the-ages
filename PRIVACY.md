# 隐私政策 / Privacy Policy

最后更新:2026-07-30

这份政策描述的是**代码实际做的事**,不是模板。每一条都能在仓库里查到出处;
会出网的请求全清单在 [ASSET-PROVENANCE.md](ASSET-PROVENANCE.md) 第 6 节。

---

## 简版

- **没有账号,不要邮箱、手机号或任何身份信息。**
- **游戏进度存在你自己的设备上**(浏览器 localStorage)。
- **零第三方 SDK,零广告,零追踪。** 运行时依赖只有 React 与 Zustand。
- 只有在你**主动**做这几件事时才会有数据离开设备:填昵称上排行榜、
  开启云存档、进联机对战。不做这些,除排行榜外没有任何请求出网。

---

## 存了什么、存在哪

全部游戏数据存在浏览器的 localStorage,键名以 `qiangu-` 开头,包括:
收藏与卡包、功勋、战绩、自组卡组、各模式进度(冒险/登楼/远征/竞技场)、
成就、每日军令、个人纪录、设置、战报回放。

**这些数据不会自动上传。** 设置页有「清空本地进度」可随时全部删除。

另有两项本机诊断(`src/app/telemetry.ts`):各模式进入次数、最近 20 条崩溃记录。
该文件顶部注释即写明**不上报到任何服务器**;设置页可导出为纯文本,给不给别人由你决定。

## 什么时候有数据离开设备

**1. 每日胜场排行榜(可选)**
只有在你填了昵称之后才会上报,内容是:昵称、当日胜场数、一个本机随机生成的
UUID(`qiangu-player-id`)。这个 UUID 不来自任何设备或广告标识符。
不填昵称就不会有任何上报。

**2. 云存档(可选)**
开启后会把收藏、卡包、功勋、战绩、自组卡组、每日军令进度上传到
**你自己填写的服务器地址**。首次写入时以一个本机随机生成的密钥认领归属(TOFU),
此后没有该密钥的请求一律被拒。密钥只存在你的设备上;
「复制搬迁码」导出的就是它 —— 它等同于账号凭据,别发给别人。

**3. 联机对战(可选)**
进入匹配、房间或观战时,会与联机服务器建立 WebSocket 连接,
传输对局指令与状态、你填的昵称、以及固定的六句表情之一(没有自由聊天)。

**联机服务器由你自己指定**(设置项 `qiangu-server-addr`)。
默认值是 `localhost:8787` —— 也就是说未配置时联机根本不会连到任何外部主机。
若你填了他人运营的服务器,该服务器的隐私实践不在本政策范围内。

## 不做的事

- 不投放广告,不接入任何广告或分析 SDK
- 不做跨应用/跨站追踪(iOS 隐私清单 `NSPrivacyTracking = false`)
- 不读取通讯录、位置、相机、麦克风、相册
  (Tauri capabilities 只有 `core:default`,Info.plist 里一条权限说明都没有,因为确实用不到)
- 不收集设备标识符(IDFA/IDFV 一律不碰)

## 儿童

本作不面向 13 岁以下儿童,也不刻意收集儿童信息。由于根本没有账号系统,
我们无法也不会识别使用者年龄。

## 数据删除

设置页 →「清空本地进度」删除本机全部数据。
若你用过云存档,清空后的版本会在下次同步时覆盖服务器上那份。
要彻底删除服务器副本,请联系你所用服务器的运营者
(自建的话直接删掉对应的 Durable Object 即可)。

## 变更

政策变更会更新本文件顶部的日期。因为没有账号,我们没有通知渠道 ——
建议在版本更新说明里留意。

---

## English (summary)

No accounts, no ads, no third-party SDKs, no tracking. All game data lives in
your browser's localStorage on your own device and is never uploaded automatically.

Data leaves your device only when you opt in: (1) the daily-wins leaderboard,
which sends a nickname you chose, your win count, and a locally generated random
UUID; (2) cloud saves, which upload your collection and progress to **a server
address you enter yourself**, claimed on first write by a locally generated key
(trust-on-first-use); (3) online play, which sends match commands, your nickname
and one of six fixed emotes over a WebSocket to that same server.

The default server address is `localhost:8787`, so with no configuration nothing
reaches any external host except the leaderboard. We do not collect device
identifiers and request no system permissions. Settings → "Reset local progress"
erases everything on the device.
