import type { PluginContext } from '@hermes/plugin-sdk'
import css from 'virtual:bots-plus-css'

const STYLE_ID = 'hermes-bots-plus-css'

/** 注入构建时生成的样式（只含我们文件用到的 Tailwind 类），插件关闭时移除。 */
export function injectPluginCss(ctx: PluginContext) {
  document.getElementById(STYLE_ID)?.remove()
  const style = document.createElement('style')
  style.id = STYLE_ID
  style.textContent = css
  document.head.appendChild(style)
  ctx.onDispose?.(() => style.remove())
}
