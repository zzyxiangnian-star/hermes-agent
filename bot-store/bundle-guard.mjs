/** esbuild 把 apps/desktop 下的文件标成 `// src/...`。store 出现在包里就是复制了一份主程序状态。 */
export function bundledStoreModules(source) {
  return [...source.matchAll(/^\/\/ src\/store\/.*$/gm)].map(match => match[0])
}

export function assertNoBundledStores(source) {
  const found = bundledStoreModules(source)

  if (found.length > 0) {
    throw new Error(`plugin.js 打进了主程序 store（${found.length} 个）：\n${found.slice(0, 20).join('\n')}`)
  }
}
