# HG06 报告：商店页改成技能页布局

日期：2026-11-05。分支 `hg06-native-store`，先 rebase 到 `origin/claude/project-thread-7hcvdn`（带上 HC01 的 vitest），再按 HK03 实机核验改布局。没有改 `apps/desktop/`，没有改 `store-types.ts`、`store-route.tsx`、`preset/`。没有操作本机 Hermes，没有截图。

## 改了什么

- 不再用 `CatalogSurface`。商店页自己按 `capabilities-scroll` → `catalog-discovery` → `catalog-section-heading` + `CatalogCard` 拼，底部没有 `CatalogDeveloper`（「Developer Mode / Build for Hermes」）。
- 场景套装放在顶部「精选」，用原生 `CatalogFeaturedSlider`。现在只有 1 个套装，滑块不画翻页点。
- 「通用 Bot」改成 `catalog-feature-row` 里的 `compact` 卡，不再用两列横幅。
- 搜索框右边的「刷新技能」去掉了。
- 筛选条不再用 `CatalogFilterBar`，所以没有「分类 / Tier」切换，也没有「Official」。主行只留「全部 / 场景套装 / 通用 Bot」，标签和排序（默认 / 名称）在「标签」里。
- 空状态标题是「没有找到相关的 Bot」。加载和失败提示也不再走技能页的「刷新技能」。
- `SDK_REEXPORTS` 抽到 `bot-store/sdk-reexports.mjs`，打包脚本照旧整模块改指向 `@hermes/plugin-sdk`。新增 `bot-store/sdk-map.test.ts`：顺着插件实际会打进去的源码，收集这些模块的运行时导入名，断言每个名字都在 `apps/desktop/src/sdk/index.ts` 里导出。

## 和原生技能页不一样的地方

- 卡片没有配图。打包把 `import.meta.glob` 换成了空函数，原生靠它收集的封面图在插件里是空的，`CatalogCard` 没有 `imageUrl` 就不画图。
- 精选区标题写死「精选」，不是技能页的「Discover 技能」。只有一个套装时不显示翻页点，这和滑块组件「少于两张就只渲染那一张」的行为一致。
- 没有开发者横幅，没有来源 / Tier 切换，没有「刷新技能」。
- 商店自己的标题、分区、空状态是中文，不跟界面语言走。详情弹窗里原生组件的「仓库」「依赖」等仍走应用的 i18n。
- 通用 Bot 用的是技能页的 4 列 compact 卡，不是技能页下面那套 bento。

## 命令结果

`npx vitest run --config bot-store/vitest.config.ts --reporter=verbose`（Node 26.13.0）：

```
 ✓ |bot-store| patches.test.ts > official source patches > create-dialog anchors each appear once and the patch inserts the preset hooks 3ms
 ✓ |bot-store| patches.test.ts > official source patches > replaces each text-patch anchor and keeps the inserted text 2ms
 ✓ |bot-store| src/preset/queue.test.ts > preset queue > appends presets as they are queued 3ms
 ✓ |bot-store| src/preset/queue.test.ts > preset queue > shifts the first preset off the queue 0ms
 ✓ |bot-store| src/preset/queue.test.ts > preset queue > dequeues a kit one bot at a time 0ms
 ✓ |bot-store| src/preset/apply.test.ts > applyPreset > configures toolsets, adds mcp with config, then installs skills 4ms
 ✓ |bot-store| src/preset/apply.test.ts > applyPreset > continues after a failed step and notifies the failures 2ms
 ✓ |bot-store| src/store/catalog.test.ts > parseCatalog > reads the store catalog as 3 bots and 1 kit 22ms
 ✓ |bot-store| src/store/catalog.test.ts > parseCatalog > skips invalid entries instead of failing the whole catalog 3ms
 ✓ |bot-store| sdk-map.test.ts > SDK re-export map > every name imported through a mapped module is exported by the plugin SDK 176ms

 Test Files  5 passed (5)
      Tests  10 passed (10)
   Start at  21:13:28
   Duration  518ms
```

`npx tsc -p bot-store/tsconfig.json --noEmit`：退出码 0，没有输出。

`node bot-store/build-bots-plus.mjs`：

```
  bot-store\dist\hermes-bots-plus\plugin.js  1.6mb

Done in 4781ms
已生成 F:\Hermes改造\hermes-agent-cursor\bot-store\dist\hermes-bots-plus\plugin.js
```

`plugin.js` 大小：1,720,962 字节。`dist/` 仍被 gitignore，没有提交。
