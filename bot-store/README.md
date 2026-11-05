# Bot 商店改造（个人版）

不改 Hermes 本体：把内置 Bot 模式插件打包成外部桌面插件 `hermes-bots-plus`，
放到 `%LOCALAPPDATA%\hermes\desktop-plugins\hermes-bots-plus\plugin.js`，
在 设置 → 插件 里关掉内置的 Bots，开启 hermes-bots-plus。商店入口和多对话都改在这份里。

- 打包：仓库根目录 `npm install` 后运行 `node bot-store/build-bots-plus.mjs`
- 测试：仓库根目录 `npx vitest run --config bot-store/vitest.config.ts`
- 只改插件 id，Bot 数据键 `ui_meta['hermes-bots']` 保持不变，已有 Bot 照常显示
- 已知：主程序状态栏按 `hermes-bots:pane` 判断 Bots 面板是否打开，外部版的面板 id 不同，状态栏这一项可能不联动
