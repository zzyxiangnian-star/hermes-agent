export const STORE_PATH = '/bot-store'
/** 默认商品目录：hermes-bot-store 仓库 main 分支的 catalog.yaml。可在 设置 → 插件 → Bot 商店 里改。 */
export const DEFAULT_CATALOG_URL =
  'https://raw.githubusercontent.com/zzyxiangnian-star/hermes-bot-store/main/catalog.yaml'

/** 调试用：localStorage 里设置这个键可临时覆盖目录地址（也支持 data: 地址），优先级最高。 */
export const CATALOG_URL_OVERRIDE_KEY = 'hermes-bots-plus.catalogUrl'

let configured = ''

/** 设置页保存的地址（插件启动时从 ctx.storage 读入）。 */
export function setCatalogUrl(url: string) {
  configured = url
}

export function storedCatalogUrl(): string {
  return configured
}

export function catalogUrl(): string {
  try {
    const override = window.localStorage.getItem(CATALOG_URL_OVERRIDE_KEY)

    if (override) {
      return override
    }
  } catch {
    // 拿不到 localStorage 就跳过调试覆盖
  }

  return configured || DEFAULT_CATALOG_URL
}
