// 替换官方 roster-pane-toolbar：在 BOTS 标题行正上方加“Bot 商店”入口，其余原样渲染。
// 另外：商店排了预设时，用官方的 setCreateOpen 打开“新建机器人”窗口（窗口里的预填见 build 脚本的补丁）。
import { useValue } from '@hermes/plugin-sdk'
import { useEffect } from 'react'

import { renderRosterToolbar as officialToolbar } from '@official-bots/roster-pane-toolbar'

import { $presetQueue } from './preset/queue'
import { StoreEntryButton } from './store/entry-button'

export * from '@official-bots/roster-pane-toolbar'

type ToolbarProps = Parameters<typeof officialToolbar>[0]

function PresetOpener({ setCreateOpen }: { setCreateOpen: ToolbarProps['setCreateOpen'] }) {
  const queue = useValue($presetQueue)

  useEffect(() => {
    if (queue.length) {
      setCreateOpen(true)
    }
  }, [queue, setCreateOpen])

  return null
}

export function renderRosterToolbar(props: ToolbarProps) {
  return (
    <>
      <PresetOpener setCreateOpen={props.setCreateOpen} />
      <StoreEntryButton />
      {officialToolbar(props)}
    </>
  )
}
