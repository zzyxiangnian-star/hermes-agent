import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { RosterRow } from '@official-bots/types'

type MenuProps = {
  onArchive?: unknown
  onBranch?: unknown
  onDelete?: () => Promise<unknown> | void
  onPin?: unknown
  onToggleUnread?: unknown
  profile?: string
  sessionId?: string
  surface?: string
  title?: string
}

type SessionFixture = { id: string; preview?: string; session_id?: string; title?: string }

const { deleteSession, invalidateQueries, menus, notifyError, sessions } = vi.hoisted(() => ({
  deleteSession: vi.fn(),
  invalidateQueries: vi.fn(),
  menus: [] as MenuProps[],
  notifyError: vi.fn(),
  sessions: [] as SessionFixture[]
}))

vi.mock('@hermes/plugin-sdk', () => ({
  cn: (...parts: Array<false | null | string | undefined>) => parts.filter(Boolean).join(' '),
  Codicon: () => null,
  haptic: vi.fn(),
  host: { notifyError },
  queryClient: { invalidateQueries },
  Tip: ({ children }: { children?: unknown }) => children,
  useQuery: () => ({ data: sessions, error: null, isLoading: false })
}))

vi.mock('@/hermes', () => ({
  deleteSession: (...args: unknown[]) => deleteSession(...args)
}))

vi.mock('@/app/chat/sidebar/session-actions-menu', () => ({
  SessionContextMenu: ({ children, ...props }: MenuProps & { children?: unknown }) => {
    menus.push(props)

    return children
  }
}))

vi.mock('@official-bots/bot-state', () => ({ saveSelectedRosterBot: vi.fn() }))
vi.mock('@official-bots/canonical-chat', () => ({
  CANONICAL_CHAT_TITLE: 'Bot Chat',
  prepareBotSource: vi.fn(),
  resolveExpectHistory: vi.fn()
}))
vi.mock('@official-bots/data', () => ({ newBotChat: vi.fn() }))
vi.mock('@official-bots/roster-actions', () => ({ openRosterBot: vi.fn() }))

import { BotSessions } from './bot-sessions'
import { holdBotSessionRefresh, SESSION_RENAMED } from './session-menu'

const routedBot = {
  name: '网页爬取',
  sourceScoped: true,
  route: {
    connectionId: 'mac',
    mode: 'remote',
    profile: '网页爬取',
    targetProfile: 'crawler'
  }
} as RosterRow

function renderList() {
  return renderToStaticMarkup(createElement(BotSessions, { bot: routedBot }))
}

beforeEach(() => {
  sessions.splice(0, sessions.length, { id: 'live-1', session_id: 'stored-1', title: '昨天的爬取' }, { id: 'only-id' })
  menus.splice(0, menus.length)
  deleteSession.mockReset()
  invalidateQueries.mockReset()
  notifyError.mockReset()
  delete (globalThis as Record<string, unknown>)[SESSION_RENAMED]
})

describe('bot session menu', () => {
  it('gives ordinary chats a rename/delete menu and leaves the pinned and new rows alone', () => {
    const html = renderList()

    expect(html).toContain('固定对话')
    expect(html).toContain('新对话')
    expect(html).toContain('昨天的爬取')
    expect(menus.map(menu => menu.title)).toEqual(['昨天的爬取', '未命名对话'])
    expect(menus.map(menu => menu.sessionId)).toEqual(['stored-1', 'only-id'])

    for (const menu of menus) {
      expect(menu.profile).toBe('网页爬取')
      expect(menu.surface).toBe('row')
      expect(menu.onPin).toBeUndefined()
      expect(menu.onBranch).toBeUndefined()
      expect(menu.onArchive).toBeUndefined()
      expect(menu.onToggleUnread).toBeUndefined()
    }
  })

  it('deletes on the bot route and session id, then refreshes that bot’s list', async () => {
    const order: string[] = []

    deleteSession.mockImplementation(async () => {
      order.push('delete')

      return { ok: true }
    })
    invalidateQueries.mockImplementation(async () => {
      order.push('refresh')
    })
    renderList()

    await menus[0].onDelete?.()

    expect(deleteSession).toHaveBeenCalledWith('stored-1', { connectionId: 'mac', profile: 'crawler' })
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ['hermes-bots-plus', 'sessions', '网页爬取'] })
    expect(order).toEqual(['delete', 'refresh'])
    expect(notifyError).not.toHaveBeenCalled()
  })

  it('does not refresh the list when delete fails', async () => {
    deleteSession.mockRejectedValue(new Error('gone'))
    renderList()

    await menus[0].onDelete?.()

    expect(deleteSession).toHaveBeenCalledWith('stored-1', { connectionId: 'mac', profile: 'crawler' })
    expect(invalidateQueries).not.toHaveBeenCalled()
    expect(notifyError).toHaveBeenCalledWith(expect.any(Error), '删除对话失败')
  })

  it('refreshes every bot session list after a successful rename', () => {
    renderList()
    const release = holdBotSessionRefresh()
    const renamed = (globalThis as unknown as Record<string, (() => void) | undefined>)[SESSION_RENAMED]

    renamed?.()

    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ['hermes-bots-plus', 'sessions'] })
    release()
    expect((globalThis as Record<string, unknown>)[SESSION_RENAMED]).toBeUndefined()
  })
})
