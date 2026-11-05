import { type PluginContext, ROUTES_AREA, type RouteContribution } from '@hermes/plugin-sdk'

import { STORE_PATH } from './constants'
import { registerStoreSettings } from './settings'
import { StoreRoute } from './store-route'

export function registerStore(ctx: PluginContext) {
  registerStoreSettings(ctx)
  ctx.register({
    id: 'bot-store',
    area: ROUTES_AREA,
    data: { path: STORE_PATH } satisfies RouteContribution,
    render: () => <StoreRoute />
  })
}
