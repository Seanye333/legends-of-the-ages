// 立绘取图策略(包体红线的落地实现)
//
// 全池 2,250 张卡,立绘素材共 400MB+,不可能全部随包。分层:
//   1. 签名卡立绘随包 —— `public/portraits/`,由 `npm run import-content` 复制,
//      清单落在 `src/content/generated/manifest.json`(下方读它来判断「本地有没有」,
//      所以不会对随包里根本不存在的文件发请求)。
//   2. 其余卡走可选 CDN —— `VITE_PORTRAIT_CDN` 指向一个静态托管目录
//      (产物由 `npm run export-portraits` 生成)。
//   3. 都没有 → Portrait 组件的「拓印风」兜底字形。
//
// 关键约束:**未配置 VITE_PORTRAIT_CDN 时行为与从前完全一致** —— 非签名卡直接走
// 兜底字形,一个网络请求都不发(从前是发一发 404 再兜底,现在连 404 都省了)。
import manifest from '../content/generated/manifest.json'
import { CARDS_BY_ID } from '../content/cards'

interface PortraitManifest {
  portraits: Record<string, { files: string[]; bytes: number }>
}

/** 随包立绘的文件名集合(如 `guan-yu.webp` / `guan-yu-full.webp`) */
const LOCAL_FILES: ReadonlySet<string> = new Set(
  Object.values((manifest as PortraitManifest).portraits).flatMap((p) => p.files),
)

function normalizeBase(raw: string | undefined): string {
  const v = (raw ?? '').trim()
  if (!v) return ''
  return v.endsWith('/') ? v : `${v}/`
}

/** CDN 基址;空串 = 未配置(默认) */
export const PORTRAIT_CDN = normalizeBase(import.meta.env.VITE_PORTRAIT_CDN)

const LOCAL_BASE = `${import.meta.env.BASE_URL}portraits/`

/**
 * 立绘只对武将/主公存在 —— 锦囊(strat-*)、装备(eq-*)天生没有画像。
 * 不做这层判断的话,配了 CDN 后每张锦囊都会去撞一次必然的 404。
 * 未登记在卡池里的 id(主公 id 同时也是武将 id,恒在池中)按「可能有图」处理。
 */
function couldHaveArt(id: string): boolean {
  const def = CARDS_BY_ID[id]
  return def === undefined || def.type === 'general'
}

/**
 * 按优先级返回候选 URL:本地全身 → CDN 全身 → 本地头像 → CDN 头像。
 * 返回空数组表示「无图可取」,调用方应直接兜底,不要发请求。
 */
export function portraitCandidates(id: string, full = false): string[] {
  const out: string[] = []
  const cdn = couldHaveArt(id) ? PORTRAIT_CDN : ''
  if (full) {
    if (LOCAL_FILES.has(`${id}-full.webp`)) out.push(`${LOCAL_BASE}${id}-full.webp`)
    if (cdn) out.push(`${cdn}${id}-full.webp`)
  }
  if (LOCAL_FILES.has(`${id}.webp`)) out.push(`${LOCAL_BASE}${id}.webp`)
  if (cdn) out.push(`${cdn}${id}.webp`)
  return out
}

/** 跨源图片画到 canvas 会污染画布 → 导出卡面时必须带 crossOrigin */
export function isCrossOrigin(url: string): boolean {
  if (typeof location === 'undefined') return false
  if (!/^https?:\/\//i.test(url)) return false
  try {
    return new URL(url, location.href).origin !== location.origin
  } catch {
    return false
  }
}

// ---------- 解析结果缓存 ----------
// 同一张卡在图鉴/手牌/战场/详情里会挂载很多次。缓存「第几个候选成功了」,
// 重新挂载时直接从那一档起步,不再重放前面已知失败的候选(避免重复 404)。
// 值 = 候选下标;等于候选数组长度表示「全都失败,直接兜底」。

const resolvedStage = new Map<string, number>()

const key = (id: string, full: boolean) => `${id}|${full ? 'f' : 'h'}`

export function cachedStage(id: string, full: boolean): number {
  return resolvedStage.get(key(id, full)) ?? 0
}

export function rememberStage(id: string, full: boolean, stage: number): void {
  const k = key(id, full)
  const prev = resolvedStage.get(k)
  if (prev === undefined || stage > prev) resolvedStage.set(k, stage)
}
