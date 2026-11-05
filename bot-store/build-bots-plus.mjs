// 打包 hermes-bots-plus：官方 Bot 模式插件（不改一行）+ 我们的 Bot 商店与多对话。
// 输出：bot-store/dist/hermes-bots-plus/plugin.js
// 用法（仓库根目录 npm install 之后）：node bot-store/build-bots-plus.mjs
// 外部插件只允许 import @hermes/plugin-sdk 和 react*，其余依赖（nanostores、yaml、noVNC）打进包里。
import { compile } from '@tailwindcss/node'
import { Scanner } from '@tailwindcss/oxide'
import { build } from 'esbuild'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const desktop = resolve(root, 'apps/desktop')
const official = resolve(desktop, 'src/plugins/hermes-bots')
const ours = resolve(root, 'bot-store/src')
const out = resolve(root, 'bot-store/dist/hermes-bots-plus/plugin.js')

// 官方模块里要被我们版本替换的文件：官方文件 import './<名字>' 时改指向 bot-store/src/<名字>.tsx。
// 我们的替换文件再通过 @official-bots/<名字> 拿到官方原版。
const OVERRIDES = ['roster-pane-toolbar', 'bot-row']

const findSource = base =>
  ['.tsx', '.ts', '/index.tsx', '/index.ts'].map(ext => base + ext).find(existsSync)

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
    for (const [file, from, to] of [
      ['i18n.ts', "usePluginI18n('hermes-bots')", "usePluginI18n('hermes-bots-plus')"],
      ['profile-ops.ts', "queryKey: ['hermes-bots', 'roster']", "queryKey: ['hermes-bots-plus', 'roster']"]
    ]) {
      b.onLoad({ filter: new RegExp(`plugins[\\\\/]hermes-bots[\\\\/]${file.replace('.', '\\.')}$`) }, args => {
        const src = readFileSync(args.path, 'utf8')

        if (!src.includes(from)) {
          throw new Error(`${file} 里找不到：${from}（官方代码变了，检查补丁）`)
        }

        return { contents: src.split(from).join(to), loader: 'ts' }
      })
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

function insertAt(src, anchor, text, where = 'after') {
  const i = src.indexOf(anchor)

  if (i < 0 || src.indexOf(anchor, i + 1) >= 0) {
    throw new Error(`create-dialog.tsx 补丁锚点没找到或不唯一：${anchor.trim().slice(0, 60)}`)
  }

  const at = where === 'after' ? i + anchor.length : i

  return src.slice(0, at) + text + src.slice(at)
}

function patchCreateDialog(src) {
  let out = insertAt(
    src,
    "import { useEffect, useRef, useState } from 'react'\n",
    `import { $presetQueue as __bsQueue, shiftPreset as __bsShift } from ${JSON.stringify(resolve(ours, 'preset/queue'))}\n` +
      `import { applyPreset as __bsApply } from ${JSON.stringify(resolve(ours, 'preset/apply'))}\n`
  )
  out = insertAt(
    out,
    "  const [advTab, setAdvTab] = useState('general')\n",
    `  // [bots-plus] 商店预设：打开时预填，关闭时出队
  const __bsPreset = useValue(__bsQueue)[0] || null
  const __bsSeeded = useRef<null | string>(null)
  useEffect(() => {
    if (open && __bsPreset && __bsSeeded.current !== __bsPreset.id) {
      __bsSeeded.current = __bsPreset.id
      setName(__bsPreset.id)
      setTitle(__bsPreset.name)
      setDescription(__bsPreset.summary || '')
      setSoul(__bsPreset.soul || '')
      if (__bsPreset.color) setColor(__bsPreset.color)
      setCloneFrom('default')
      setAdvanced(true)
    }
    if (!open && __bsSeeded.current) {
      __bsSeeded.current = null
      __bsShift()
    }
  }, [open, __bsPreset])
`
  )
  out = insertAt(
    out,
    '      // The intro turn is a real model call.',
    `      // [bots-plus] 套用商店预设里的工具集、技能、MCP
      if (__bsPreset && __bsSeeded.current === __bsPreset.id) {
        await __bsApply(__bsPreset, slugCreated, requestForTarget)
      }

`,
    'before'
  )

  return out
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
  external: ['@hermes/plugin-sdk', 'react', 'react/jsx-runtime', 'react/jsx-dev-runtime', 'react-dom'],
  plugins: [overlay],
  logLevel: 'info'
})
console.log('已生成', out)
