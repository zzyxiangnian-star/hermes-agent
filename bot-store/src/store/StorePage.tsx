// Bot 商店页面：G03 由 Gemini 制作，Claude 审查接入（依赖未检测时显示中性状态）。
import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Badge,
  Button,
  cn,
  Codicon,
  SearchField,
  Skeleton,
  Tabs,
  TabsList,
  TabsTrigger,
  Tip
} from '@hermes/plugin-sdk'

import type { InstallState, StoreBot, StoreCategory, StorePageProps, StoreRequirement } from './store-types'

type CategoryTab = 'all' | StoreCategory

const SKELETON_KEYS = ['s1', 's2', 's3', 's4', 's5', 's6']

function hasMissingReq(requires?: StoreRequirement[]): boolean {
  return Boolean(requires?.some(req => req.ok === false))
}

/** 更新已安装的 Bot。默认保留本机 config.yaml（可能改过模型）；按住 Shift 点或点“含配置”会连配置一起更新。 */
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

function CardActionButton({
  item,
  state,
  onInstall,
  onOpenBot
}: {
  item: StoreBot
  state: InstallState
  onInstall: (item: StoreBot) => void
  onOpenBot: (id: string) => void
}) {
  if (state.kind === 'installed') {
    return (
      <Button
        onClick={event => {
          event.stopPropagation()
          onOpenBot(item.id)
        }}
        size="xs"
        variant="secondary"
      >
        <Codicon name="comment-discussion" size="0.75rem" />
        打开
      </Button>
    )
  }

  if (state.kind === 'installing') {
    return (
      <Button
        disabled
        onClick={event => event.stopPropagation()}
        size="xs"
        variant="secondary"
      >
        <Codicon name="loading" size="0.75rem" spinning />
        安装中
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
      onClick={event => {
        event.stopPropagation()
        onInstall(item)
      }}
      size="xs"
      variant="default"
    >
      <Codicon name="add" size="0.75rem" />
      添加
    </Button>
  )
}

function BotCard({
  item,
  state,
  selected,
  onSelect,
  onInstall,
  onOpenBot
}: {
  item: StoreBot
  state: InstallState
  selected: boolean
  onSelect: (item: StoreBot) => void
  onInstall: (item: StoreBot) => void
  onOpenBot: (id: string) => void
}) {
  const isKit = item.category === 'kit'
  const missingReq = hasMissingReq(item.requires)

  return (
    <article
      className={cn(
        'group relative flex min-w-0 flex-col justify-between gap-3 rounded-lg border border-(--ui-stroke-secondary) bg-(--ui-bg-card) p-3.5 transition-[transform,border-color,box-shadow] duration-150 hover:-translate-y-0.5 hover:border-(--ui-accent)/45 hover:shadow-xs',
        selected && 'border-(--ui-accent) ring-1 ring-(--ui-accent)/30'
      )}
    >
      <div className="flex min-w-0 flex-col gap-2">
        <div className="flex min-w-0 items-start gap-2.5">
          <div
            className={cn(
              'flex size-8 shrink-0 items-center justify-center rounded-lg border border-(--ui-stroke-secondary) bg-(--ui-bg-quinary) text-(--ui-text-secondary) transition-colors group-hover:text-(--ui-accent)',
              isKit && 'text-(--ui-accent)'
            )}
          >
            <Codicon name={item.icon || (isKit ? 'package' : 'hubot')} size="1rem" />
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex min-w-0 items-center gap-1.5">
              <h2 className="min-w-0 truncate text-[0.8125rem] font-semibold leading-snug text-(--ui-text-secondary)">
                <button
                  aria-expanded={selected}
                  aria-haspopup="dialog"
                  className="max-w-full cursor-pointer truncate text-left after:absolute after:inset-0 after:rounded-lg focus-visible:outline-hidden after:focus-visible:outline-2 after:focus-visible:outline-(--ui-accent) after:focus-visible:-outline-offset-2"
                  onClick={() => onSelect(item)}
                  type="button"
                >
                  {item.name}
                </button>
              </h2>
              {isKit && (
                <Badge size="xs" variant="default">
                  套装{item.bots?.length ? ` · ${item.bots.length}` : ''}
                </Badge>
              )}
              {state.kind === 'installed' && (
                <span
                  aria-label="已安装"
                  className="ml-auto inline-flex shrink-0 items-center gap-1 text-[0.6875rem] text-(--ui-success)"
                >
                  <Codicon name="check" size="0.7rem" />
                </span>
              )}
            </div>
            <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-(--ui-text-tertiary)">
              {item.summary}
            </p>
          </div>
        </div>
      </div>

      <div className="flex min-w-0 items-end justify-between gap-2 pt-1">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1">
          {item.tags?.map(tag => (
            <Badge key={tag} size="xs" variant="muted">
              {tag}
            </Badge>
          ))}
          {missingReq && state.kind !== 'installed' && (
            <span className="inline-flex items-center gap-0.5 px-1 text-[0.65rem] text-(--ui-warning)">
              <Codicon name="warning" size="0.6875rem" />
              <span>依赖待配</span>
            </span>
          )}
        </div>

        <div className="relative z-10 shrink-0">
          <CardActionButton item={item} onInstall={onInstall} onOpenBot={onOpenBot} state={state} />
        </div>
      </div>
    </article>
  )
}

function StoreSkeletonGrid() {
  return (
    <div
      aria-busy="true"
      aria-label="正在加载商店目录"
      className="grid grid-cols-1 gap-3 @min-[601px]:grid-cols-2 @min-[920px]:grid-cols-3"
    >
      {SKELETON_KEYS.map(key => (
        <div
          className="flex flex-col justify-between gap-3 rounded-lg border border-(--ui-stroke-secondary) bg-(--ui-bg-card) p-3.5"
          key={key}
        >
          <div className="flex items-start gap-2.5">
            <Skeleton className="size-8 shrink-0 rounded-lg" />
            <div className="min-w-0 flex-1 space-y-2">
              <Skeleton className="h-3.5 w-2/5 rounded" />
              <Skeleton className="h-3 w-full rounded" />
              <Skeleton className="h-3 w-4/5 rounded" />
            </div>
          </div>
          <div className="flex items-center justify-between pt-1">
            <div className="flex gap-1">
              <Skeleton className="h-4 w-11 rounded" />
              <Skeleton className="h-4 w-11 rounded" />
            </div>
            <Skeleton className="h-6 w-14 rounded" />
          </div>
        </div>
      ))}
    </div>
  )
}

function StoreDetailDrawer({
  item,
  parentKit,
  allItems,
  installState,
  onClose,
  onInstall,
  onOpenBot,
  onSelectBot,
  onBackToKit,
  onUpdate
}: {
  onUpdate?: StorePageProps['onUpdate']
  item: StoreBot | null
  parentKit: StoreBot | null
  allItems: StoreBot[]
  installState: (id: string) => InstallState
  onClose: () => void
  onInstall: (item: StoreBot) => void
  onOpenBot: (id: string) => void
  onSelectBot: (item: StoreBot, fromKit: StoreBot) => void
  onBackToKit: () => void
}) {
  const [copied, setCopied] = useState(false)
  const copyTimerRef = useRef<number | undefined>(undefined)
  const panelRef = useRef<HTMLElement | null>(null)

  // Retain the last displayed item during the 200ms slide-out transition
  const lastItemRef = useRef<StoreBot | null>(item)
  if (item) {
    lastItemRef.current = item
  }
  const activeItem = item ?? lastItemRef.current
  const activeState = activeItem ? installState(activeItem.id) : null
  const open = item !== null

  useEffect(() => {
    setCopied(false)
    return () => {
      if (copyTimerRef.current !== undefined) {
        window.clearTimeout(copyTimerRef.current)
      }
    }
  }, [activeItem?.id])

  useEffect(() => {
    if (!open) return undefined
    const timer = window.setTimeout(() => {
      panelRef.current?.focus()
    }, 20)
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation()
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.clearTimeout(timer)
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [open, onClose])

  const copyRepo = async () => {
    if (!activeItem) return
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(activeItem.repo || '')
      }
      setCopied(true)
      if (copyTimerRef.current !== undefined) {
        window.clearTimeout(copyTimerRef.current)
      }
      copyTimerRef.current = window.setTimeout(() => setCopied(false), 1800)
    } catch {
      // Clipboard write unavailable in restricted context
    }
  }

  const isKit = activeItem?.category === 'kit'
  const requires = activeItem?.requires ?? []
  const missingReq = hasMissingReq(requires)
  const kitBots = useMemo(() => {
    if (!activeItem?.bots?.length) return []
    const map = new Map(allItems.map(entry => [entry.id, entry]))
    return activeItem.bots.map(botId => ({
      id: botId,
      bot: map.get(botId),
      botState: installState(botId)
    }))
  }, [activeItem, allItems, installState])

  return (
    <div
      aria-hidden={!open}
      className={cn(
        'absolute inset-0 z-40 overflow-hidden transition-opacity duration-200',
        open ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0'
      )}
      inert={!open || undefined}
    >
      {/* Semi-transparent Backdrop */}
      <div
        aria-label="关闭详情抽屉"
        className="absolute inset-0 bg-(--ui-text-secondary)/20 backdrop-blur-[2px]"
        onClick={onClose}
      />

      {/* Drawer Panel */}
      <aside
        aria-label={activeItem ? `${activeItem.name} 详情` : 'Bot 详情'}
        aria-modal="true"
        className={cn(
          'absolute top-0 right-0 flex h-full w-full max-w-[26rem] flex-col border-l border-(--ui-stroke-secondary) bg-(--ui-bg-elevated) shadow-xl transition-[transform,visibility] duration-200 ease-out focus:outline-hidden',
          open ? 'visible translate-x-0' : 'invisible translate-x-full'
        )}
        ref={panelRef}
        role="dialog"
        tabIndex={-1}
      >
        {activeItem && activeState ? (
          <>
            {/* Optional Breadcrumb back to Kit */}
            {parentKit && parentKit.id !== activeItem.id && (
              <div className="flex items-center border-b border-(--ui-stroke-secondary) bg-(--ui-bg-card) px-4 py-1.5">
                <Button onClick={onBackToKit} size="inline" variant="text">
                  <Codicon name="arrow-left" size="0.75rem" />
                  <span>返回「{parentKit.name}」</span>
                </Button>
              </div>
            )}

            {/* Drawer Header */}
            <header className="flex items-start justify-between gap-3 border-b border-(--ui-stroke-secondary) px-4 py-3.5">
              <div className="flex min-w-0 items-start gap-2.5">
                <div
                  className={cn(
                    'flex size-9 shrink-0 items-center justify-center rounded-lg border border-(--ui-stroke-secondary) bg-(--ui-bg-card) text-(--ui-text-secondary)',
                    isKit && 'text-(--ui-accent)'
                  )}
                >
                  <Codicon name={activeItem.icon || (isKit ? 'package' : 'hubot')} size="1.125rem" />
                </div>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <h3 className="text-sm font-semibold leading-snug text-(--ui-text-secondary)">
                      {activeItem.name}
                    </h3>
                    <Badge size="xs" variant={isKit ? 'default' : 'muted'}>
                      {isKit ? '场景套装' : '通用 Bot'}
                    </Badge>
                  </div>
                  <p className="mt-0.5 text-xs leading-relaxed text-(--ui-text-tertiary)">
                    {activeItem.summary}
                  </p>
                </div>
              </div>

              <Button
                aria-label="关闭详情"
                onClick={onClose}
                size="icon-xs"
                variant="ghost"
              >
                <Codicon name="close" size="0.875rem" />
              </Button>
            </header>

            {/* Drawer Body */}
            <div className="flex-1 space-y-4 overflow-y-auto px-4 py-3.5 text-xs">
              {/* Tags */}
              {activeItem.tags && activeItem.tags.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {activeItem.tags.map(tag => (
                    <Badge key={tag} size="xs" variant="muted">
                      {tag}
                    </Badge>
                  ))}
                </div>
              )}

              {/* Detailed Description */}
              <section className="space-y-1.5">
                <h4 className="text-[0.6875rem] font-semibold uppercase tracking-wider text-(--ui-text-quaternary)">
                  详细介绍
                </h4>
                <div className="whitespace-pre-wrap leading-relaxed text-(--ui-text-secondary)">
                  {activeItem.description || activeItem.summary}
                </div>
              </section>

              {/* Kit Included Bots */}
              {isKit && kitBots.length > 0 && (
                <section className="min-w-0 space-y-1.5">
                  <h4 className="text-[0.6875rem] font-semibold uppercase tracking-wider text-(--ui-text-quaternary)">
                    包含的 Bot（{kitBots.length}）
                  </h4>
                  <ul className="grid min-w-0 gap-1.5">
                    {kitBots.map(({ id, bot, botState }) => (
                      <li
                        className="flex min-w-0 items-center justify-between gap-2 rounded-lg border border-(--ui-stroke-secondary) bg-(--ui-bg-card) px-2.5 py-2"
                        key={id}
                      >
                        <div className="flex min-w-0 flex-1 items-center gap-2">
                          <Codicon
                            className="shrink-0 text-(--ui-text-tertiary)"
                            name={bot?.icon || 'hubot'}
                            size="0.875rem"
                          />
                          <div className="min-w-0 flex-1">
                            <div className="flex min-w-0 items-center gap-1.5">
                              <span className="truncate font-medium text-(--ui-text-secondary)">
                                {bot ? bot.name : id}
                              </span>
                              {botState.kind === 'installed' && (
                                <span
                                  aria-label="已安装"
                                  className="inline-flex shrink-0 items-center text-(--ui-success)"
                                >
                                  <Codicon name="check" size="0.6875rem" />
                                </span>
                              )}
                            </div>
                            {bot?.summary && (
                              <div className="truncate text-[0.6875rem] text-(--ui-text-tertiary)">
                                {bot.summary}
                              </div>
                            )}
                          </div>
                        </div>
                        {bot && (
                          <Button
                            className="shrink-0"
                            onClick={() => onSelectBot(bot, activeItem)}
                            size="xs"
                            variant="ghost"
                          >
                            查看
                          </Button>
                        )}
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              {/* Requirements Checklist */}
              <section className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <h4 className="text-[0.6875rem] font-semibold uppercase tracking-wider text-(--ui-text-quaternary)">
                    依赖清单
                  </h4>
                  {requires.some(r => r.ok !== undefined) && (
                    <span className="text-[0.6875rem] text-(--ui-text-quaternary)">
                      {requires.filter(r => r.ok === true).length}/{requires.length} 就绪
                    </span>
                  )}
                </div>

                {requires.length === 0 ? (
                  <div className="rounded-lg border border-(--ui-stroke-secondary) bg-(--ui-bg-card) px-3 py-2 text-(--ui-text-tertiary)">
                    无需额外命令或环境变量依赖，开箱即用。
                  </div>
                ) : (
                  <ul className="grid gap-1.5">
                    {requires.map(req => {
                      // ok 为 undefined 表示没检测（第一版不自动检测），显示中性圆点而不是 ✓/✗
                      const ok = req.ok
                      return (
                        <li
                          className="flex items-start gap-2 rounded-lg border border-(--ui-stroke-secondary) bg-(--ui-bg-card) px-2.5 py-2"
                          key={`${req.kind}:${req.name}`}
                        >
                          <span
                            aria-label={ok === undefined ? '需要' : ok ? '已满足' : '未满足'}
                            className={cn(
                              'mt-0.5 flex size-4 shrink-0 items-center justify-center rounded font-semibold',
                              ok === undefined ? 'text-(--ui-text-quaternary)' : ok ? 'text-(--ui-success)' : 'text-(--ui-warning)'
                            )}
                          >
                            {ok === undefined ? '•' : ok ? '✓' : '✗'}
                          </span>
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <code className="font-mono text-[0.75rem] font-semibold text-(--ui-text-secondary)">
                                {req.name}
                              </code>
                              <Badge size="xs" variant="outline">
                                {req.kind === 'command' ? '命令' : '环境变量'}
                              </Badge>
                            </div>
                            {req.hint && (
                              <p className="mt-0.5 text-[0.6875rem] leading-snug text-(--ui-text-tertiary)">
                                {req.hint}
                              </p>
                            )}
                          </div>
                        </li>
                      )
                    })}
                  </ul>
                )}
              </section>

              {/* 预设内容：创建后自动套用 */}
              {[
                ['工具集', activeItem.toolsets],
                ['技能', activeItem.skills],
                ['MCP', activeItem.mcp?.map(m => m.name)]
              ].map(([label, list]) =>
                (list as string[] | undefined)?.length ? (
                  <section className="space-y-1.5" key={label as string}>
                    <h4 className="text-[0.6875rem] font-semibold uppercase tracking-wider text-(--ui-text-quaternary)">
                      {label as string}
                    </h4>
                    <div className="flex flex-wrap gap-1">
                      {(list as string[]).map(name => (
                        <span
                          className="rounded border border-(--ui-stroke-secondary) bg-(--ui-bg-quinary) px-1.5 py-0.5 font-mono text-[0.6875rem] text-(--ui-text-secondary)"
                          key={name}
                        >
                          {name}
                        </span>
                      ))}
                    </div>
                  </section>
                ) : null
              )}

              {/* Repository Link */}
              {activeItem.repo ? (
              <section className="space-y-1.5">
                <h4 className="text-[0.6875rem] font-semibold uppercase tracking-wider text-(--ui-text-quaternary)">
                  仓库地址
                </h4>
                <div className="flex items-center justify-between gap-2 rounded-lg border border-(--ui-stroke-secondary) bg-(--ui-bg-card) px-2.5 py-1.5">
                  <div className="flex min-w-0 items-center gap-1.5 text-(--ui-text-tertiary)">
                    <Codicon className="shrink-0" name="repo" size="0.8rem" />
                    <code className="truncate font-mono text-[0.6875rem] text-(--ui-text-secondary)">
                      {activeItem.repo}
                    </code>
                  </div>
                  <Button
                    aria-label={copied ? '已复制仓库地址' : '复制仓库地址'}
                    onClick={() => void copyRepo()}
                    size="xs"
                    variant="ghost"
                  >
                    <Codicon
                      className={cn(copied && 'text-(--ui-success)')}
                      name={copied ? 'check' : 'copy'}
                      size="0.75rem"
                    />
                    <span>{copied ? '已复制' : '复制'}</span>
                  </Button>
                </div>
              </section>
              ) : null}

              {/* Install Error Detail inside Drawer */}
              {activeState.kind === 'error' && (
                <section className="rounded-lg border border-(--ui-warning)/40 bg-(--ui-bg-card) px-3 py-2">
                  <div className="flex items-center gap-1.5 font-medium text-(--ui-warning)">
                    <Codicon name="warning" size="0.8rem" />
                    <span>上次安装失败</span>
                  </div>
                  <p className="mt-1 font-mono text-[0.6875rem] leading-relaxed text-(--ui-text-tertiary)">
                    {activeState.message}
                  </p>
                </section>
              )}
            </div>

            {/* Drawer Footer */}
            <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-(--ui-stroke-secondary) bg-(--ui-bg-card) px-4 py-3">
              <div className="min-w-0 flex-1">
                {missingReq && activeState.kind !== 'installed' ? (
                  <div className="flex items-start gap-1.5 text-[0.6875rem] leading-snug text-(--ui-warning)">
                    <Codicon className="mt-0.5 shrink-0" name="warning" size="0.75rem" />
                    <span>缺少依赖，仍可安装但可能无法正常工作</span>
                  </div>
                ) : activeState.kind === 'installed' ? (
                  <div className="flex items-center gap-1.5 text-[0.6875rem] text-(--ui-success)">
                    <Codicon name="check" size="0.75rem" />
                    <span>已安装至当前环境</span>
                  </div>
                ) : (
                  <span className="text-[0.6875rem] text-(--ui-text-quaternary)">
                    打开新建窗口，替你填好人格、工具集、技能和 MCP；默认沿用 default 的模型和 Key
                  </span>
                )}
              </div>

              <div className="flex shrink-0 items-center gap-1.5">
                {onUpdate && activeState.kind === 'installed' && activeItem.category === 'general' ? (
                  <UpdateButton item={activeItem} key={activeItem.id} onUpdate={onUpdate} />
                ) : null}
                <CardActionButton
                  item={activeItem}
                  onInstall={onInstall}
                  onOpenBot={onOpenBot}
                  state={activeState}
                />
              </div>
            </footer>
          </>
        ) : null}
      </aside>
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
  const [category, setCategory] = useState<CategoryTab>('all')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [parentKitId, setParentKitId] = useState<string | null>(null)

  const counts = useMemo(() => {
    let general = 0
    let kit = 0
    for (const item of items) {
      if (item.category === 'kit') kit += 1
      else general += 1
    }
    return { all: items.length, general, kit }
  }, [items])

  const filteredItems = useMemo(() => {
    const q = query.trim().toLowerCase()
    return items.filter(item => {
      if (category !== 'all' && item.category !== category) {
        return false
      }
      if (!q) {
        return true
      }
      const inName = item.name.toLowerCase().includes(q)
      const inSummary = item.summary.toLowerCase().includes(q)
      const inTags = Boolean(item.tags?.some(tag => tag.toLowerCase().includes(q)))
      return inName || inSummary || inTags
    })
  }, [items, category, query])

  const selectedItem = useMemo(
    () => (selectedId ? items.find(item => item.id === selectedId) ?? null : null),
    [items, selectedId]
  )

  const parentKit = useMemo(
    () => (parentKitId ? items.find(item => item.id === parentKitId) ?? null : null),
    [items, parentKitId]
  )

  return (
    <div className="@container relative flex h-full min-h-0 w-full min-w-0 flex-col overflow-hidden bg-(--ui-bg-editor) text-(--ui-text-secondary)">
      {/* Top Header: Title + Subtitle on left, SearchField on right */}
      <header className="flex flex-col gap-3 border-b border-(--ui-stroke-secondary) px-5 pt-4 pb-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <Codicon className="text-(--ui-accent)" name="extensions" size="1rem" />
              <h1 className="text-sm font-semibold tracking-tight text-(--ui-text-secondary)">
                Bot 商店
              </h1>
            </div>
            <p className="mt-0.5 text-xs text-(--ui-text-tertiary)">
              浏览并一键安装预置领域 Bot 与多智能体场景套装，即刻扩展你的本地工作台。
            </p>
          </div>

          <div className="w-full @min-[601px]:w-64">
            <SearchField
              aria-label="搜索 Bot 商店"
              containerClassName="w-full"
              onChange={setQuery}
              onClear={() => setQuery('')}
              placeholder="搜索名称、简介或标签…"
              value={query}
            />
          </div>
        </div>

        {/* Category Tabs */}
        <div className="flex items-center justify-between gap-2">
          <Tabs
            onValueChange={val => setCategory(val as CategoryTab)}
            value={category}
          >
            <TabsList>
              <TabsTrigger value="all">
                全部
                {!loading && !loadError && (
                  <span className="ml-1 text-[0.65rem] tabular-nums text-(--ui-text-quaternary)">
                    {counts.all}
                  </span>
                )}
              </TabsTrigger>
              <TabsTrigger value="general">
                通用 Bot
                {!loading && !loadError && (
                  <span className="ml-1 text-[0.65rem] tabular-nums text-(--ui-text-quaternary)">
                    {counts.general}
                  </span>
                )}
              </TabsTrigger>
              <TabsTrigger value="kit">
                场景套装
                {!loading && !loadError && (
                  <span className="ml-1 text-[0.65rem] tabular-nums text-(--ui-text-quaternary)">
                    {counts.kit}
                  </span>
                )}
              </TabsTrigger>
            </TabsList>
          </Tabs>

          {!loading && !loadError && (query.trim() || category !== 'all') && (
            <span className="text-[0.6875rem] tabular-nums text-(--ui-text-quaternary)">
              显示 {filteredItems.length} / {items.length} 项
            </span>
          )}
        </div>
      </header>

      {/* Main Content Area */}
      <main className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto px-5 py-4">
        {loading ? (
          <StoreSkeletonGrid />
        ) : loadError ? (
          <div
            className="flex min-h-[16rem] flex-col items-center justify-center gap-2.5 rounded-lg border border-(--ui-stroke-secondary) bg-(--ui-bg-card) p-6 text-center"
            role="alert"
          >
            <div className="flex size-9 items-center justify-center rounded-lg border border-(--ui-stroke-secondary) bg-(--ui-bg-quinary) text-(--ui-warning)">
              <Codicon name="error" size="1.125rem" />
            </div>
            <div className="max-w-md space-y-1">
              <div className="text-xs font-semibold text-(--ui-text-secondary)">
                无法加载商店目录
              </div>
              <p className="text-xs leading-relaxed text-(--ui-text-tertiary)">
                {loadError}
              </p>
            </div>
            <Button onClick={onRetryLoad} size="xs" variant="secondary">
              <Codicon name="refresh" size="0.75rem" />
              重试
            </Button>
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="flex min-h-[16rem] flex-col items-center justify-center gap-2.5 rounded-lg border border-(--ui-stroke-secondary) bg-(--ui-bg-card) p-6 text-center">
            <div className="flex size-9 items-center justify-center rounded-lg border border-(--ui-stroke-secondary) bg-(--ui-bg-quinary) text-(--ui-text-quaternary)">
              <Codicon name="search" size="1.125rem" />
            </div>
            <div className="max-w-sm space-y-1">
              <div className="text-xs font-semibold text-(--ui-text-secondary)">
                未找到匹配的 Bot
              </div>
              <p className="text-xs leading-relaxed text-(--ui-text-tertiary)">
                {query.trim()
                  ? `没有与「${query.trim()}」相关的名称、简介或标签，请尝试其他关键词。`
                  : '当前分类下暂无可用的 Bot 或场景套装。'}
              </p>
            </div>
            {(query.trim() || category !== 'all') && (
              <Button
                onClick={() => {
                  setQuery('')
                  setCategory('all')
                }}
                size="xs"
                variant="secondary"
              >
                清除筛选条件
              </Button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 @min-[601px]:grid-cols-2 @min-[920px]:grid-cols-3">
            {filteredItems.map(item => (
              <BotCard
                item={item}
                key={item.id}
                onInstall={onInstall}
                onOpenBot={onOpenBot}
                onSelect={bot => {
                  setParentKitId(null)
                  setSelectedId(bot.id)
                }}
                selected={selectedId === item.id}
                state={installState(item.id)}
              />
            ))}
          </div>
        )}
      </main>

      {/* Detail Drawer */}
      <StoreDetailDrawer
        allItems={items}
        installState={installState}
        item={selectedItem}
        onBackToKit={() => {
          if (parentKitId) {
            setSelectedId(parentKitId)
            setParentKitId(null)
          }
        }}
        onClose={() => {
          setSelectedId(null)
          setParentKitId(null)
        }}
        onInstall={onInstall}
        onUpdate={onUpdate}
        onOpenBot={onOpenBot}
        onSelectBot={(bot, fromKit) => {
          setParentKitId(fromKit.id)
          setSelectedId(bot.id)
        }}
        parentKit={parentKit}
      />
    </div>
  )
}

export default StorePage
