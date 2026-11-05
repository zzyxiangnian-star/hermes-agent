// 商店页面的“容器”：读目录、判断已添加、点“添加”时排队打开官方“新建机器人”窗口（预填好）。
// 界面本身在 StorePage（G03 Gemini 做的版本）。
import { useValue } from '@hermes/plugin-sdk'
import { useCallback, useEffect, useMemo, useState } from 'react'

import { saveBotMeta, useRoster } from '@official-bots/data'
import { openRosterBot } from '@official-bots/roster-actions'

import { $presetQueue, queuePresets } from '../preset/queue'
import { fetchCatalog } from './catalog'
import { catalogUrl } from './constants'
import { StorePage } from './StorePage'
import type { InstallState, StoreBot } from './store-types'

export function StoreRoute() {
  const [items, setItems] = useState<StoreBot[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string>()
  const roster = useRoster()
  const queue = useValue($presetQueue)

  const installed = useMemo(() => {
    const list = roster.data?.profiles || []

    return new Map(list.map(bot => [bot.name, bot]))
  }, [roster.data])

  const load = useCallback(async () => {
    setLoading(true)
    setLoadError(undefined)

    try {
      setItems(await fetchCatalog(catalogUrl()))
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : String(error))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  // 早期用配方装的 Bot 没有中文标题（侧栏显示 bot-dev 这类名字）：打开商店时补上一次。
  useEffect(() => {
    for (const item of items) {
      const bot = installed.get(item.id)
      const title = bot?.ui_meta?.['hermes-bots']?.title || (typeof bot?.title === 'string' ? bot.title : '')

      if (bot && item.category !== 'kit' && !String(title).trim()) {
        void saveBotMeta(item.id, { title: item.name }).catch(() => undefined)
      }
    }
  }, [installed, items])

  const installState = useCallback(
    (id: string): InstallState => {
      const item = items.find(i => i.id === id)
      const one = (botId: string): InstallState =>
        installed.has(botId)
          ? { kind: 'installed' }
          : queue.some(q => q.id === botId)
            ? { kind: 'installing' }
            : { kind: 'idle' }

      // 套装：里面的 Bot 全部添加了才算已添加
      if (item?.category === 'kit') {
        const parts = (item.bots || []).map(one)

        return (
          parts.find(p => p.kind === 'installing') ||
          (parts.length && parts.every(p => p.kind === 'installed') ? { kind: 'installed' } : { kind: 'idle' })
        )
      }

      return one(id)
    },
    [installed, items, queue]
  )

  const onInstall = useCallback(
    (item: StoreBot) => {
      const targets = item.category === 'kit' ? items.filter(i => item.bots?.includes(i.id)) : [item]
      queuePresets(targets.filter(t => !installed.has(t.id) && !$presetQueue.get().some(q => q.id === t.id)))
    },
    [installed, items]
  )

  const onOpenBot = useCallback(
    (id: string) => {
      // 套装没有自己的 Bot，打开它包含的第一个
      const kit = items.find(i => i.id === id && i.category === 'kit')
      const bot = installed.get(kit?.bots?.[0] ?? id)

      if (bot) {
        void openRosterBot(bot)
      }
    },
    [installed, items]
  )

  return (
    <StorePage
      installState={installState}
      items={items}
      loadError={loadError}
      loading={loading}
      onInstall={onInstall}
      onOpenBot={onOpenBot}
      onRetryLoad={() => void load()}
    />
  )
}
