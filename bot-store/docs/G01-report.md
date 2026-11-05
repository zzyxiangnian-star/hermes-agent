# G01 报告：改动点现状 + 外部插件实测

日期：2026-11-05 · 基于 fork commit ed1afb0（官方 main 同步点）· 由 Claude 在云端（Linux）完成

## 结论
1. **外部插件路线跑通。** 打包出的 `hermes-bots-plus/plugin.js` 放进 `$HERMES_HOME/desktop-plugins/` 后正常加载；关掉内置 `hermes-bots` 后，Bots 列表照常显示所有 Bot（含已有的），Console 无报错。截图：`g01-bots-plus.png`。
2. **商店安装不需要后端插件。** `hermes profile install <源> --yes` 实测成功，装好的 Bot 立刻出现在列表里。插件里用 `host.request('cli.exec', { argv: ['profile','install', 源, '--yes'] })` 调用（内置插件删 Bot 已用同一接口）。
3. **多对话只改列表显示。** 固定对话的规则不能动（见下），其余会话本来就有，只需列出来。

## 本机环境要求（重要）
- Node.js **≥ 26**，npm 不在 11.10–11.16 之间（根 package.json `engines`）
- Python **≥ 3.14**（uv.lock 要求）
- 启动：仓库根 `npm install` → `cd apps/desktop` → `npm run dev`
- 网页版（不用 Electron 也能看界面）：`hermes config set webapp.enabled true`，`npm run build:webapp`，`hermes webapp`

## 改动点
| 要改的 | 位置 | 说明 |
|---|---|---|
| 商店入口 | `plugins/hermes-bots/roster-pane-toolbar.tsx` `renderRosterToolbar()`，第 106 行 “Bots” 标题行之前 | 在这里插一行“Bot 商店”按钮 |
| 商店页面 | 同插件内新增 pane（`ctx.register({ area: 'panes' })`，参考 `plugin.tsx` 第 445 行） | 不需要主程序挂载点 |
| 多对话 | `bot-row.tsx`（Bot 行；右键已有 New chat with this agent / Open recent session，第 436–447 行） | Bot 行加展开箭头，列出该 profile 的会话（`session.list`，上限 200），加“+” 调 `newBotChat(bot)` |
| 安装 | `cli.exec`（`tui_gateway/methods_tools.py` 第 445 行），只禁止 setup/gateway/sessions browse/config edit | `profile install` 不在禁止列表 |

## 必须遵守：固定对话规则
`apps/desktop/src/AGENTS.md` “Bot Mode” 一节：每个 Bot 唯一的固定对话 = 该 profile 下标题恰好为 `Bot Chat` 的会话，点 Bot 行永远打开它；官方说这条规则多次回归、丢过用户聊天记录，不接受修改。
→ 多对话的展开列表里，`Bot Chat` 固定置顶，其它会话列在下面；**不改点行为、不改标题规则**。

## Profile Distribution（`hermes_cli/profile_distribution.py`）
- `install_distribution(source, name=None, force=False, create_alias=False)`（第 613 行）
- CLI：`hermes profile install SOURCE [--name NAME] [--alias] [--force] [-y]`；`hermes profile update` 更新时不动记忆和会话
- SOURCE 只能是 **git 仓库地址或本地目录，distribution.yaml 必须在根目录**，不支持仓库子目录
  → 商店设计：**每个 Bot 一个 GitHub 仓库**；`hermes-bot-store` 只放 `catalog.yaml`（Bot 列表、简介、仓库地址、依赖说明）
- 最小 distribution.yaml：`name`、`version`、`description`；可选 `env_requires`（需要的 Key，安装后生成 `.env.example`）

## 已知小问题
- 主程序状态栏 `app/shell/hooks/use-statusbar-items.tsx` 第 161 行写死 `hermes-bots:pane`，外部版面板 id 不同，状态栏这一项不联动。影响小，先不管。
- 插件打包 1.5MB（含 noVNC），能正常加载。
- 关掉内置版后，插件开关存在浏览器 localStorage `hermes.desktop.pluginDecisions.v2`，在 设置 → 插件 里操作即可。
