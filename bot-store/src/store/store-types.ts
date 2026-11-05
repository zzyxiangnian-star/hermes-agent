// 与 G03 任务卡约定的类型一致，Gemini 的 StorePage 按这个写；预设字段是改成“预填新建窗口”后加的。
export type StoreCategory = 'general' | 'kit'
export interface StoreRequirement { kind: 'command' | 'env'; name: string; hint?: string; ok?: boolean }
export interface StoreMcpServer {
  name: string
  /** Hermes 自带 MCP 目录里的 id（optional-mcps/<id>） */
  preset?: string
  /** 或者直接写配置：url / headers 或 command / args / env */
  config?: Record<string, unknown>
}
export interface StoreBot {
  id: string
  name: string
  category: StoreCategory
  summary: string
  description?: string
  repo?: string
  icon?: string
  tags?: string[]
  requires?: StoreRequirement[]
  /** 只有 kit 有：包含的 Bot id */
  bots?: string[]
  /** 预设：新建窗口里预填的人格 */
  soul?: string
  /** 预设：命令行/桌面端启用的工具集 */
  toolsets?: string[]
  /** 预设：从技能市场安装的技能（skills.manage install 的名字） */
  skills?: string[]
  /** 预设：要加的 MCP 服务 */
  mcp?: StoreMcpServer[]
  /** 预设：头像颜色（#rrggbb） */
  color?: string
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
  /** 更新已安装的 Bot。 */
  onUpdate?: (item: StoreBot, forceConfig: boolean) => Promise<string>
}
