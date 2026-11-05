import { cn, Codicon, host } from '@hermes/plugin-sdk'

import { STORE_PATH } from './constants'

export function StoreEntryButton() {
  return (
    <div className="px-2 pt-2">
      <button
        className={cn(
          'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[0.8125rem]',
          'text-(--ui-text-secondary) hover:bg-(--ui-bg-tertiary) hover:text-foreground transition-colors'
        )}
        onClick={() => host.navigate(STORE_PATH)}
        type="button"
      >
        <Codicon name="extensions" />
        <span className="flex-1">Bot 商店</span>
        <Codicon className="text-(--ui-text-quaternary)" name="chevron-right" />
      </button>
    </div>
  )
}
