import { createElement, type ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { RosterRow } from '@official-bots/types'

type ConfirmProps = { onConfirm?: () => Promise<unknown> | void }

type SessionFixture = { id: string; preview?: string; session_id?: string; title?: string }

const { confirms, deleteSession, el, invalidateQueries, notify, notifyError, renameSession, sessions } = vi.hoisted(() => {
  const react = require('react') as typeof import('react')

  return {
    confirms: [] as ConfirmProps[],
    deleteSession: vi.fn(),
    el: react.createElement,
    invalidateQueries: vi.fn(),
    notify: vi.fn(),
    notifyError: vi.fn(),
    renameSession: vi.fn(),
    sessions: [] as SessionFixture[]
  }
})

vi.mock('@hermes/plugin-sdk', () => ({
  Button: ({ children }: { children?: unknown }) => children,
  Codicon: () => null,
  ConfirmDialog: (props: ConfirmProps) => {
    confirms.push(props)

    return null
  },
  ContextMenu: ({ children }: { children?: ReactNode }) => el('div', { 'data-session-menu': '1' }, children),
  ContextMenuContent: ({ children }: { children?: ReactNode }) => children,
  ContextMenuItem: ({ children }: { children?: ReactNode }) => el('span', null, children),
  ContextMenuSeparator: () => null,
  ContextMenuTrigger: ({ children }: { children?: unknown }) => children,
  Dialog: ({ children }: { children?: unknown }) => children,
  DialogContent: ({ children }: { children?: unknown }) => children,
  DialogFooter: ({ children }: { children?: unknown }) => children,
  DialogHeader: ({ children }: { children?: unknown }) => children,
  DialogTitle: ({ children }: { children?: unknown }) => children,
  Input: () => null,
  cn: (...parts: Array<false | null | string | undefined>) => parts.filter(Boolean).join(' '),
  haptic: vi.fn(),
  host: { notify, notifyError },
  isSubmitEnter: () => false,
  queryClient: { invalidateQueries },
  Tip: ({ children }: { children?: unknown }) => children,
  useI18n: () => ({
    t: {
      common: { cancel: '取消', delete: '删除', save: '保存' },
      sidebar: {
        row: {
          deleteDesc: (title: string) => `删除 ${title}`,
          deleteTitle: '删除对话',
          deleted: '已删除',
          deleting: '正在删除',
          rename: '重命名',
          renameFailed: '重命名失败',
          renameTitle: '重命名对话',
          renamed: '已重命名',
          untitledPlaceholder: '未命名'
        }
      }
    }
  }),
  useQuery: () => ({ data: sessions, error: null, isLoading: false })
}))

vi.mock('@/hermes', () => ({
  deleteSession: (...args: unknown[]) => deleteSession(...args),
  renameSession: (...args: unknown[]) => renameSession(...args)
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
import { renameBotSession } from './session-menu'

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
  confirms.splice(0, confirms.length)
  deleteSession.mockReset()
  invalidateQueries.mockReset()
  notify.mockReset()
  notifyError.mockReset()
  renameSession.mockReset()
})

describe('bot session menu', () => {
  it('gives ordinary chats a rename/delete menu and leaves the pinned and new rows alone', () => {
    const html = renderList()
    const menus = html.split('data-session-menu="1"').slice(1)

    expect(html).toContain('固定对话')
    expect(html).toContain('新对话')
    expect(html.indexOf('固定对话')).toBeLessThan(html.indexOf('data-session-menu'))
    expect(html.lastIndexOf('新对话')).toBeGreaterThan(html.lastIndexOf('data-session-menu'))
    expect(menus).toHaveLength(2)
    expect(menus[0]).toContain('昨天的爬取')
    expect(menus[0]).toContain('重命名')
    expect(menus[0]).toContain('删除')
    expect(menus[1]).toContain('未命名对话')
    expect(menus[0]).not.toContain('固定对话')
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

    await confirms[0].onConfirm?.()

    expect(deleteSession).toHaveBeenCalledWith('stored-1', { connectionId: 'mac', profile: 'crawler' })
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ['hermes-bots-plus', 'sessions', '网页爬取'] })
    expect(order).toEqual(['delete', 'refresh'])
  })

  it('does not refresh the list when delete fails', async () => {
    deleteSession.mockRejectedValue(new Error('gone'))
    renderList()

    await expect(confirms[0].onConfirm?.()).rejects.toThrow('gone')

    expect(deleteSession).toHaveBeenCalledWith('stored-1', { connectionId: 'mac', profile: 'crawler' })
    expect(invalidateQueries).not.toHaveBeenCalled()
  })

  it('refreshes that bot’s list after a successful rename', async () => {
    renameSession.mockResolvedValue({ ok: true, title: '新标题' })

    await renameBotSession(routedBot, 'stored-1', '新标题', '已重命名')

    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ['hermes-bots-plus', 'sessions', '网页爬取'] })
    expect(notify).toHaveBeenCalledWith({ durationMs: 2_000, kind: 'success', message: '已重命名' })
  })

  it('renames with the bot’s backend profile', async () => {
    renameSession.mockResolvedValue({ ok: true, title: '新标题' })

    await renameBotSession(routedBot, 'stored-1', '新标题', '已重命名')

    expect(renameSession).toHaveBeenCalledWith('stored-1', '新标题', 'crawler')
  })
})
