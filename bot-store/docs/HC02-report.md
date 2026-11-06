# HC02 报告：Bot 对话行的右键菜单

日期：2026-11-06。分支 `hc02-session-menu`，基于 `origin/claude/project-thread-7hcvdn` 的 `7c10bbe5`。没有改 `apps/desktop/`。没有操作本机 Hermes，没有截图。

## 改了什么

- 展开 Bot 之后，每条普通对话用原生 `SessionContextMenu` 包起来（`profile` 是 Bot 名，`sessionId` 用 `session_id || id`，`surface="row"`）。「固定对话」和「新对话」两行没有菜单。
- 不传 `onPin`、`onBranch`、`onArchive`、`onToggleUnread`。重命名、删除可用；导出、复制 ID、在新标签打开这些不用回调的项保持原生菜单原样。置顶、分支、归档、未读仍会显示，但是禁用的。
- 删除走 `deleteSession`。范围和 `listBotSessions` 一样：有路由时带上 `connectionId` 和 `backendTargetProfile`，没有路由时只带 Bot 名。成功后让 `['hermes-bots-plus','sessions', bot.name]` 失效。失败不刷新，并用 `host.notifyError` 提示。
- 原生重命名对话框没有成功回调，官方文件也不能改。打包时在重命名成功通知后面插一行 `globalThis.__hermesBotsPlusOnSessionRenamed?.()`。对话列表挂上这个函数，成功后刷新所有 Bot 的对话查询（补丁不知道是哪一个 Bot）。

## 取舍

- `context-menu`、`dropdown-menu`、`copy-button` 不再整模块改指向 SDK。菜单要用 `ContextMenuLabel` 和 `DropdownMenuSub` 这些 SDK 没有导出的名字，整模块转过去会在加载时报错。这三个文件打进插件，子菜单和「复制 ID」才是同一份实现。
- `@/lib/query-client` 改成垫片：`queryClient` 仍从 SDK 拿，另外补上 SDK 没导出的 `invalidateProfileScopedQueries`。会话菜单会把 profile store 打进来，那个文件会调用这个函数。另做一个 QueryClient 会把技能页的缓存拆成两份。
- 菜单还会带进 `@/store/session`、`@/store/notifications` 等主程序状态。SDK 没有把这些模块导出，不能整份改指向 SDK。删除和重命名的 HTTP 走 `window.hermesDesktop.api`，显式带了 profile，所以请求还是打到这条 Bot 的后端。提示条和「在新标签打开」读的是打进插件的那份 store，不是主界面正在用的那份。
- 菜单上的 `profile` 按任务用 Bot 名。删除用的是后端 profile（别名 Bot 上这两个名字可以不同）。
- `plugin.js` 从 1,720,962 字节涨到 2,680,162 字节，因为会话菜单和它带进来的主程序模块打进了包。`dist/` 没有提交。

## 命令结果

`npx vitest run --config bot-store/vitest.config.ts --reporter=verbose`（Node 26.13.0）：

```
 ✓ |bot-store| src/preset/queue.test.ts > preset queue > appends presets as they are queued 4ms
 ✓ |bot-store| src/preset/queue.test.ts > preset queue > shifts the first preset off the queue 1ms
 ✓ |bot-store| src/preset/queue.test.ts > preset queue > dequeues a kit one bot at a time 1ms
 ✓ |bot-store| src/preset/apply.test.ts > applyPreset > configures toolsets, adds mcp with config, then installs skills 5ms
 ✓ |bot-store| src/preset/apply.test.ts > applyPreset > continues after a failed step and notifies the failures 2ms
 ✓ |bot-store| patches.test.ts > official source patches > create-dialog anchors each appear once and the patch inserts the preset hooks 4ms
 ✓ |bot-store| patches.test.ts > official source patches > replaces each text-patch anchor and keeps the inserted text 4ms
 ✓ |bot-store| patches.test.ts > official source patches > inserts the session-list refresh only after a successful rename 1ms
 ✓ |bot-store| src/store/catalog.test.ts > parseCatalog > reads the store catalog as 3 bots and 1 kit 24ms
 ✓ |bot-store| src/store/catalog.test.ts > parseCatalog > skips invalid entries instead of failing the whole catalog 4ms
 ✓ |bot-store| src/sessions/bot-sessions.test.ts > bot session menu > gives ordinary chats a rename/delete menu and leaves the pinned and new rows alone 14ms
 ✓ |bot-store| src/sessions/bot-sessions.test.ts > bot session menu > deletes on the bot route and session id, then refreshes that bot’s list 3ms
 ✓ |bot-store| src/sessions/bot-sessions.test.ts > bot session menu > does not refresh the list when delete fails 2ms
 ✓ |bot-store| src/sessions/bot-sessions.test.ts > bot session menu > refreshes every bot session list after a successful rename 1ms
 ✓ |bot-store| sdk-map.test.ts > SDK re-export map > every name imported through a mapped module is exported by the plugin SDK 387ms
 ✓ |bot-store| sdk-map.test.ts > SDK re-export map > keeps the shared query client and fills in the profile invalidation the SDK does not export 2ms

 Test Files  6 passed (6)
      Tests  16 passed (16)
   Duration  943ms
```

`npx tsc -p bot-store/tsconfig.json --noEmit`：退出码 0。

`node bot-store/build-bots-plus.mjs`：

```
  bot-store\dist\hermes-bots-plus\plugin.js  2.6mb

Done in 20067ms
已生成 F:\Hermes改造\hermes-agent-cursor\bot-store\dist\hermes-bots-plus\plugin.js
```

`plugin.js` 大小：2,680,162 字节。
