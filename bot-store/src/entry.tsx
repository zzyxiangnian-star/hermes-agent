// hermes-bots-plus 入口：原样复用官方 Bot 模式插件，再加上 Bot 商店。
// 官方文件一行不改；我们的改动通过构建时替换模块（见 build-bots-plus.mjs）接入。
import type { PluginContext } from '@hermes/plugin-sdk'

import official from '@official-bots/plugin'

import { injectPluginCss } from './inject-css'
import { registerStore } from './store/register'

export default {
  ...official,
  // 名字和内置的“Bots”区分开，否则插件页里两个都叫 Bots，搜不到也分不清。
  name: 'Bots 改造版',
  description: 'Bot 模式（个人改造版）：官方 Bot 模式 + Bot 商店 + 每个 Bot 多个对话。',
  register(ctx: PluginContext) {
    official.register(ctx)
    injectPluginCss(ctx)
    registerStore(ctx)
  }
}
