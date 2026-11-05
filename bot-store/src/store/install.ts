import { host } from '@hermes/plugin-sdk'

import type { StoreBot, StoreRequirement } from './store-types'

interface CliExecResult {
  blocked?: boolean
  code?: number
  hint?: string
  output?: string
}

async function hermesCli(argv: string[]): Promise<CliExecResult> {
  const result = await host.request<CliExecResult>('cli.exec', { argv, timeout: 600 }, 610_000)

  if (result?.blocked) {
    throw new Error(result.hint || `命令被拒绝：hermes ${argv.join(' ')}`)
  }

  return result || {}
}

// 官方问题：删掉的 Bot 会留下“已删除”标记，之后同名 install 会半途失败。
// 这时按 删除残留 → create（清掉标记）→ install --force 补救一次。
const TOMBSTONE_ERROR = 'Named profile home does not exist'

/** 用官方命令安装：hermes profile install <仓库> --name <id> --yes。不需要额外的后端插件。 */
export async function installBot(item: StoreBot): Promise<void> {
  const base = ['profile', 'install', item.repo, '--name', item.id, '--yes']
  let result = await hermesCli(base)

  if (result.code !== 0 && (result.output || '').includes(TOMBSTONE_ERROR)) {
    await hermesCli(['profile', 'delete', item.id, '--yes'])
    await hermesCli(['profile', 'create', item.id])
    result = await hermesCli([...base, '--force'])
  }

  if (result.code !== 0) {
    throw new Error(lastLines(result.output || '安装失败（无输出）'))
  }
}

/** 依赖检查：桌面端没有可在会话之外执行任意命令的接口（shell.exec 需要会话 id），
 *  第一版只把依赖作为提示显示（ok 留空），不自动检测。 */
export async function checkRequirements(reqs: StoreRequirement[] = []): Promise<StoreRequirement[]> {
  return reqs
}

function lastLines(text: string, n = 6) {
  return text.trim().split(/\r?\n/).slice(-n).join('\n')
}
