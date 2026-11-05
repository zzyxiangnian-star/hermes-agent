// 商店页面的“容器”：读目录、查依赖、安装、判断已安装、打开 Bot。
// 界面本身在 StorePage（G03 交回后替换为 Gemini 做的版本，props 不变）。
import { queryClient } from '@hermes/plugin-sdk'
import { useCallback, useEffect, useMemo, useState } from 'react'

import { ROSTER_KEY, useRoster } from '@official-bots/data'
import { openRosterBot } from '@official-bots/roster-actions'

import { fetchCatalog } from './catalog'
import { catalogUrl } from './constants'
import { checkRequirements, installBot, updateBot } from './install'
import { StorePage } from './StorePage'
import type { InstallState, StoreBot } from './store-types'

export function StoreRoute() {
  const [items, setItems] = useState<StoreBot[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string>()
  const [states, setStates] = useState<Record<string, InstallState>>({})
  const roster = useRoster()

  const installed = useMemo(() => {
    const list = roster.data?.profiles || []

    return new Map(list.map(bot => [bot.name, bot]))
  }, [roster.data])

  const load = useCallback(async () => {
    setLoading(true)
    setLoadError(undefined)

    try {
      const catalog = await fetchCatalog(catalogUrl())
      setItems(catalog)
      setLoading(false)
      // 依赖检查较慢，列表先出来，检查结果到了再补上
      const checked = await Promise.all(catalog.map(async item => ({ ...item, requires: await checkRequirements(item.requires) })))
      setItems(checked)
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : String(error))
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const installState = useCallback(
    (id: string): InstallState => {
      const item = items.find(i => i.id === id)

      // 套装：看里面每个 Bot 的状态——有一个在装就是“安装中”，全部装好才算“已安装”
      if (item?.category === 'kit') {
        const parts = (item.bots || []).map(bot => states[bot] || (installed.has(bot) ? { kind: 'installed' } : { kind: 'idle' }))

        return (
          parts.find(p => p.kind === 'installing' || p.kind === 'error') ||
          (parts.length && parts.every(p => p.kind === 'installed') ? { kind: 'installed' } : { kind: 'idle' })
        ) as InstallState
      }

      return states[id] || (installed.has(id) ? { kind: 'installed' } : { kind: 'idle' })
    },
    [installed, items, states]
  )

  const onInstall = useCallback(async (item: StoreBot) => {
    const targets = item.category === 'kit' ? items.filter(i => item.bots?.includes(i.id)) : [item]

    for (const target of targets) {
      if (installed.has(target.id)) {
        continue
      }

      setStates(s => ({ ...s, [target.id]: { kind: 'installing' } }))

      try {
        await installBot(target)
        await queryClient.invalidateQueries({ queryKey: ROSTER_KEY })
        setStates(s => ({ ...s, [target.id]: { kind: 'installed' } }))
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        setStates(s => ({ ...s, [target.id]: { kind: 'error', message } }))

        return
      }
    }
  }, [installed, items])

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

  const onUpdate = useCallback(async (item: StoreBot, forceConfig: boolean) => {
    const message = await updateBot(item.id, forceConfig)
    await queryClient.invalidateQueries({ queryKey: ROSTER_KEY })

    return message
  }, [])

  return (
    <StorePage
      installState={installState}
      items={items}
      loadError={loadError}
      loading={loading}
      onInstall={item => void onInstall(item)}
      onOpenBot={onOpenBot}
      onRetryLoad={() => void load()}
      onUpdate={onUpdate}
    />
  )
}
