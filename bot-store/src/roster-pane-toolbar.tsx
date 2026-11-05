// 替换官方 roster-pane-toolbar：在 BOTS 标题行正上方加“Bot 商店”入口，其余原样渲染。
import { renderRosterToolbar as officialToolbar } from '@official-bots/roster-pane-toolbar'

import { StoreEntryButton } from './store/entry-button'

export * from '@official-bots/roster-pane-toolbar'

export function renderRosterToolbar(props: Parameters<typeof officialToolbar>[0]) {
  return (
    <>
      <StoreEntryButton />
      {officialToolbar(props)}
    </>
  )
}
