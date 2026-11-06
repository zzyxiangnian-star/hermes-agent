import { queryClient } from '@hermes/plugin-sdk'
import { deleteSession } from '@/hermes'
import { backendTargetProfile, botConnectionRoute } from '@official-bots/routing'
import type { RosterRow } from '@official-bots/types'

/** 重命名成功后，打包补丁会调用这个函数。官方菜单本身没有成功回调。 */
export const SESSION_RENAMED = '__hermesBotsPlusOnSessionRenamed'

export function botSessionsQueryKey(bot: RosterRow) {
  return ['hermes-bots-plus', 'sessions', bot.name, botConnectionRoute(bot)?.connectionId || ''] as const
}

/** 删除要落到这条 Bot 自己的连接和后端 profile 上，和 session.list 用的是同一条路由。 */
export function botSessionDeleteScope(bot: RosterRow): string | { connectionId: string; profile: string } {
  const route = botConnectionRoute(bot)
  const profile = backendTargetProfile(route, bot.name)

  if (!route) {
    return profile
  }

  return { connectionId: route.connectionId, profile }
}

export async function deleteBotSession(bot: RosterRow, sessionId: string): Promise<void> {
  await deleteSession(sessionId, botSessionDeleteScope(bot))
  await queryClient.invalidateQueries({ queryKey: ['hermes-bots-plus', 'sessions', bot.name] })
}

let refreshHolders = 0

export function holdBotSessionRefresh(): () => void {
  refreshHolders += 1
  ;(globalThis as Record<string, unknown>)[SESSION_RENAMED] = () => {
    void queryClient.invalidateQueries({ queryKey: ['hermes-bots-plus', 'sessions'] })
  }

  return () => {
    refreshHolders -= 1

    if (refreshHolders <= 0) {
      refreshHolders = 0
      delete (globalThis as Record<string, unknown>)[SESSION_RENAMED]
    }
  }
}
