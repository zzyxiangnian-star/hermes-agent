// 把内置 Bot 模式插件（apps/desktop/src/plugins/hermes-bots）打包成外部桌面插件
// 输出：bot-store/dist/hermes-bots-plus/plugin.js
// 用法（仓库根目录 npm install 之后）：node bot-store/build-bots-plus.mjs
// 外部插件只允许 import @hermes/plugin-sdk 和 react*，其余依赖（nanostores、noVNC）打进包里。
import { build } from 'esbuild'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const desktop = resolve(root, 'apps/desktop')
const src = resolve(desktop, 'src/plugins/hermes-bots')
const out = resolve(root, 'bot-store/dist/hermes-bots-plus/plugin.js')

// 只换插件 id，Bot 数据键 ui_meta['hermes-bots'] 不动，已有 Bot 照常显示
const renameId = {
  name: 'rename-plugin-id',
  setup(b) {
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
  entryPoints: [resolve(src, 'plugin.tsx')],
  outfile: out,
  bundle: true,
  format: 'esm',
  jsx: 'automatic',
  target: 'es2022',
  absWorkingDir: desktop,
  nodePaths: [resolve(desktop, 'node_modules'), resolve(root, 'node_modules')],
  external: ['@hermes/plugin-sdk', 'react', 'react/jsx-runtime', 'react/jsx-dev-runtime', 'react-dom'],
  plugins: [renameId],
  logLevel: 'info'
})
console.log('已生成', out)
