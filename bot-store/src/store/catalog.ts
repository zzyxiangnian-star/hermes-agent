import { parse } from 'yaml'

import type { StoreBot, StoreCategory, StoreMcpServer, StoreRequirement } from './store-types'

const ID_RE = /^[a-z0-9][a-z0-9_-]{0,63}$/
// git 地址，或本机目录（自己调试配方时用）
const REPO_RE = /^((https:\/\/|git@)[\w.@:/~-]+|\/[\w./-]+|[A-Za-z]:\\[^\0]+)$/

/** 把 catalog.yaml 解析成商品列表。格式见 G02 任务卡；不合格的条目跳过而不是整页报错。 */
export function parseCatalog(text: string): StoreBot[] {
  const doc = parse(text) as { version?: number; bots?: unknown[]; kits?: unknown[] } | null

  if (!doc || typeof doc !== 'object') {
    throw new Error('catalog.yaml 不是有效的 YAML 对象')
  }

  const items: StoreBot[] = []

  for (const raw of [...(doc.bots || []), ...(doc.kits || []).map(k => ({ category: 'kit', ...(k as object) }))]) {
    const item = toItem(raw)

    if (item) {
      items.push(item)
    }
  }

  return items
}

function toItem(raw: unknown): null | StoreBot {
  if (!raw || typeof raw !== 'object') {
    return null
  }

  const r = raw as Record<string, unknown>
  const id = String(r.id || '').trim()
  const repo = String(r.repo || '').trim()
  const category: StoreCategory = r.category === 'kit' ? 'kit' : 'general'

  // 仓库地址可选（预设直接写在目录里），写了就必须合法
  if (!ID_RE.test(id) || (repo && !REPO_RE.test(repo))) {
    return null
  }

  return {
    id,
    name: String(r.name || id),
    category,
    summary: String(r.summary || ''),
    description: r.description ? String(r.description) : undefined,
    repo: repo || undefined,
    icon: r.icon ? String(r.icon) : undefined,
    tags: Array.isArray(r.tags) ? r.tags.map(String) : [],
    requires: Array.isArray(r.requires) ? r.requires.map(toRequirement).filter(Boolean) as StoreRequirement[] : [],
    bots: Array.isArray(r.bots) ? r.bots.map(String) : undefined,
    soul: typeof r.soul === 'string' ? r.soul : undefined,
    toolsets: strings(r.toolsets),
    skills: strings(r.skills),
    mcp: Array.isArray(r.mcp) ? (r.mcp.map(toMcp).filter(Boolean) as StoreMcpServer[]) : undefined,
    color: typeof r.color === 'string' && /^#[0-9a-fA-F]{6}$/.test(r.color) ? r.color : undefined
  }
}

function strings(raw: unknown): string[] | undefined {
  return Array.isArray(raw) ? raw.map(String).filter(s => /^[\w./:@-]{1,128}$/.test(s)) : undefined
}

function toMcp(raw: unknown): null | StoreMcpServer {
  if (!raw || typeof raw !== 'object') {
    return null
  }

  const r = raw as Record<string, unknown>
  const name = String(r.name || '').trim()

  if (!/^[\w-]{1,64}$/.test(name) || (!r.preset && !r.config)) {
    return null
  }

  return {
    name,
    preset: r.preset ? String(r.preset) : undefined,
    config: r.config && typeof r.config === 'object' ? (r.config as Record<string, unknown>) : undefined
  }
}

function toRequirement(raw: unknown): null | StoreRequirement {
  if (!raw || typeof raw !== 'object') {
    return null
  }

  const r = raw as Record<string, unknown>
  const kind = r.kind === 'env' ? 'env' : r.kind === 'command' ? 'command' : null
  const name = String(r.name || '').trim()

  // 命令名只允许简单字符，因为检查依赖时会拼进 shell 命令
  if (!kind || !/^[\w.-]{1,64}$/.test(name)) {
    return null
  }

  return { kind, name, hint: r.hint ? String(r.hint) : undefined }
}

export async function fetchCatalog(url: string): Promise<StoreBot[]> {
  const res = await fetch(url, { cache: 'no-store' })

  if (!res.ok) {
    throw new Error(`读取商品目录失败：HTTP ${res.status}（${url}）`)
  }

  return parseCatalog(await res.text())
}
