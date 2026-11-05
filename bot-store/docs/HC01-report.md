# HC01 报告：Bot 商店插件自动化测试

日期：2026-11-05 · 分支 `hc01-tests`（基于 `origin/claude/project-thread-7hcvdn` @ `6e500140`）

## 命令

仓库根目录、Node 26.13.0：

```
npx vitest run --config bot-store/vitest.config.ts
npx tsc -p bot-store/tsconfig.json --noEmit
node bot-store/build-bots-plus.mjs
```

README 里写的是同一条 vitest 命令。本机默认 Node 是 24.19.0，不满足根目录 `engines`（`node >= 26`，且 `engine-strict=true`），所以上面三条是用 Node 26.13.0 / npm 11.20.0 跑的。

## 测试列表和结果

9 个测试，4 个文件，全部通过。`--reporter=verbose` 的输出：

```
 RUN  v4.1.12 F:/Hermes改造/hermes-agent/bot-store

 ✓ |bot-store| src/preset/queue.test.ts > preset queue > appends presets as they are queued 3ms
 ✓ |bot-store| src/preset/queue.test.ts > preset queue > shifts the first preset off the queue 0ms
 ✓ |bot-store| src/preset/queue.test.ts > preset queue > dequeues a kit one bot at a time 0ms
 ✓ |bot-store| src/preset/apply.test.ts > applyPreset > configures toolsets, adds mcp with config, then installs skills 4ms
 ✓ |bot-store| src/preset/apply.test.ts > applyPreset > continues after a failed step and notifies the failures 2ms
 ✓ |bot-store| patches.test.ts > official source patches > create-dialog anchors each appear once and the patch inserts the preset hooks 4ms
 ✓ |bot-store| patches.test.ts > official source patches > replaces each text-patch anchor and keeps the inserted text 3ms
 ✓ |bot-store| src/store/catalog.test.ts > parseCatalog > reads the store catalog as 3 bots and 1 kit 22ms
 ✓ |bot-store| src/store/catalog.test.ts > parseCatalog > skips invalid entries instead of failing the whole catalog 3ms

 Test Files  4 passed (4)
      Tests  9 passed (9)
   Start at  16:26:57
   Duration  593ms (transform 312ms, setup 0ms, import 679ms, tests 51ms, environment 0ms)
```

跑的时候 Vite 会提示 `vitest.config.ts` 被当成 CommonJS 加载（bot-store 没有自己的 `package.json`，最近的包是仓库根，不是 `"type": "module"`）。配置仍然生效，测试是通过的。没有为消掉这行警告去加 `package.json`。

`npx tsc -p bot-store/tsconfig.json --noEmit` 退出码 0，没有错误。

`node bot-store/build-bots-plus.mjs` 成功：

```
  bot-store\dist\hermes-bots-plus\plugin.js  1.6mb

Done in 773ms
已生成 F:\Hermes改造\hermes-agent\bot-store\dist\hermes-bots-plus\plugin.js
```

`dist/` 仍在 `bot-store/.gitignore` 里，没有提交。

## 抽 patches.mjs 时改了什么

`build-bots-plus.mjs` 里这两块挪到了 `bot-store/patches.mjs`，打包脚本改为 import：

- `patchCreateDialog`，以及它用的 `insertAt`。三个锚点导出为 `CREATE_DIALOG_ANCHORS`，函数仍用同一批字符串。
- 文本补丁表，导出为 `TEXT_PATCHES`：`i18n.ts` 的 `usePluginI18n('hermes-bots')`，`profile-ops.ts` 的 `queryKey: ['hermes-bots', 'roster']`。原来的「找不到锚点就抛错，否则 `split`/`join`」收成 `applyTextPatch`，错误文案保持原样。

插入的 import 路径仍是 `bot-store/src/preset/queue` 和 `bot-store/src/preset/apply` 的绝对路径。`shared.ts` 里把插件 id 换成 `hermes-bots-plus` 的那一处不在这张表里，留在打包脚本里。

插件行为没有改。

## 写测试时看到、但没有改的行为

1. **`profile-ops.ts` 的花名册 queryKey 出现两次**，不是一次。一处在头像 data URL 推送（约第 86 行），一处在 SVG 光栅化（约第 113 行），字符串都是 `queryKey: ['hermes-bots', 'roster']`。`create-dialog.tsx` 的三个锚点和 `i18n.ts` 的锚点都恰好一次。文本补丁本来就是全部替换，所以两处都会变成 `hermes-bots-plus`。测试把当前次数锁成 2：变成 0 说明锚点丢了，次数变了说明官方又改了一处。没有改补丁，也没有改官方文件。

2. **颜色不是 `#rrggbb` 时，整条商品不会被跳过。** `parseCatalog` 只把 `color` 留空，Bot 还在。id 有大写或空格、repo 不合法，才会丢掉整条。mcp 没有 preset 也没有 config、requires 的名字带空格，丢掉的是那一项子条目，商品还在。测试按这个行为断言，解析器没改。
