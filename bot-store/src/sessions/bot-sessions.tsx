import * as sdk from '@hermes/plugin-sdk'
import { cn, Codicon, haptic, host, type SessionListRow, Tip, useQuery } from '@hermes/plugin-sdk'
import { useEffect } from 'react'

import { SessionContextMenu } from '@/app/chat/sidebar/session-actions-menu'

import { saveSelectedRosterBot } from '@official-bots/bot-state'
import { CANONICAL_CHAT_TITLE, prepareBotSource, resolveExpectHistory } from '@official-bots/canonical-chat'
import { newBotChat } from '@official-bots/data'
import { openRosterBot } from '@official-bots/roster-actions'
import {
  backendTargetProfile,
  botConnectionRoute,
  botWorkspaceOwnerKey,
  requestForBot,
  setBotsWorkspaceOwner
} from '@official-bots/routing'
import type { RosterRow } from '@official-bots/types'

import { botSessionsQueryKey, deleteBotSession, holdBotSessionRefresh } from './session-menu'

const LIST_LIMIT = 50

/** 展开/收起按钮：放在 Bot 行左侧头像前的空白处（右侧有时间标签），悬停或展开时显示。 */
export function SessionsToggle({ open, onToggle }: { open: boolean; onToggle: () => void }) {
  return (
    <Tip label={open ? '收起对话' : '展开对话'}>
      <button
        aria-expanded={open}
        aria-label={open ? '收起对话' : '展开对话'}
        className={cn(
          'absolute z-10 grid place-items-center rounded',
          'text-(--ui-text-tertiary) hover:bg-(--ui-bg-tertiary) hover:text-foreground',
          open ? 'opacity-100' : 'opacity-0 group-hover/bot-plus:opacity-100 focus-visible:opacity-100'
        )}
        onClick={event => {
          event.stopPropagation()
          onToggle()
        }}
        style={{ top: 17, left: 0, width: 14, height: 16, fontSize: 11 }}
        type="button"
      >
        <Codicon className={cn('transition-transform duration-150', open && 'rotate-90')} name="chevron-right" />
      </button>
    </Tip>
  )
}

/** 该 Bot 的会话列表：固定对话置顶，其余按时间倒序；底部“新对话”。 */
export function BotSessions({ bot }: { bot: RosterRow }) {
  const query = useQuery({
    queryKey: botSessionsQueryKey(bot),
    queryFn: () => listBotSessions(bot),
    refetchInterval: 10_000,
    staleTime: 5_000
  })

  useEffect(() => holdBotSessionRefresh(), [])

  const sessions = query.data || []

  return (
    <div className="mb-1 flex flex-col border-l border-(--ui-stroke-tertiary) pl-2" style={{ marginLeft: 44, marginRight: 8 }}>
      <SessionLine icon="pinned" onClick={() => void openRosterBot(bot)} title="固定对话" />
      {query.isLoading ? <p className="px-2 py-1 text-[0.75rem] text-(--ui-text-quaternary)">加载中…</p> : null}
      {query.error ? <p className="px-2 py-1 text-[0.75rem] text-(--ui-warning)">读取对话失败</p> : null}
      {sessions.map(row => {
        const sessionId = row.session_id || row.id
        const title = row.title || row.preview || '未命名对话'

        return (
          <SessionContextMenu
            key={sessionId}
            onDelete={() =>
              deleteBotSession(bot, sessionId).catch(error => {
                host.notifyError?.(error, '删除对话失败')
              })
            }
            profile={bot.name}
            sessionId={sessionId}
            surface="row"
            title={title}
          >
            <SessionLine meta={relativeTime(row.started_at)} onClick={() => void openBotSession(bot, row)} title={title} />
          </SessionContextMenu>
        )
      })}
      <SessionLine
        icon="add"
        muted
        onClick={() => {
          saveSelectedRosterBot(bot)
          setBotsWorkspaceOwner(botWorkspaceOwnerKey(bot), bot)
          newBotChat(bot)
        }}
        title="新对话"
      />
    </div>
  )
}

function SessionLine({ icon = 'comment', meta, muted, onClick, title }: {
  icon?: string
  meta?: string
  muted?: boolean
  onClick: () => void
  title: string
}) {
  return (
    <button
      className={cn(
        'flex h-7 items-center gap-1.5 rounded-md px-2 text-left text-[0.78125rem]',
        'hover:bg-(--ui-bg-tertiary) transition-colors',
        muted ? 'text-(--ui-text-tertiary)' : 'text-(--ui-text-secondary)'
      )}
      onClick={onClick}
      title={title}
      type="button"
    >
      <Codicon className="shrink-0 text-(--ui-text-quaternary)" name={icon} />
      <span className="min-w-0 flex-1 truncate">{title}</span>
      {meta ? <span className="shrink-0 text-[0.6875rem] text-(--ui-text-quaternary)">{meta}</span> : null}
    </button>
  )
}

/** 官方 session.list（stored）返回的行：比 SessionListRow 多一个 session_id。 */
type BotSessionRow = SessionListRow & { session_id?: string }

async function listBotSessions(bot: RosterRow): Promise<BotSessionRow[]> {
  const route = botConnectionRoute(bot)
  const profile = backendTargetProfile(route, bot.name)

  // stored = 历史会话，live = 当前正在打开/运行的会话；两者互不包含，要合并
  const fetchScope = (scope: 'live' | 'stored') =>
    requestForBot<{ sessions?: BotSessionRow[] }>(bot, 'session.list', {
      profile,
      scope,
      // 在 Bot 工作区打开过的会话会被标为隐藏（不进主会话列表），这里要把它们也列出来
      include_hidden: true,
      limit: LIST_LIMIT
    }).then(res => res?.sessions || [])

  const [stored, live] = await Promise.all([fetchScope('stored'), fetchScope('live').catch(() => [])])
  const byId = new Map<string, BotSessionRow>()

  for (const row of [...live, ...stored]) {
    const id = row.session_id || row.id

    if (id && !byId.has(id)) {
      byId.set(id, row)
    }
  }

  // 去掉 Bot 模式自己的“管道”会话：固定对话、收件箱、群聊成员会话（与官方 session-sweep 的规则一致）
  return [...byId.values()]
    .filter(row => !isPlumbingTitle(row.title))
    .sort((a, b) => (b.started_at || 0) - (a.started_at || 0))
}

function isPlumbingTitle(title?: null | string): boolean {
  const t = String(title || '').trim()

  return t === CANONICAL_CHAT_TITLE || t === 'Agent Inbox' || t.startsWith('Group: ')
}

/** 在 Bot 的工作区里以新标签打开某条会话（与官方“Open recent session”同一套参数）。 */
async function openBotSession(bot: RosterRow, row: BotSessionRow): Promise<void> {
  const sessionId = row.session_id || row.id

  if (typeof host.openSession !== 'function') {
    void openRosterBot(bot)

    return
  }

  haptic('tap')
  saveSelectedRosterBot(bot)
  const ownerKey = botWorkspaceOwnerKey(bot)
  setBotsWorkspaceOwner(ownerKey, bot)

  try {
    await prepareBotSource(bot)
    const route = botConnectionRoute(bot)

    await host.openSession(sessionId, {
      ...(route ? { route } : {}),
      profile: bot.name,
      intent: 'tab',
      awaitHydration: true,
      expectHistory: resolveExpectHistory(row),
      forceResume: true,
      hydrationTimeoutMs: Number.isFinite(sdk.BOT_CHAT_SESSION_HYDRATION_TIMEOUT_MS)
        ? sdk.BOT_CHAT_SESSION_HYDRATION_TIMEOUT_MS
        : 60_000,
      keepAllProfilesScope: true,
      workspaceMode: 'bots',
      workspaceOwnerKey: ownerKey,
      retryHydrationTimeoutOnce: true
    })
  } catch (error) {
    host.notifyError?.(error, '打开对话失败')
  }
}

function relativeTime(seconds?: number): string {
  if (!seconds) {
    return ''
  }

  const diff = Date.now() / 1000 - seconds

  if (diff < 3600) {
    return `${Math.max(1, Math.round(diff / 60))} 分钟`
  }

  if (diff < 86_400) {
    return `${Math.round(diff / 3600)} 小时`
  }

  return `${Math.round(diff / 86_400)} 天`
}
