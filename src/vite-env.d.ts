/// <reference types="vite/client" />

interface ImportMetaEnv {
  /**
   * 非签名卡立绘的 CDN 基址(如 `https://cdn.example.com/portraits/`)。
   * 留空 = 只用随包立绘,其余卡走拓印兜底(默认行为)。
   * 产物用 `npm run export-portraits` 生成后上传到任意静态托管。
   */
  readonly VITE_PORTRAIT_CDN?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
