import { Fragment, type ReactNode } from 'react'

// `**着重**` → 着重号。
//
// 【为什么需要它】
// 讲堂(ui/codex.ts)的规则说明里有 16 处写着 `**这样**` —— 作者是按 markdown
// 的习惯敲的,而那些文字是直接塞进 <span> 的**纯文本**。
// 于是玩家看到的是一屏「只作用于**左右紧邻**的两名友军」,星号原样露在外面。
// 这个 bug 谁都没发现,因为写文案的人是在源码里读它的,那里星号是对的。
//
// 【为什么是渲染而不是删掉星号】
// 那些着重是有意的:讲堂是全站最长的说明文字,一段五六行里哪半句是关键,
// 靠加粗一眼就能看到。删掉星号等于把作者的判断也一起删了。
//
// 【为什么不引 markdown 库】
// 只要 `**bold**` 这一条。整个 markdown 解析器是几十 KB,而首屏预算只剩十几 KB。
// 而且**返回的是 React 节点不是 HTML 字符串** —— 没有 dangerouslySetInnerHTML,
// 也就没有注入面。文案里将来出现 `<script>` 也只会被当成字面文字显示。
export function emphasize(text: string): ReactNode {
  if (!text.includes('**')) return text
  // 按 ** 切:偶数段是普通文字,奇数段是着重。
  // 星号成对不全时(奇数个),最后那一段会落在「普通」位上原样显示 ——
  // 比抛错或吞掉半句要好。
  const parts = text.split('**')
  return parts.map((p, i) =>
    i % 2 === 1 ? <strong key={i}>{p}</strong> : <Fragment key={i}>{p}</Fragment>,
  )
}
