// Bot 商店页面：搜索和详情用原生组件；列表自己按技能页的结构拼，不放 CatalogDeveloper。
import {
  Badge,
  Button,
  cn,
  Codicon,
  DialogTitle,
  icons,
  Loader,
  PanelEmpty,
  Popover,
  PopoverContent,
  PopoverTrigger,
  RowButton,
  Tip,
  useI18n
} from '@hermes/plugin-sdk'
import { useEffect, useMemo, useState } from 'react'

import { syncCatalogArcs } from '@/app/capabilities/catalog/catalog-arc'
import { CatalogCard, type CatalogCardVariant } from '@/app/capabilities/catalog/catalog-card'
import { type CatalogEntry, catalogLabel } from '@/app/capabilities/catalog/catalog-data'
import { CatalogDetailDialog } from '@/app/capabilities/catalog/catalog-detail-dialog'
import { CatalogFeaturedSlider } from '@/app/capabilities/catalog/catalog-featured-slider'
import type { FacetRow } from '@/app/capabilities/catalog/catalog-filters'
import { CatalogHeaderMeta, CatalogMetadata } from '@/app/capabilities/catalog/catalog-metadata'
import { type CatalogFacets, EMPTY_FACETS } from '@/app/capabilities/catalog/catalog-query'
import { CapabilitySearch } from '@/app/capabilities/ui/capability-search'

import type { InstallState, StoreBot, StoreCategory, StorePageProps, StoreRequirement } from './store-types'

const { Check, Loader2, Plus } = icons

type StoreSort = 'default' | 'name'

const CATEGORY_LABELS: Record<StoreCategory, string> = {
  kit: '场景套装',
  general: '通用 Bot'
}

function hasMissingReq(requires?: StoreRequirement[]): boolean {
  return Boolean(requires?.some(req => req.ok === false))
}

function itemEyebrow(item: StoreBot): string {
  if (item.category === 'kit') {
    const count = item.bots?.length ?? 0

    return count > 0 ? `场景套装 · 含 ${count} 个 Bot` : '场景套装'
  }

  const parts: string[] = []

  if (item.toolsets?.length) {
    parts.push(`工具集 ${item.toolsets.length}`)
  }

  if (item.mcp?.length) {
    parts.push(`MCP ${item.mcp.length}`)
  }

  if (item.skills?.length) {
    parts.push(`技能 ${item.skills.length}`)
  }

  return parts.join(' · ') || '预设 Bot'
}

function itemBadge(item: StoreBot): string {
  if (item.tags?.length) {
    return item.tags.slice(0, 2).join(' · ')
  }

  return CATEGORY_LABELS[item.category]
}

function toCatalogEntry(item: StoreBot): CatalogEntry {
  return {
    id: item.id,
    name: item.name,
    description: item.summary,
    overview: item.description || item.summary,
    category: item.category,
    categoryLabel: CATEGORY_LABELS[item.category],
    source: itemBadge(item),
    author: itemEyebrow(item),
    identifier: item.id,
    repo: item.repo || '',
    sha: '',
    subdir: '',
    version: '',
    requiresHermes: '',
    tags: item.tags ?? [],
    platforms: [],
    requirements: (item.requires ?? []).map(r => r.name),
    tools: item.toolsets ?? [],
    hooks: [],
    sourceUrl: item.repo && /^https?:\/\//i.test(item.repo) ? item.repo : null,
    docsUrl: null,
    imageUrl: null,
    stars: null,
    search: [item.id, item.name, item.summary, item.description ?? '', ...(item.tags ?? [])].join(' ').toLowerCase()
  }
}

/** 更新已安装的 Bot。默认保留本机 config.yaml（可能改过模型）；按住 Shift 点击会连 config.yaml 一起更新。 */
function UpdateButton({ item, onUpdate }: { item: StoreBot; onUpdate: NonNullable<StorePageProps['onUpdate']> }) {
  const [state, setState] = useState<{ kind: 'idle' | 'busy' | 'done' | 'error'; message?: string }>({ kind: 'idle' })

  const run = async (forceConfig: boolean) => {
    setState({ kind: 'busy' })

    try {
      const message = await onUpdate(item, forceConfig)
      setState({ kind: 'done', message })
    } catch (error) {
      setState({ kind: 'error', message: error instanceof Error ? error.message : String(error) })
    }
  }

  const label =
    state.kind === 'done'
      ? state.message || '已是最新'
      : state.kind === 'error'
        ? state.message || '更新失败'
        : '从配方仓库拉取新版（记忆、对话、.env 不动）。按住 Shift 点击会连 config.yaml 一起更新，你改过的模型设置会被覆盖。'

  return (
    <Tip label={label}>
      <Button
        disabled={state.kind === 'busy'}
        onClick={event => {
          event.stopPropagation()
          void run(event.shiftKey)
        }}
        size="xs"
        variant="ghost"
      >
        <Codicon
          className={cn(state.kind === 'error' && 'text-(--ui-warning)', state.kind === 'done' && 'text-(--ui-success)')}
          name={state.kind === 'busy' ? 'loading' : state.kind === 'done' ? 'check' : state.kind === 'error' ? 'warning' : 'sync'}
          size="0.75rem"
          spinning={state.kind === 'busy'}
        />
        {state.kind === 'busy' ? '更新中' : state.kind === 'done' ? '已更新' : '更新'}
      </Button>
    </Tip>
  )
}

function StoreActionButton({
  item,
  state,
  onInstall,
  onOpenBot,
  onUpdate
}: {
  item: StoreBot
  state: InstallState
  onInstall: (item: StoreBot) => void
  onOpenBot: (id: string) => void
  onUpdate?: StorePageProps['onUpdate']
}) {
  if (state.kind === 'installed') {
    return (
      <span className="inline-flex items-center gap-1" onClick={event => event.stopPropagation()}>
        {onUpdate && item.category !== 'kit' && <UpdateButton item={item} onUpdate={onUpdate} />}
        <Button
          aria-label={`打开 ${item.name}`}
          onClick={event => {
            event.stopPropagation()
            onOpenBot(item.id)
          }}
          size="xs"
          variant="secondary"
        >
          <Check className="size-3.5" />
          打开
        </Button>
      </span>
    )
  }

  if (state.kind === 'installing') {
    return (
      <Button
        aria-busy="true"
        aria-label={`正在添加 ${item.name}`}
        disabled
        onClick={event => event.stopPropagation()}
        size="xs"
        variant="outline"
      >
        <Loader2 className="size-3.5 animate-spin text-(--ui-text-tertiary)" />
        添加中
      </Button>
    )
  }

  if (state.kind === 'error') {
    return (
      <Tip label={state.message}>
        <Button
          onClick={event => {
            event.stopPropagation()
            onInstall(item)
          }}
          size="xs"
          variant="outline"
        >
          <Codicon className="text-(--ui-warning)" name="warning" size="0.75rem" />
          重试
        </Button>
      </Tip>
    )
  }

  return (
    <Button
      aria-label={`添加 ${item.name}`}
      onClick={event => {
        event.stopPropagation()
        onInstall(item)
      }}
      size="xs"
      variant="outline"
    >
      <Plus className="size-3.5" />
      添加
    </Button>
  )
}

function StoreBotDetail({
  item,
  entry,
  allItems,
  installState,
  onInstall,
  onOpenBot,
  onUpdate,
  onSelectBot,
  onCategory,
  onTag,
  onSearch
}: {
  item: StoreBot
  entry: CatalogEntry
  allItems: StoreBot[]
  installState: (id: string) => InstallState
  onInstall: (item: StoreBot) => void
  onOpenBot: (id: string) => void
  onUpdate?: StorePageProps['onUpdate']
  onSelectBot: (id: string) => void
  onCategory: (category: string) => void
  onTag: (tag: string) => void
  onSearch: (value: string) => void
}) {
  const { t } = useI18n()
  const c = t.catalog
  const state = installState(item.id)
  const kitBots = useMemo(
    () =>
      item.category === 'kit' && item.bots?.length
        ? item.bots.map(id => allItems.find(b => b.id === id) ?? { id, name: id, category: 'general' as const, summary: '' })
        : [],
    [allItems, item]
  )

  return (
    <div
      className="min-w-0 space-y-5 pb-4 [&>:not(img)]:mx-4 [&>:first-child:not(img)]:mt-4"
      data-catalog-detail="plugins"
    >
      <header className="space-y-3">
        <div className="flex min-w-0 items-start gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex min-w-0 items-center gap-2 pr-7">
              <DialogTitle className="min-w-0 flex-1 break-words text-lg font-semibold tracking-tight">
                {item.name}
              </DialogTitle>
              <span className="shrink-0">
                <StoreActionButton
                  item={item}
                  onInstall={onInstall}
                  onOpenBot={onOpenBot}
                  onUpdate={onUpdate}
                  state={state}
                />
              </span>
            </div>
            <div className="mt-1 flex min-w-0 items-center gap-2 text-xs text-(--ui-text-tertiary)">
              <span className="min-w-0 truncate">{entry.author || catalogLabel(entry.source)}</span>
              <CatalogHeaderMeta entry={entry} />
            </div>
          </div>
        </div>
        {entry.sourceUrl && (
          <div className="flex flex-wrap gap-3 text-xs">
            <button
              className="ref inline-flex cursor-pointer items-center gap-1 text-left"
              onClick={() => void window.hermesDesktop?.openExternal?.(entry.sourceUrl!)}
              type="button"
            >
              <span>{c.repository}</span>
              <Codicon name="arrow-up-right" size="0.75rem" />
            </button>
          </div>
        )}
      </header>

      <p className="whitespace-pre-wrap break-words text-[length:var(--conversation-caption-font-size)] leading-relaxed text-(--ui-text-secondary)">
        {item.summary}
      </p>
      {item.description && item.description !== item.summary && (
        <p className="whitespace-pre-wrap break-words text-[length:var(--conversation-caption-font-size)] leading-relaxed text-(--ui-text-tertiary)">
          {item.description}
        </p>
      )}

      <div className="space-y-3">
        <CatalogMetadata entry={entry} limit={Infinity} onCategory={onCategory} onSearch={onSearch} onTag={onTag} />
      </div>

      {kitBots.length > 0 && (
        <section className="space-y-2">
          <h4 className="text-xs font-medium">套装包含的 Bot（{kitBots.length}）</h4>
          <div className="flex flex-col gap-2">
            {kitBots.map(bot => {
              const botState = installState(bot.id)
              const known = allItems.some(b => b.id === bot.id)

              return (
                <RowButton
                  className="row-hover flex w-full min-w-0 items-center justify-between gap-3 rounded-lg border border-(--ui-stroke-tertiary) px-3 py-2.5 text-left"
                  disabled={!known}
                  key={bot.id}
                  onClick={() => known && onSelectBot(bot.id)}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <Codicon className="text-(--ui-text-tertiary)" name={bot.icon || 'hubot'} size="0.875rem" />
                      <span className="truncate text-xs font-medium">{bot.name}</span>
                      <code className="font-mono text-[0.6875rem] text-(--ui-text-quaternary)">{bot.id}</code>
                    </div>
                    {bot.summary && (
                      <p className="mt-1 line-clamp-1 text-xs text-(--ui-text-tertiary)">{bot.summary}</p>
                    )}
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <Badge size="xs" variant={botState.kind === 'installed' ? 'success' : 'muted'}>
                      {botState.kind === 'installed' ? '已添加' : botState.kind === 'installing' ? '添加中' : '未添加'}
                    </Badge>
                    {known && <Codicon className="text-(--ui-text-quaternary)" name="chevron-right" size="0.75rem" />}
                  </div>
                </RowButton>
              )
            })}
          </div>
        </section>
      )}

      {Boolean(item.requires?.length) && (
        <section className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <h4 className="text-xs font-medium">{c.requires}</h4>
            {hasMissingReq(item.requires) && (
              <Badge size="xs" variant="muted">
                部分依赖待配置
              </Badge>
            )}
          </div>
          <div className="flex flex-col gap-1.5">
            {item.requires?.map(req => (
              <div
                className="flex flex-col gap-1 rounded-lg border border-(--ui-stroke-tertiary) px-3 py-2 text-xs"
                key={`${req.kind}:${req.name}`}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <Badge size="xs" variant="muted">
                    {req.kind === 'env' ? '环境变量' : '命令'}
                  </Badge>
                  <code className="font-mono font-medium">{req.name}</code>
                  {req.ok === true && (
                    <Badge className="ml-auto" size="xs" variant="success">
                      已就绪
                    </Badge>
                  )}
                  {req.ok === false && (
                    <Badge className="ml-auto" size="xs" variant="muted">
                      未配置
                    </Badge>
                  )}
                </div>
                {req.hint && <p className="text-(--ui-text-tertiary)">{req.hint}</p>}
              </div>
            ))}
          </div>
        </section>
      )}

      {Boolean(item.toolsets?.length || item.skills?.length || item.mcp?.length || item.soul) && (
        <section className="space-y-3">
          <h4 className="text-xs font-medium">预设内容</h4>

          {Boolean(item.toolsets?.length) && (
            <div className="space-y-1.5">
              <div className="text-xs text-(--ui-text-tertiary)">工具集（{item.toolsets?.length}）</div>
              <div className="flex flex-wrap gap-1">
                {item.toolsets?.map(toolset => (
                  <Badge key={toolset} variant="muted">
                    {toolset}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {Boolean(item.skills?.length) && (
            <div className="space-y-1.5">
              <div className="text-xs text-(--ui-text-tertiary)">技能（{item.skills?.length}）</div>
              <div className="flex flex-wrap gap-1">
                {item.skills?.map(skill => (
                  <Badge key={skill} variant="muted">
                    {skill}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {Boolean(item.mcp?.length) && (
            <div className="space-y-1.5">
              <div className="text-xs text-(--ui-text-tertiary)">MCP 服务（{item.mcp?.length}）</div>
              <div className="flex flex-col gap-1.5">
                {item.mcp?.map(server => {
                  const cmd =
                    server.preset
                      ? `预设：${server.preset}`
                      : typeof server.config?.url === 'string'
                        ? server.config.url
                        : typeof server.config?.command === 'string'
                          ? [
                              server.config.command,
                              ...(Array.isArray(server.config.args) ? server.config.args.map(String) : [])
                            ].join(' ')
                          : ''

                  return (
                    <div
                      className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-(--ui-stroke-tertiary) px-3 py-1.5 text-xs"
                      key={server.name}
                    >
                      <code className="font-mono font-medium">{server.name}</code>
                      {cmd && <span className="truncate font-mono text-(--ui-text-tertiary)">{cmd}</span>}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {item.soul && (
            <details className="rounded-lg border border-(--ui-stroke-tertiary) px-3 py-2 text-xs">
              <summary className="cursor-pointer select-none font-medium text-(--ui-text-secondary)">
                预设人格（SOUL.md）
              </summary>
              <pre className="mt-2 max-h-44 overflow-y-auto whitespace-pre-wrap break-words font-mono text-[0.72rem] leading-relaxed text-(--ui-text-tertiary)">
                {item.soul.trim()}
              </pre>
            </details>
          )}
        </section>
      )}
    </div>
  )
}

function StoreFilterBar({
  categories,
  tags,
  facets,
  sort,
  onCategory,
  onTag,
  onSort,
  onClear
}: {
  categories: ReadonlyArray<readonly [string, { label: string; count: number }]>
  tags: FacetRow[]
  facets: CatalogFacets
  sort: StoreSort
  onCategory: (value: string | null) => void
  onTag: (value: string | null) => void
  onSort: (value: StoreSort) => void
  onClear: () => void
}) {
  const selected = facets.categories

  return (
    <div className="catalog-filter-bar" data-catalog-filters>
      <div className="catalog-filter-row">
        <div className="catalog-filter-chips">
          <Button
            aria-pressed={selected.length === 0}
            onClick={() => onCategory(null)}
            size="xs"
            variant={selected.length === 0 ? 'default' : 'outline'}
          >
            全部
          </Button>
          <span aria-hidden className="px-1 text-(--ui-text-quaternary)">
            /
          </span>
          {categories.map(([value, meta]) => (
            <Button
              aria-pressed={selected.includes(value)}
              key={value}
              onClick={() => onCategory(value)}
              size="xs"
              variant={selected.includes(value) ? 'default' : 'outline'}
            >
              {meta.label}
            </Button>
          ))}
        </div>
        <Popover>
          <PopoverTrigger asChild>
            <Button size="xs" variant={facets.tags.length > 0 ? 'default' : 'outline'}>
              标签{facets.tags.length > 0 ? ` · ${facets.tags.length}` : ''}
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-80 max-w-[calc(100vw-2rem)] p-4" variant="menu">
            <div className="flex max-h-80 flex-col gap-4 overflow-y-auto">
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm font-medium">标签</span>
                <Button onClick={onClear} size="inline" variant="text">
                  清除
                </Button>
              </div>
              {tags.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {tags.map(row => (
                    <Button
                      aria-pressed={facets.tags.includes(row.value)}
                      key={row.value}
                      onClick={() => onTag(row.value)}
                      size="xs"
                      variant={facets.tags.includes(row.value) ? 'default' : 'outline'}
                    >
                      {row.label}
                    </Button>
                  ))}
                </div>
              )}
              <div className="flex flex-col gap-2">
                <span className="text-xs text-(--ui-text-tertiary)">排序</span>
                <div className="flex gap-1.5">
                  <Button onClick={() => onSort('default')} size="xs" variant={sort === 'default' ? 'default' : 'outline'}>
                    默认
                  </Button>
                  <Button onClick={() => onSort('name')} size="xs" variant={sort === 'name' ? 'default' : 'outline'}>
                    名称
                  </Button>
                </div>
              </div>
            </div>
          </PopoverContent>
        </Popover>
      </div>
    </div>
  )
}

export function StorePage({
  items,
  loading,
  loadError,
  installState,
  onInstall,
  onOpenBot,
  onRetryLoad,
  onUpdate
}: StorePageProps) {
  const [query, setQuery] = useState('')
  const [facets, setFacets] = useState<CatalogFacets>(EMPTY_FACETS)
  const [sort, setSort] = useState<StoreSort>('default')
  const [selectedId, setSelectedId] = useState<string | null>(null)

  useEffect(syncCatalogArcs, [])

  const categories = useMemo(
    () =>
      [
        ['kit', { label: CATEGORY_LABELS.kit, count: items.filter(i => i.category === 'kit').length }],
        ['general', { label: CATEGORY_LABELS.general, count: items.filter(i => i.category === 'general').length }]
      ] as const,
    [items]
  )

  const tags = useMemo<FacetRow[]>(() => {
    const counts = new Map<string, number>()

    for (const item of items) {
      for (const tag of item.tags ?? []) {
        counts.set(tag, (counts.get(tag) ?? 0) + 1)
      }
    }

    return [...counts.entries()].map(([value, count]) => ({ value, label: value, count }))
  }, [items])

  const filteredItems = useMemo(() => {
    const q = query.trim().toLowerCase()

    const list = items.filter(item => {
      if (facets.categories.length > 0 && !facets.categories.includes(item.category)) {
        return false
      }

      if (facets.installedOnly && installState(item.id).kind !== 'installed') {
        return false
      }

      if (facets.tags.length > 0 && !facets.tags.some(tag => item.tags?.includes(tag))) {
        return false
      }

      if (!q) {
        return true
      }

      const haystack = [
        item.id,
        item.name,
        item.summary,
        item.description ?? '',
        ...(item.tags ?? []),
        ...(item.requires?.map(r => r.name) ?? []),
        ...(item.toolsets ?? []),
        ...(item.skills ?? []),
        ...(item.mcp?.map(m => m.name) ?? [])
      ]
        .join(' ')
        .toLowerCase()

      return haystack.includes(q)
    })

    if (sort === 'name') {
      return [...list].sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'))
    }

    return list
  }, [facets, installState, items, query, sort])

  const entriesById = useMemo(() => new Map(items.map(item => [item.id, toCatalogEntry(item)])), [items])

  const orderedEntries = useMemo(
    () => filteredItems.map(item => entriesById.get(item.id) ?? toCatalogEntry(item)),
    [entriesById, filteredItems]
  )

  const selectedItem = useMemo(
    () => (selectedId ? (items.find(item => item.id === selectedId) ?? null) : null),
    [items, selectedId]
  )

  const kits = filteredItems.filter(item => item.category === 'kit')
  const generals = filteredItems.filter(item => item.category === 'general')

  const renderCard = (item: StoreBot, index: number, variant: CatalogCardVariant) => (
    <CatalogCard
      accentIndex={index}
      action={
        <StoreActionButton
          item={item}
          onInstall={onInstall}
          onOpenBot={onOpenBot}
          onUpdate={onUpdate}
          state={installState(item.id)}
        />
      }
      entry={entriesById.get(item.id) ?? toCatalogEntry(item)}
      key={item.id}
      onCategory={category => {
        setFacets({ ...EMPTY_FACETS, categories: [category] })
        setSelectedId(null)
      }}
      onOpen={() => setSelectedId(item.id)}
      onSearch={value => {
        setQuery(value)
        setSelectedId(null)
      }}
      onTag={tag => {
        setFacets({ ...EMPTY_FACETS, tags: [tag] })
        setSelectedId(null)
      }}
      variant={variant}
    />
  )

  const toggleFacet = (field: 'categories' | 'tags', value: string | null) => {
    setFacets(prev => {
      if (value === null) {
        return { ...prev, [field]: [] }
      }

      const list = prev[field]
      const next = list.includes(value) ? list.filter(v => v !== value) : [...list, value]

      return { ...prev, [field]: next }
    })
  }

  return (
    <section
      aria-label="Bot 商店"
      className="@container/catalog flex h-full min-h-0 min-w-0 flex-col overflow-hidden bg-(--ui-chat-surface-background)"
      data-catalog="plugins"
    >
      <div className="flex min-h-0 min-w-0 flex-1 flex-col" data-catalog-results>
        <header className="catalog-search-header shrink-0 space-y-3" data-catalog-header>
          <div className="flex flex-wrap items-end justify-between gap-3 px-(--capabilities-inset)">
            <div>
              <h1 className="m-0 text-[1.4rem] font-semibold tracking-[-0.025em]">Bot 商店</h1>
              <p className="mt-1 text-[0.8125rem] text-(--ui-text-tertiary)">
                挑一个预设，点添加会打开新建机器人窗口并预填好人格、工具集、技能和 MCP。
              </p>
            </div>
          </div>
          <CapabilitySearch
            hints={['网页爬取', '视频剪辑', '代码开发', '短视频运营']}
            onChange={setQuery}
            placeholder="搜索 Bot 名称、功能、标签或依赖…"
            scope="Bot 商店"
            value={query}
          />
        </header>

        <StoreFilterBar
          categories={categories}
          facets={facets}
          onCategory={value => toggleFacet('categories', value)}
          onClear={() => {
            setFacets(EMPTY_FACETS)
            setSort('default')
          }}
          onSort={setSort}
          onTag={value => toggleFacet('tags', value)}
          sort={sort}
          tags={tags}
        />

        <div className="flex min-h-0 flex-1 flex-col" data-catalog-cards="plugins">
          {loading ? (
            <div className="flex flex-1 items-center justify-center">
              <Loader label="正在加载" type="lemniscate-bloom" />
            </div>
          ) : loadError ? (
            <div className="flex flex-1">
              <PanelEmpty
                action={
                  <Button onClick={onRetryLoad} size="sm">
                    重新加载
                  </Button>
                }
                description={loadError}
                icon="error"
                title="加载 Bot 商店目录失败"
              />
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="flex h-full min-h-0 flex-1">
              <PanelEmpty
                description={query.trim() ? `没有匹配「${query.trim()}」的内容。` : '换个词，或清掉筛选再看。'}
                icon="search"
                title="没有找到相关的 Bot"
              />
            </div>
          ) : (
            <div className="capabilities-scroll">
              <div className="catalog-discovery">
                {kits.length > 0 && (
                  <section data-catalog-section="featured">
                    <header className="catalog-section-heading">
                      <h2>精选</h2>
                    </header>
                    <CatalogFeaturedSlider slides={kits.map((item, index) => renderCard(item, index, 'hero'))} />
                  </section>
                )}
                {generals.length > 0 && (
                  <section data-catalog-section="general">
                    <header className="catalog-section-heading">
                      <div>
                        <h2>通用 Bot</h2>
                        <p>开箱即用的单项能力 Bot，预置工具集、技能、MCP 服务与专属人格。</p>
                      </div>
                    </header>
                    <div className="catalog-feature-row">
                      {generals.map((item, index) => renderCard(item, index, 'compact'))}
                    </div>
                  </section>
                )}
              </div>
            </div>
          )}

          <CatalogDetailDialog
            onOpenChange={open => {
              if (!open) {
                setSelectedId(null)
              }
            }}
            onSelect={setSelectedId}
            open={selectedItem !== null}
            order={orderedEntries.length > 0 ? orderedEntries : selectedItem ? [toCatalogEntry(selectedItem)] : []}
            selectedId={selectedItem?.id ?? ''}
          >
            {selectedItem && (
              <StoreBotDetail
                allItems={items}
                entry={entriesById.get(selectedItem.id) ?? toCatalogEntry(selectedItem)}
                installState={installState}
                item={selectedItem}
                onCategory={category => {
                  setFacets({ ...EMPTY_FACETS, categories: [category] })
                  setSelectedId(null)
                }}
                onInstall={onInstall}
                onOpenBot={onOpenBot}
                onSearch={value => {
                  setQuery(value)
                  setSelectedId(null)
                }}
                onSelectBot={setSelectedId}
                onTag={tag => {
                  setFacets({ ...EMPTY_FACETS, tags: [tag] })
                  setSelectedId(null)
                }}
                onUpdate={onUpdate}
              />
            )}
          </CatalogDetailDialog>
        </div>
      </div>
    </section>
  )
}
