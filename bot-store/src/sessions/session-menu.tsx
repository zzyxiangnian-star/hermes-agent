import {
  Button,
  Codicon,
  ConfirmDialog,
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  host,
  Input,
  isSubmitEnter,
  queryClient,
  useI18n
} from '@hermes/plugin-sdk'
import { deleteSession, renameSession } from '@/hermes'
import { backendTargetProfile, botConnectionRoute } from '@official-bots/routing'
import type { RosterRow } from '@official-bots/types'
import { type ReactNode, useEffect, useRef, useState } from 'react'

export function botSessionsQueryKey(bot: RosterRow) {
  return ['hermes-bots-plus', 'sessions', bot.name, botConnectionRoute(bot)?.connectionId || ''] as const
}

/** 和 session.list 同一条路由。重命名的 REST 只收 profile 字符串。 */
export function botSessionProfile(bot: RosterRow): string {
  return backendTargetProfile(botConnectionRoute(bot), bot.name)
}

/** 删除要落到这条 Bot 自己的连接上。没有路由时只带 profile，走当前窗口。 */
export function botSessionDeleteScope(bot: RosterRow): string | { connectionId: string; profile: string } {
  const route = botConnectionRoute(bot)
  const profile = botSessionProfile(bot)

  if (!route) {
    return profile
  }

  return { connectionId: route.connectionId, profile }
}

export async function deleteBotSession(bot: RosterRow, sessionId: string): Promise<void> {
  await deleteSession(sessionId, botSessionDeleteScope(bot))
  await queryClient.invalidateQueries({ queryKey: ['hermes-bots-plus', 'sessions', bot.name] })
}

export async function renameBotSession(bot: RosterRow, sessionId: string, title: string, message: string): Promise<void> {
  await renameSession(sessionId, title, botSessionProfile(bot))
  host.notify?.({ durationMs: 2_000, kind: 'success', message })
  await queryClient.invalidateQueries({ queryKey: ['hermes-bots-plus', 'sessions', bot.name] })
}

/** 普通对话行的右键菜单：只用 SDK 组件，不把主程序的会话菜单打进来。 */
export function BotSessionMenu({
  bot,
  children,
  sessionId,
  title
}: {
  bot: RosterRow
  children: ReactNode
  sessionId: string
  title: string
}) {
  const { t } = useI18n()
  const r = t.sidebar.row
  const [renameOpen, setRenameOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const suppressCloseFocusRef = useRef(false)

  const onCloseAutoFocus = (event: Event) => {
    if (suppressCloseFocusRef.current) {
      suppressCloseFocusRef.current = false
      event.preventDefault()
    }
  }

  return (
    <>
      <ContextMenu>
        <ContextMenuTrigger asChild>{children}</ContextMenuTrigger>
        <ContextMenuContent className="w-40" onCloseAutoFocus={onCloseAutoFocus}>
          <ContextMenuItem
            disabled={!sessionId}
            onSelect={() => {
              suppressCloseFocusRef.current = true
              setRenameOpen(true)
            }}
          >
            <Codicon name="edit" size="0.875rem" />
            {r.rename}
          </ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem
            className="text-destructive focus:text-destructive"
            disabled={!sessionId}
            onSelect={() => setDeleteOpen(true)}
          >
            <Codicon name="trash" size="0.875rem" />
            {t.common.delete}
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>
      <RenameBotSessionDialog
        bot={bot}
        currentTitle={title}
        onOpenChange={setRenameOpen}
        open={renameOpen}
        sessionId={sessionId}
      />
      <ConfirmDialog
        busyLabel={r.deleting}
        confirmLabel={t.common.delete}
        description={r.deleteDesc(title)}
        destructive
        doneLabel={r.deleted}
        onClose={() => setDeleteOpen(false)}
        onConfirm={() => deleteBotSession(bot, sessionId)}
        open={deleteOpen}
        title={r.deleteTitle}
      />
    </>
  )
}

function RenameBotSessionDialog({
  bot,
  currentTitle,
  onOpenChange,
  open,
  sessionId
}: {
  bot: RosterRow
  currentTitle: string
  onOpenChange: (open: boolean) => void
  open: boolean
  sessionId: string
}) {
  const { t } = useI18n()
  const r = t.sidebar.row
  const [value, setValue] = useState(currentTitle)
  const [submitting, setSubmitting] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open) {
      setValue(currentTitle)
      window.setTimeout(() => inputRef.current?.select(), 0)
    }
  }, [currentTitle, open])

  const submit = async () => {
    const next = value.trim()

    if (!sessionId || submitting) {
      return
    }

    if (next === currentTitle.trim()) {
      onOpenChange(false)

      return
    }

    setSubmitting(true)

    try {
      await renameBotSession(bot, sessionId, next, r.renamed)
      onOpenChange(false)
    } catch (error) {
      host.notifyError?.(error, r.renameFailed)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{r.renameTitle}</DialogTitle>
        </DialogHeader>
        <Input
          autoFocus
          disabled={submitting}
          onChange={event => setValue(event.target.value)}
          onKeyDown={event => {
            if (isSubmitEnter(event)) {
              event.preventDefault()
              void submit()
            } else if (event.key === 'Escape') {
              onOpenChange(false)
            }
          }}
          placeholder={r.untitledPlaceholder}
          ref={inputRef}
          value={value}
        />
        <DialogFooter>
          <Button disabled={submitting} onClick={() => onOpenChange(false)} type="button" variant="ghost">
            {t.common.cancel}
          </Button>
          <Button disabled={submitting} onClick={() => void submit()} type="button">
            {t.common.save}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
