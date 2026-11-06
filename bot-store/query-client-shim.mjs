import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const source = resolve(dirname(fileURLToPath(import.meta.url)), '../apps/desktop/src/lib/query-client.ts')

/** 打包用的 query-client 垫片。profile 切换会调用 SDK 没导出的 invalidateProfileScopedQueries。 */
export function queryClientShim(src = readFileSync(source, 'utf8')) {
  const block = src.match(/const PROFILE_INDEPENDENT_QUERY_ROOTS = new Set<string>\(\[([\s\S]*?)\]\)/)

  if (!block) {
    throw new Error('query-client.ts 里找不到 PROFILE_INDEPENDENT_QUERY_ROOTS')
  }

  const roots = [...block[1].matchAll(/'([^']+)'/g)].map(match => match[1])

  if (roots.length === 0) {
    throw new Error('query-client.ts 的 profile 无关查询根是空的')
  }

  return `export { queryClient } from '@hermes/plugin-sdk'
const PROFILE_INDEPENDENT_QUERY_ROOTS = new Set(${JSON.stringify(roots)})
export function invalidateProfileScopedQueries() {
  void queryClient.invalidateQueries({
    predicate(query) {
      const root = query.queryKey[0]
      return typeof root !== 'string' || !PROFILE_INDEPENDENT_QUERY_ROOTS.has(root)
    }
  })
}
`
}
