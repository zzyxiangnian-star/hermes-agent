import { readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import { queryClientShim } from './query-client-shim.mjs'
import { SDK_REEXPORTS, SDK_SHIMS } from './sdk-reexports.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const repo = resolve(here, '..')
const desktopSrc = resolve(repo, 'apps/desktop/src')
const mapped = new Set(SDK_REEXPORTS)
const shims = new Map(Object.entries(SDK_SHIMS))

function listSources(dir: string): string[] {
  const out: string[] = []

  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = resolve(dir, entry.name)

    if (entry.isDirectory()) {
      out.push(...listSources(path))
    } else if (/\.(tsx?|jsx?)$/.test(entry.name)) {
      out.push(path)
    }
  }

  return out
}

function moduleId(file: string): string | null {
  const rel = relative(desktopSrc, file).replaceAll('\\', '/')

  if (rel.startsWith('..') || rel === '') {
    return null
  }

  return `@/${rel.replace(/\.(tsx?|jsx?)$/, '').replace(/\/index$/, '')}`
}

function findFile(base: string): string | null {
  const candidates = ['', '.tsx', '.ts', '.jsx', '.js', '/index.tsx', '/index.ts']

  return candidates.map(ext => base + ext).find(path => statSync(path, { throwIfNoEntry: false })?.isFile()) ?? null
}

function resolveSource(specifier: string, fromFile: string): string | null {
  if (specifier.startsWith('@official-bots/')) {
    return findFile(resolve(desktopSrc, 'plugins/hermes-bots', specifier.slice('@official-bots/'.length)))
  }

  if (specifier.startsWith('@/')) {
    return findFile(resolve(desktopSrc, specifier.slice(2)))
  }

  if (specifier.startsWith('.')) {
    return findFile(resolve(dirname(fromFile), specifier))
  }

  return null
}

/** 运行时会从模块里取出的名字。纯类型导入不算。 */
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
}

function runtimeNames(clause: string, isTypeOnly: boolean): string[] {
  if (isTypeOnly) {
    return []
  }

  const names: string[] = []
  const brace = clause.match(/\{([\s\S]*)\}/)
  const body = brace?.[1] ?? ''

  for (const part of body.split(',')) {
    const cleaned = part.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/g, '').trim()

    if (!cleaned || cleaned.startsWith('type ')) {
      continue
    }

    const match = cleaned.match(/^([A-Za-z_$][\w$]*)(?:\s+as\s+[A-Za-z_$][\w$]*)?$/)

    if (match) {
      names.push(match[1])
    }
  }

  const before = clause.slice(0, brace?.index ?? clause.length).trim()

  if (before && !before.startsWith('type ') && /^[A-Za-z_$][\w$]*$/.test(before.replace(/\s+as\s+[A-Za-z_$][\w$]*$/, '').trim())) {
    names.push('default')
  }

  if (/\*\s+as\s+/.test(clause)) {
    names.push('*')
  }

  return names
}

function importsFrom(source: string): { specifier: string; names: string[] }[] {
  const found: { specifier: string; names: string[] }[] = []
  const pattern = /(?:import|export)\s+(type\s+)?([\s\S]*?)\s+from\s+['"]([^'"]+)['"]/g

  for (const match of stripComments(source).matchAll(pattern)) {
    found.push({ specifier: match[3], names: runtimeNames(match[2], Boolean(match[1])) })
  }

  return found
}

function sdkExports(): Set<string> {
  const source = stripComments(readFileSync(resolve(desktopSrc, 'sdk/index.ts'), 'utf8'))
  const names = new Set<string>()
  const blocks = source.matchAll(/export\s+(type\s+)?\{([\s\S]*?)\}/g)

  for (const match of blocks) {
    if (match[1]) {
      continue
    }

    for (const part of match[2].split(',')) {
      const cleaned = part.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/g, '').trim()

      if (!cleaned || cleaned.startsWith('type ')) {
        continue
      }

      const named = cleaned.match(/^([A-Za-z_$][\w$]*)(?:\s+as\s+([A-Za-z_$][\w$]*))?$/)

      if (named) {
        names.add(named[2] || named[1])
      }
    }
  }

  for (const match of source.matchAll(/export\s+(?:async\s+)?(?:function|const|class|let|var)\s+([A-Za-z_$][\w$]*)/g)) {
    names.add(match[1])
  }

  return names
}

function mappedImports(): Map<string, Set<string>> {
  const byModule = new Map<string, Set<string>>()
  const pending = listSources(resolve(here, 'src'))
  const seen = new Set<string>()

  while (pending.length) {
    const file = pending.pop()!

    if (seen.has(file)) {
      continue
    }

    seen.add(file)
    const source = readFileSync(file, 'utf8')

    for (const item of importsFrom(source)) {
      if (!item.specifier.startsWith('@/') && !item.specifier.startsWith('.') && !item.specifier.startsWith('@official-bots/')) {
        continue
      }

      const resolved = resolveSource(item.specifier, file)

      if (!resolved) {
        continue
      }

      const id = item.specifier.startsWith('@/') ? item.specifier.replace(/\/index$/, '') : moduleId(resolved)

      if (item.names.length === 0) {
        continue
      }

      if (id && (mapped.has(id) || shims.has(id))) {
        const extras = new Set(shims.get(id) ?? [])
        const bucket = byModule.get(id) ?? new Set<string>()

        for (const name of item.names) {
          if (!extras.has(name)) {
            bucket.add(name)
          }
        }

        if (bucket.size > 0) {
          byModule.set(id, bucket)
        }

        continue
      }

      if (!resolved.endsWith('.test.ts') && !resolved.endsWith('.test.tsx') && (resolved.startsWith(desktopSrc) || resolved.startsWith(resolve(here, 'src')))) {
        pending.push(resolved)
      }
    }
  }

  return byModule
}

describe('SDK re-export map', () => {
  it('every name imported through a mapped module is exported by the plugin SDK', () => {
    const exported = sdkExports()
    const missing: string[] = []

    for (const [moduleId, names] of mappedImports()) {
      for (const name of names) {
        if (name === '*') {
          missing.push(`${moduleId} uses import * and cannot be checked name by name`)
        } else if (!exported.has(name)) {
          missing.push(`${moduleId} → ${name}`)
        }
      }
    }

    expect(missing).toEqual([])
  })

  it('keeps the shared query client and fills in the profile invalidation the SDK does not export', () => {
    const shim = queryClientShim()

    expect(shim).toContain("export { queryClient } from '@hermes/plugin-sdk'")
    expect(shim).toContain('export function invalidateProfileScopedQueries()')
    expect(shim).toContain('"billing"')
    expect(SDK_SHIMS['@/lib/query-client']).toContain('invalidateProfileScopedQueries')
  })
})
