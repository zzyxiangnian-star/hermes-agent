export const STORE_PATH = '/bot-store'
/** 默认商品目录：hermes-bot-store 仓库 main 分支的 catalog.yaml。可在设置里改。 */
export const DEFAULT_CATALOG_URL =
  'https://raw.githubusercontent.com/zzyxiangnian-star/hermes-bot-store/main/catalog.yaml'

/** 调试用：localStorage 里设置这个键可改用别的目录地址（也支持 data: 地址）。 */
export const CATALOG_URL_OVERRIDE_KEY = 'hermes-bots-plus.catalogUrl'

export function catalogUrl(): string {
  try {
    return window.localStorage.getItem(CATALOG_URL_OVERRIDE_KEY) || DEFAULT_CATALOG_URL
  } catch {
    return DEFAULT_CATALOG_URL
  }
}
