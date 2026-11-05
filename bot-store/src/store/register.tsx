import { type PluginContext, ROUTES_AREA, type RouteContribution } from '@hermes/plugin-sdk'

import { STORE_PATH } from './constants'
import { StoreRoute } from './store-route'

export function registerStore(ctx: PluginContext) {
  ctx.register({
    id: 'bot-store',
    area: ROUTES_AREA,
    data: { path: STORE_PATH } satisfies RouteContribution,
    render: () => <StoreRoute />
  })
}
