// 与 G03 任务卡约定的类型一致，Gemini 的 StorePage 按这个写。
export type StoreCategory = 'general' | 'kit'
export interface StoreRequirement { kind: 'command' | 'env'; name: string; hint?: string; ok?: boolean }
export interface StoreBot {
  id: string
  name: string
  category: StoreCategory
  summary: string
  description?: string
  repo: string
  icon?: string
  tags?: string[]
  requires?: StoreRequirement[]
  /** 只有 kit 有：包含的 Bot id */
  bots?: string[]
}
export type InstallState =
  | { kind: 'idle' }
  | { kind: 'installed' }
  | { kind: 'installing' }
  | { kind: 'error'; message: string }
export interface StorePageProps {
  items: StoreBot[]
  loading: boolean
  loadError?: string
  installState: (id: string) => InstallState
  onInstall: (item: StoreBot) => void
  onOpenBot: (id: string) => void
  onRetryLoad: () => void
}
