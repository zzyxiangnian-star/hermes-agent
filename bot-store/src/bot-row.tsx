// 替换官方 bot-row：每个 Bot 行下面可以展开它的多个对话。
// 固定对话（标题为 “Bot Chat” 的那条）规则不动：点 Bot 行照旧打开它；展开列表里它固定置顶。
import { BotRow as OfficialBotRow } from '@official-bots/bot-row'
import { useState } from 'react'

import { BotSessions, SessionsToggle } from './sessions/bot-sessions'
import { isExpanded, setExpanded } from './sessions/expanded'

export * from '@official-bots/bot-row'

export function BotRow(props: Parameters<typeof OfficialBotRow>[0]) {
  const name = props.bot.name
  const [open, setOpen] = useState(() => isExpanded(name))

  const toggle = () => {
    setExpanded(name, !open)
    setOpen(!open)
  }

  return (
    <div className="group/bot-plus relative">
      <OfficialBotRow {...props} />
      <SessionsToggle onToggle={toggle} open={open} />
      {open ? <BotSessions bot={props.bot} /> : null}
    </div>
  )
}
