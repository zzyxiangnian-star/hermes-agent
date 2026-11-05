// 打包 hermes-bots-plus：官方 Bot 模式插件（不改一行）+ 我们的 Bot 商店与多对话。
// 输出：bot-store/dist/hermes-bots-plus/plugin.js
// 用法（仓库根目录 npm install 之后）：node bot-store/build-bots-plus.mjs
// 外部插件只允许 import @hermes/plugin-sdk 和 react*，其余依赖（nanostores、yaml、noVNC）打进包里。
import { compile } from '@tailwindcss/node'
import { Scanner } from '@tailwindcss/oxide'
import { build } from 'esbuild'
import { readFileSync, statSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { applyTextPatch, patchCreateDialog, TEXT_PATCHES } from './patches.mjs'
import { SDK_REEXPORTS as SDK_REEXPORT_LIST } from './sdk-reexports.mjs'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const desktop = resolve(root, 'apps/desktop')
const official = resolve(desktop, 'src/plugins/hermes-bots')
const ours = resolve(root, 'bot-store/src')
const out = resolve(root, 'bot-store/dist/hermes-bots-plus/plugin.js')

// 官方模块里要被我们版本替换的文件：官方文件 import './<名字>' 时改指向 bot-store/src/<名字>.tsx。
// 我们的替换文件再通过 @official-bots/<名字> 拿到官方原版。
const OVERRIDES = ['roster-pane-toolbar', 'bot-row']

// @hermes/plugin-sdk 已经原样导出的主程序模块：当复用的原生 Capabilities 组件通过 @/ 引用它们时，
// 直接映射回外部的 @hermes/plugin-sdk，避免把 i18n Context、QueryClient、Dialog/Popover Portal 等
// 带全局状态的模块复制一份未初始化的副本打进 plugin.js。
const SDK_REEXPORTS = new Set(SDK_REEXPORT_LIST)

const findSource = base =>
  ['', '.tsx', '.ts', '/index.tsx', '/index.ts', '.json']
    .map(ext => base + ext)
    .find(p => statSync(p, { throwIfNoEntry: false })?.isFile())

// 运行时插件不会触发主程序重新生成 Tailwind 样式：主程序没用过的类在插件里无效。
// 所以构建时只扫描我们自己的文件，按主程序的主题生成这些类的 CSS，运行时注入页面。
async function buildPluginCss() {
  const styles = resolve(desktop, 'src/styles.css').replaceAll('\\', '/')
  const input = `@reference "${styles}";\n@import "tailwindcss/utilities.css" layer(utilities);\n`
  const compiler = await compile(input, { base: resolve(desktop, 'src'), onDependency() {} })
  const scanner = new Scanner({ sources: [{ base: ours, pattern: '**/*.{ts,tsx}', negated: false }] })

  return compiler.build(scanner.scan())
}

const pluginCss = await buildPluginCss()

const overlay = {
  name: 'bots-plus-overlay',
  setup(b) {
    // @official-bots/<path> → 官方插件源码
    b.onResolve({ filter: /^@official-bots\// }, args => {
      const path = findSource(resolve(official, args.path.slice('@official-bots/'.length)))

      return path ? { path } : { errors: [{ text: `找不到官方模块 ${args.path}` }] }
    })

    // 主程序已加载所有原生样式，插件包里将 .css 导入置空，不重复打包
    b.onResolve({ filter: /\.css$/ }, () => ({ path: 'empty-css', namespace: 'empty-css' }))
    b.onLoad({ filter: /.*/, namespace: 'empty-css' }, () => ({ contents: '', loader: 'js' }))

    // @/<path> → SDK 已导出的直接转 @hermes/plugin-sdk（外部模块，共享宿主实例）；其余解析到 apps/desktop/src/
    b.onResolve({ filter: /^@\// }, args => {
      if (SDK_REEXPORTS.has(args.path)) {
        return { path: '@hermes/plugin-sdk', external: true }
      }

      const path = findSource(resolve(desktop, 'src', args.path.slice(2)))

      return path ? { path, sideEffects: false } : { errors: [{ text: `找不到主程序模块 ${args.path}` }] }
    })

    // 原生模块内部的相对 import（如 primitives.tsx 里的 '../overlays/panel'），若目标已由 SDK 导出，同样转给 SDK
    b.onResolve({ filter: /^\.\.?\// }, args => {
      if (!args.importer.startsWith(resolve(desktop, 'src')) || args.importer.startsWith(official)) {
        return undefined
      }

      const target = findSource(resolve(dirname(args.importer), args.path))

      if (!target) {
        return undefined
      }

      const rel = '@/' + target.slice(resolve(desktop, 'src').length + 1).replaceAll('\\', '/').replace(/\.(tsx?|js)$/, '').replace(/\/index$/, '')

      if (SDK_REEXPORTS.has(rel)) {
        return { path: '@hermes/plugin-sdk', external: true }
      }

      return { path: target, sideEffects: false }
    })

    // 构建时生成的样式，作为虚拟模块给 inject-css.ts 用
    b.onResolve({ filter: /^virtual:bots-plus-css$/ }, () => ({ path: 'bots-plus-css', namespace: 'virtual' }))
    b.onLoad({ filter: /.*/, namespace: 'virtual' }, () => ({
      contents: `export default ${JSON.stringify(pluginCss)}`,
      loader: 'js'
    }))

    // 官方文件之间的相对 import，命中替换表时改指向我们的版本
    b.onResolve({ filter: /^\.\// }, args => {
      if (dirname(args.importer) !== official) {
        return undefined
      }

      const name = args.path.slice(2).replace(/\.(tsx?|js)$/, '')

      if (OVERRIDES.includes(name)) {
        return { path: findSource(resolve(ours, name)) }
      }

      return undefined
    })

    // 官方“新建机器人”窗口：商店排了预设时预填各项，创建后套用工具集/技能/MCP。
    // 只在打包时往官方文件里插几行，官方源码本身不改；锚点对不上就直接报错，提醒跟进官方更新。
    b.onLoad({ filter: /plugins[\\/]hermes-bots[\\/]create-dialog\.tsx$/ }, args => ({
      contents: patchCreateDialog(readFileSync(args.path, 'utf8')),
      loader: 'tsx'
    }))

    // 官方代码里有两处把 'hermes-bots' 写死了（没用 ID 常量）：文案查找和花名册缓存键。
    // 改了 ID 后不跟着换，新建窗口等处会显示 bot.newTitle 这类原始键名。
    for (const [file, from, to] of TEXT_PATCHES) {
      b.onLoad({ filter: new RegExp(`plugins[\\\\/]hermes-bots[\\\\/]${file.replace('.', '\\.')}$`) }, args => ({
        contents: applyTextPatch(readFileSync(args.path, 'utf8'), from, to, file),
        loader: 'ts'
      }))
    }

    // 只换插件 id，Bot 数据键 ui_meta['hermes-bots'] 不动，已有 Bot 照常显示
    b.onLoad({ filter: /plugins[\\/]hermes-bots[\\/]shared\.ts$/ }, args => ({
      contents: readFileSync(args.path, 'utf8').replace(
        "export const ID = 'hermes-bots'",
        "export const ID = 'hermes-bots-plus'"
      ),
      loader: 'ts'
    }))
  }
}

await build({
  entryPoints: [resolve(ours, 'entry.tsx')],
  outfile: out,
  bundle: true,
  format: 'esm',
  jsx: 'automatic',
  target: 'es2022',
  absWorkingDir: desktop,
  nodePaths: [resolve(desktop, 'node_modules'), resolve(root, 'node_modules')],
  banner: { js: 'const __emptyGlob = () => ({});' },
  define: { 'import.meta.glob': '__emptyGlob' },
  external: ['@hermes/plugin-sdk', 'react', 'react/jsx-runtime', 'react/jsx-dev-runtime', 'react-dom'],
  plugins: [overlay],
  logLevel: 'info'
})
console.log('已生成', out)
