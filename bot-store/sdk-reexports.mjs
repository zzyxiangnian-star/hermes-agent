// 这些主程序模块由 @hermes/plugin-sdk 原样导出。打包时整模块改指向 SDK，
// 避免把 i18n、QueryClient、Dialog 等带全局状态的副本打进插件。
// 新增一条之前，先确认原生组件从这里导入的每个名字，SDK 的 index.ts 都有导出。
export const SDK_REEXPORTS = [
  '@/app/overlays/panel',
  '@/app/settings/primitives',
  '@/app/settings/toolset-config-panel',
  '@/components/status-dot',
  '@/components/ui/badge',
  '@/components/ui/button',
  '@/components/ui/checkbox',
  '@/components/ui/codicon',
  '@/components/ui/color-swatches',
  '@/components/ui/confirm-dialog',
  // context-menu / dropdown-menu / copy-button 不在这张表里。会话右键菜单要
  // ContextMenuLabel、DropdownMenuSub 这些 SDK 没有导出的名字，整模块改指向
  // SDK 会在加载时直接报错。这三个文件打进插件，子菜单和「复制 ID」才是同一份实现。
  '@/components/ui/decode-text',
  '@/components/ui/dialog',
  '@/components/ui/disclosure-caret',
  '@/components/ui/empty-state',
  '@/components/ui/error-state',
  '@/components/ui/fade-scroll',
  '@/components/ui/glyph-spinner',
  '@/components/ui/input',
  '@/components/ui/kbd',
  '@/components/ui/loader',
  '@/components/ui/log-view',
  '@/components/ui/popover',
  '@/components/ui/row-button',
  '@/components/ui/sandboxed-frame',
  '@/components/ui/scroll-area',
  '@/components/ui/search-field',
  '@/components/ui/segmented-control',
  '@/components/ui/select',
  '@/components/ui/separator',
  '@/components/ui/skeleton',
  '@/components/ui/switch',
  '@/components/ui/tabs',
  '@/components/ui/textarea',
  '@/components/ui/tooltip',
  '@/i18n',
  '@/lib/clipboard',
  '@/lib/time',
  '@/lib/utils',
  '@/themes/color',
  '@/themes/context',
  '@/themes/request',
  '@/themes/retint'
]

// 这些模块不能整份改指向 SDK：插件会用到 SDK 没导出的名字。
// 垫片只补那些名字，queryClient 仍从 SDK 拿，避免再做一个 QueryClient。
export const SDK_SHIMS = {
  '@/lib/query-client': ['invalidateProfileScopedQueries']
}
