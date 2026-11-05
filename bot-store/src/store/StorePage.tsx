// 临时的简版商店页面，只为先把流程跑通；G03 交回后整体替换（props 不变）。
import { Button, cn, Codicon, Skeleton } from '@hermes/plugin-sdk'

import type { InstallState, StoreBot, StorePageProps } from './store-types'

export function StorePage({ items, loading, loadError, installState, onInstall, onOpenBot, onRetryLoad }: StorePageProps) {
  return (
    <div className="h-full overflow-y-auto px-6 py-5">
      <h1 className="text-lg font-semibold">Bot 商店</h1>
      <p className="mt-1 text-[0.8125rem] text-(--ui-text-tertiary)">配置好的 Bot，一键安装到左侧 BOTS 列表。</p>

      {loadError ? (
        <div className="mt-6 rounded-lg border border-(--ui-stroke-secondary) p-4 text-[0.8125rem]">
          <p className="text-(--ui-warning)">{loadError}</p>
          <Button className="mt-3" onClick={onRetryLoad} size="sm" variant="outline">
            重试
          </Button>
        </div>
      ) : null}

      <div className="mt-5 grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))" }}>
        {loading
          ? [0, 1, 2].map(i => <Skeleton className="h-28 rounded-lg" key={i} />)
          : items.map(item => (
              <Card item={item} key={item.id} onInstall={onInstall} onOpenBot={onOpenBot} state={installState(item.id)} />
            ))}
      </div>
    </div>
  )
}

function Card({ item, state, onInstall, onOpenBot }: {
  item: StoreBot
  state: InstallState
  onInstall: (item: StoreBot) => void
  onOpenBot: (id: string) => void
}) {
  const needs = item.requires || []

  return (
    <div className="flex flex-col rounded-lg border border-(--ui-stroke-secondary) p-3">
      <div className="flex items-center gap-2">
        <Codicon name={item.icon || 'hubot'} />
        <span className="font-medium">{item.name}</span>
        {item.category === 'kit' ? <span className="text-[0.6875rem] text-(--ui-text-quaternary)">套装</span> : null}
      </div>
      <p className="mt-1.5 flex-1 text-[0.8125rem] text-(--ui-text-tertiary)">{item.summary}</p>
      {needs.length ? (
        <p className="mt-1 text-[0.75rem] text-(--ui-text-quaternary)">需要：{needs.map(r => r.hint || r.name).join('、')}</p>
      ) : null}
      {state.kind === 'error' ? (
        <pre className="mt-1 max-h-24 overflow-auto whitespace-pre-wrap text-[0.6875rem] text-(--ui-warning)">{state.message}</pre>
      ) : null}
      <div className="mt-2 flex justify-end">
        {state.kind === 'installed' ? (
          <Button onClick={() => onOpenBot(item.id)} size="sm" variant="outline">打开</Button>
        ) : (
          <Button
            className={cn(state.kind === 'installing' && 'opacity-60')}
            disabled={state.kind === 'installing'}
            onClick={() => onInstall(item)}
            size="sm"
          >
            {state.kind === 'installing' ? '安装中…' : state.kind === 'error' ? '重试' : '安装'}
          </Button>
        )}
      </div>
    </div>
  )
}
