# G03 Bot 商店页面界面（独立组件 + 假数据预览）交付报告

## 一、交付文件清单

```text
store-ui/
  src/StorePage.tsx        ← 主组件（交付物，零硬编码颜色，严格仅依赖 react 与 @hermes/plugin-sdk）
  src/store-types.ts       ← 原样使用的类型契约（零改动）
  src/mock-catalog.ts      ← 假数据：6 个通用 Bot + 2 个场景套装
  preview/                 ← Vite 独立预览环境（main.tsx、index.html、sdk-stub.tsx、styles.css）
  screenshots/             ← 实机渲染截图（浅色、深色+详情抽屉、600px 窄宽度）
  G03-report.md            ← 本报告
```

---

## 二、视觉预览截图

### 1. 浅色模式（Light Mode — 网格卡片与状态标识）
![浅色模式](./screenshots/light-mode.png)

### 2. 深色模式（Dark Mode — 场景套装详情抽屉、子 Bot 列表与依赖检查）
![深色模式](./screenshots/dark-mode.png)

### 3. 窄宽度模式（600px 容器查询单列自适应，无横向滚动条）
![窄宽度 600px](./screenshots/narrow-600px.png)

---

## 三、架构与设计取舍（Design & Engineering Trade-offs）

### 1. 容器查询（`@container`）替代传统视口媒体查询（`@media`）
- **背景**：Bot 商店在 Hermes Desktop 主区域渲染时，右侧可能同时开启 Terminal、Preview 或分栏会话，此时商店自身的容器宽度小于 600px，但整个 Electron 窗口宽度仍在 1280px 以上。
- **取舍**：在 `StorePage` 根节点声明 `@container`，使用 `@min-[601px]:grid-cols-2 @min-[920px]:grid-cols-3` 与 `@min-[601px]:w-64` 控制卡片网格列数与搜索框宽度；抽屉层采用 `absolute inset-0` 锚定在 `StorePage` 容器内而非全局 `fixed`。这样无论窗口缩放还是面板分栏挤压至 600px，均能精准切换为单列且零横向溢出（实测 `windowOverflow: false, rootOverflow: false, mainOverflow: false`）。

### 2. 伪元素拉伸热区（Stretched-Link Pattern）解决卡片嵌套按钮无障碍冲突
- **背景**：整张卡片可点开详情，同时右下角又有独立的「安装 / 打开 / 重试」按钮。若直接给 `<article>` 设置 `role="button" tabIndex={0}`，会造成按钮嵌套按钮的 WAI-ARIA 违规，且键盘按下 `Enter`/`Space` 触发内部按钮时事件冒泡会误打开抽屉。
- **取舍**：遵循 Hermes `CatalogCard` 的无障碍范式，将卡片标题封装为 `<button type="button" className="... after:absolute after:inset-0">` 覆盖整卡点击与聚焦外框，右下角操作区设置 `relative z-10` 独立于主点击层。既保证了鼠标整卡可点，又让键盘 `Tab` 焦点在「查看卡片详情」与「执行安装/打开」之间清晰分离。

### 3. 详情抽屉的 200ms 退场保活与 `inert` 焦点隔离
- **背景**：纯 CSS 过渡实现右侧滑入/滑出（`duration-200`）时，若 `selectedId` 置空导致抽屉内部立即卸载，滑出动画会变成一块空白面板；若保留 DOM 但仅用 `opacity-0 pointer-events-none`，隐藏后的按钮仍会留在键盘 `Tab` 焦点链中。
- **取舍**：使用 `lastItemRef` 在退场动画期间保持抽屉内容渲染，并在抽屉关闭态同步施加 HTML 原生 `inert` 与 `invisible` 属性，确保动画丝滑且关闭后零幽灵焦点。

### 4. 套装与成员 Bot 的抽屉内钻取与返回闭环
- **背景**：点击「场景套装」打开抽屉后，用户常需确认其中某个子 Bot 的具体功能与依赖。
- **取舍**：在套装详情的「包含的 Bot」列表中，每项不仅显示该子 Bot 的实时已安装绿勾，还提供「查看」按钮直接切换至该子 Bot 详情，并在抽屉顶部自动生成「← 返回『套装名』」导航条，避免用户关闭抽屉重新查找。

### 5. 严格遵守 CSS 变量与 SDK 边界
- **零硬编码色值**：全文仅使用 `--ui-text-secondary`、`--ui-text-tertiary`、`--ui-text-quaternary`、`--ui-accent`、`--ui-stroke-secondary`、`--ui-bg-primary`、`--ui-bg-secondary`、`--ui-success`、`--ui-warning` 九个变量，通过 Tailwind v4 原生语法（如 `bg-(--ui-bg-secondary)`、`border-(--ui-stroke-secondary)`、`bg-(--ui-text-secondary)/20`）组合出深浅色自适应的层次感。
