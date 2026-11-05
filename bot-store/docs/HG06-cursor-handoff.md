# HG06 任务交接与接盘指南 (For Cursor / Next Agent)

> **任务标识**: HG06 商店页改原生样式  
> **代码仓库**: `F:\Hermes改造\hermes-agent`  
> **当前分支**: `hg06-native-store` (基于 `origin/claude/project-thread-7hcvdn`)  
> **交接时间**: 2026-11-05  

---

## 一、任务背景与核心要求

### 1. 任务背景
在此前的改造中，Bot 商店已实现了“点击添加 → 弹出原生新建机器人窗口（自动预填好属性）”。但商店页面自身此前依然使用的是 G03 的自定义设计风格。
**本次任务目标**：将商店页彻底重构为 **Hermes 原生“能力 → 技能 / 插件”** 视觉与交互风格（复用 `CatalogSurface`、`CapabilitySearch`、`CatalogFilterBar`、`CatalogDetailDialog` 等原生组件）。

### 2. 硬性红线与约束
1. **严禁修改 `apps/desktop/` 下任何官方文件**（只能只读 import）。
2. **严禁修改 `bot-store/src/store/store-types.ts`、`store-route.tsx`、`preset/` 目录**。
3. **Props 签名完全兼容**：`StorePageProps` 不增删任何字段。
4. **零状态模块重复打包**：凡是主程序 `@hermes/plugin-sdk` 已经导出的带全局状态模块（i18n、queryClient、主题、Dialog/Popover Context 等），严禁以 `@/` 复制进插件，必须在构建期 external 并重定向回 SDK。
5. **零硬编码颜色值，无新增 npm 依赖**。
6. **最终交付物**：
   - 提交分支 `hg06-native-store`（Commit 信息以 `HG06:` 开头）并 push。
   - 交付文档 `bot-store/docs/HG06-report.md`（含组件清单、打包改动、浅色/深色对比截图、与原生差异说明）。

---

## 二、当前完成进度 (已 100% 调通代码与打包)

### 1. 代码改动清单 (仅改动 2 个文件，Git 工作区干净)
- **`bot-store/src/store/StorePage.tsx`**:
  - 彻底移除 G03 样式自绘代码。
  - 直接引入原生组件：
    - `CapabilitySearch` (`@/app/capabilities/ui/capability-search`)
    - `CatalogFilterBar` (`@/app/capabilities/catalog/catalog-filter-bar`)
    - `CatalogSurface` (`@/app/capabilities/ui/catalog-surface`)
    - `CatalogDetailDialog` (`@/app/capabilities/catalog/catalog-detail-dialog`)
  - **顶部**：原生 `.catalog-search-header` 样式，大标题“Bot 商店”+ 描述文案 + 原生搜索框。
  - **筛选栏**：原生 `CatalogFilterBar`，分类筛选（全部 / 场景套装 / 通用 Bot）、标签多选、已添加（`installedOnly`）开关、排序选择（精选 / 首字母）。
  - **内容分区**：使用 `CatalogSurface`，划分为两个原生分区：
    - `kit`（场景套装）：`layout: 'feature'`，呈现 `compact` 高卡；
    - `general`（通用 Bot）：`layout: 'list'`，呈现 `horizontal` 横幅卡。
  - **卡片按钮状态**：对接 `InstallState`：未添加显示“添加”（触发官方创建窗口预填），排队中转圈，已添加显示“打开”。
  - **详情弹窗**：点击卡片唤起 `CatalogDetailDialog`，展示详细介绍、requires 依赖徽章、预设清单（工具集 / 技能 / MCP / 人格），若为套装则展示包含的子 Bot 列表（支持下钻点击）。

- **`bot-store/build-bots-plus.mjs`**:
  - **SDK External 拦截器**：定义了 40+ 个原生模块白名单（`@/i18n`、`@/lib/query-client`、`@/components/ui/*`、`@/lib/time` 等），只要打包遇到直接重定向为 `{ path: '@hermes/plugin-sdk', external: true }`，彻底防止状态割裂与 i18n 副本问题。
  - **CSS 拦截置空**：前置拦截 `.css` 文件，返回空内容 `{ contents: '' }`，避免触发原生 css 内对 `.svg` 静态资源的 loader 报错，且主程序已在全局注入样式。
  - **`import.meta.glob` 规避**：在 esbuild `banner` 中注入 `const __emptyGlob = () => ({});`，并通过 `define: { 'import.meta.glob': '__emptyGlob' }` 避免 Vite 宏在 esbuild 中报错。
  - **Windows 路径防坑**：`findSource` 函数使用 `statSync(p, { throwIfNoEntry: false })?.isFile()` 避开 Windows 同名目录误判为文件的 `Incorrect function` 异常。

### 2. 静态验证与构建数据
- **TypeScript 类型检查**:
  ```powershell
  $env:PATH = "C:\Users\30882\AppData\Local\hermes\tools\node-26.12.1-win32-x64;$env:PATH"
  npx tsc -p bot-store/tsconfig.json --noEmit
  # 结果：0 报错，完全通过！
  ```
- **Esbuild 打包构建**:
  ```powershell
  node bot-store/build-bots-plus.mjs
  # 结果：构建成功，耗时 ~4.6s
  ```
- **产物体积与审计**:
  - 基准原版：`1,686,316` 字节 (1.61 MB)
  - 原生化改造后：`1,724,102` 字节 (1.64 MB)
  - 增量控制：**仅 +37.7 KB**！
  - 被打包进来的 `@/` 模块审计（共 15 个纯 UI 展示组件，零全局状态模块）：
    - `src/app/capabilities/catalog/catalog-card.tsx`
    - `src/app/capabilities/catalog/catalog-detail-dialog.tsx`
    - `src/app/capabilities/catalog/catalog-filter-bar.tsx`
    - `src/app/capabilities/catalog/filter-utils.ts`
    - `src/app/capabilities/catalog/types.ts`
    - `src/app/capabilities/ui/badge-icon.tsx`
    - `src/app/capabilities/ui/capability-search.tsx`
    - `src/app/capabilities/ui/catalog-art-strip.tsx`
    - `src/app/capabilities/ui/catalog-empty-state.tsx`
    - `src/app/capabilities/ui/catalog-layout.tsx`
    - `src/app/capabilities/ui/catalog-masonry.tsx`
    - `src/app/capabilities/ui/catalog-row.tsx`
    - `src/app/capabilities/ui/catalog-section.tsx`
    - `src/app/capabilities/ui/catalog-surface.tsx`
    - `src/app/capabilities/ui/catalog-types.ts`
- **自动部署**:
  构建脚本已自动将产物复制部署至本地 Hermes 插件目录：
  `C:\Users\30882\AppData\Local\hermes\desktop-plugins\hermes-bots-plus\plugin.js`

---

## 三、接盘后剩余要做的事情 (Action Items for Cursor)

目前所有代码与构建已完全通过，仅剩余**实机效果截图**与**报告交付**。

### Step 1: 启动 Hermes 并进行 UI 视觉核验
1. 启动命令或通过桌面快捷方式打开 Hermes：
   - 路径：`C:\Users\30882\AppData\Local\hermes\hermes-agent\apps\desktop\release\win-unpacked\Hermes.exe`
2. 打开 Hermes 后，点击左侧导航栏的 **BOTS**，再点击顶部/侧边的 **“Bot 商店”**（或商店入口）。
3. 核验要点：
   - [ ] 页面顶部：显示“Bot 商店”标题与描述，原生搜索框是否正常筛选；
   - [ ] 筛选栏：切换“全部 / 场景套装 / 通用 Bot”，标签多选，排序切换，已添加开关；
   - [ ] 列表区：套装是否展示为高卡，通用 Bot 是否展示为横幅卡；
   - [ ] 按钮状态：未添加 Bot 显示“添加”，点击后能正确唤起创建窗口；
   - [ ] 详情弹窗：点击卡片任意非按钮区域，是否弹出原生 `CatalogDetailDialog`，并展示依赖、预设与套装内子 Bot。

### Step 2: 截取对比图片 (浅色 + 深色各一套)
将截图保存至 `bot-store/docs/screenshots/`：
1. **浅色模式 (Light Mode)**:
   - `01-store-home-light.png`: Bot 商店主页
   - `02-store-detail-light.png`: Bot 详情弹窗
   - `03-skills-native-light.png` 或并排对比图: 对比“能力 → 技能”页
2. **深色模式 (Dark Mode)**（在设置中切换为深色模式）:
   - `04-store-home-dark.png`: Bot 商店主页
   - `05-store-detail-dark.png`: Bot 详情弹窗
   - `06-skills-native-dark.png` 或并排对比图: 对比“能力 → 技能”页

### Step 3: 完善交付报告 `bot-store/docs/HG06-report.md`
根据模版（见下文第四节）填充报告内容，重点说明：
1. 复用的原生组件列表；
2. 构建脚本改造与 SDK 模块重定向机制；
3. 打包前后体积对比数据（1,686,316 → 1,724,102 字节，+37.7 KB）；
4. 浅色和深色截图；
5. 与原生页面的差异说明（因置空 `import.meta.glob`，原生技能卡片的随机插画在 Bot 商店退化为使用 Bot 自带的统一图标/色块背景，不影响功能）。

### Step 4: Git 提交与推送
```bash
git add bot-store/build-bots-plus.mjs bot-store/src/store/StorePage.tsx bot-store/docs/
git commit -m "HG06: Restyle Bot Store with Hermes native capabilities catalog layout"
git push origin hg06-native-store
```

---

## 四、附录：报告模板 (`bot-store/docs/HG06-report.md`)

```markdown
# HG06 商店页改原生样式交付报告

## 1. 概述
本次改动将 Bot 商店页面由 G03 自绘风格重构为 Hermes 原生“能力 → 技能 / 插件”样式，实现了与主程序完全统一的视觉与交互体验。

## 2. 复用的原生组件
- \`CapabilitySearch\`: 原生搜索输入框（集成过滤与清空交互）
- \`CatalogFilterBar\`: 分类筛选、标签组多选、已添加过滤、排序控件
- \`CatalogSurface\`: 分区布局容器（支持 feature / list 多种网格形态）
- \`CatalogCard\`: 原生卡片呈现（高卡 compact + 横幅卡 horizontal）
- \`CatalogDetailDialog\`: 原生详情弹窗（依赖 requires、预设清单、套装子列表）

## 3. 构建脚本改动 (\`build-bots-plus.mjs\`)
- **SDK 重定向机制**：将 40+ 个原生状态模块（i18n、queryClient、Button、Dialog 等）在打包时重定向至 \`@hermes/plugin-sdk\`，避免重复打包导致全局状态割裂。
- **CSS 拦截**：置空原生组件的 \`.css\` 导入，复用主程序全局已加载样式，避免打包缺少 svg loader 报错。
- **Vite 宏垫片**：通过 banner 与 define 优雅将 \`import.meta.glob\` 替换为空函数。
- **打包体积对比**：
  - 改造前基准：1,686,316 字节 (1.61 MB)
  - 改造后产物：1,724,102 字节 (1.64 MB)
  - 体积增量：仅 +37.7 KB

## 4. 与原生页面的微小差异
- **卡片插图 (Art Cover)**：原生技能页部分卡片依赖 \`import.meta.glob('../../assets/catalog-*.jpg')\` 动态加载艺术背景图。插件打包环境中置空了该宏，Bot 卡片优雅回退为使用 Bot 专属的 Codicon 图标与色块标识，符合 Bot 商店规范。

## 5. 效果截图
### 浅色模式
- 商店主页：![商店主页-浅色](./screenshots/01-store-home-light.png)
- 详情弹窗：![详情弹窗-浅色](./screenshots/02-store-detail-light.png)
- 技能页对比：![技能页对比-浅色](./screenshots/03-skills-native-light.png)

### 深色模式
- 商店主页：![商店主页-深色](./screenshots/04-store-home-dark.png)
- 详情弹窗：![详情弹窗-深色](./screenshots/05-store-detail-dark.png)
- 技能页对比：![技能页对比-深色](./screenshots/06-skills-native-dark.png)
```
