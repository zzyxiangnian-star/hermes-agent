// 设置 → 插件 → Bot 商店：可以改商品目录地址（例如换成自己的 fork 或本机文件）。
import { Button, Input, ListRow, type PluginContext } from '@hermes/plugin-sdk'
import { useState } from 'react'

import { DEFAULT_CATALOG_URL, setCatalogUrl, storedCatalogUrl } from './constants'

export function registerStoreSettings(ctx: PluginContext) {
  setCatalogUrl(String(ctx.storage.get('catalogUrl', '') || ''))

  ctx.registerSettingsPage?.({
    id: 'bot-store',
    title: 'Bot 商店',
    icon: 'extensions',
    render: () => <CatalogSetting onSave={url => ctx.storage.set('catalogUrl', url)} />
  })
}

function CatalogSetting({ onSave }: { onSave: (url: string) => void }) {
  const [value, setValue] = useState(storedCatalogUrl())
  const [saved, setSaved] = useState(false)

  const save = (url: string) => {
    const trimmed = url.trim()
    setCatalogUrl(trimmed)
    onSave(trimmed)
    setValue(trimmed)
    setSaved(true)
  }

  return (
    <ListRow
      below={
        <div className="flex flex-col gap-2">
          <Input
            onChange={event => {
              setValue(event.target.value)
              setSaved(false)
            }}
            placeholder={DEFAULT_CATALOG_URL}
            value={value}
          />
          <div className="flex items-center gap-2">
            <Button onClick={() => save(value)} size="sm">
              保存
            </Button>
            <Button onClick={() => save('')} size="sm" variant="ghost">
              恢复默认
            </Button>
            {saved ? <span className="text-[0.75rem] text-(--ui-success)">已保存，重新打开商店生效</span> : null}
          </div>
        </div>
      }
      description="catalog.yaml 的地址，留空使用默认（zzyxiangnian-star/hermes-bot-store 的 main 分支）。"
      title="商品目录地址"
      wide
    />
  )
}
