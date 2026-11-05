import { parse } from 'yaml'

import type { StoreBot, StoreCategory, StoreRequirement } from './store-types'

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

  // 套装可以没有自己的仓库（只是若干 Bot 的组合）；单个 Bot 必须有合法仓库地址
  if (!ID_RE.test(id) || (category === 'general' && !REPO_RE.test(repo))) {
    return null
  }

  return {
    id,
    name: String(r.name || id),
    category,
    summary: String(r.summary || ''),
    description: r.description ? String(r.description) : undefined,
    repo,
    icon: r.icon ? String(r.icon) : undefined,
    tags: Array.isArray(r.tags) ? r.tags.map(String) : [],
    requires: Array.isArray(r.requires) ? r.requires.map(toRequirement).filter(Boolean) as StoreRequirement[] : [],
    bots: Array.isArray(r.bots) ? r.bots.map(String) : undefined
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
