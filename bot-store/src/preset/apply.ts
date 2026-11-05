// 新建窗口创建出 profile 之后，把预设里的工具集、技能、MCP 套上去。
// 全部走官方接口：profiles.configure / skills.manage / mcp.servers.add。
import { host } from '@hermes/plugin-sdk'

import type { StoreBot } from '../store/store-types'

type Request = <T>(method: string, params?: Record<string, unknown>) => Promise<T>

export async function applyPreset(preset: StoreBot, profile: string, request: Request = (m, p) => host.request(m, p)) {
  const problems: string[] = []

  if (preset.toolsets?.length) {
    await request('profiles.configure', { name: profile, enabled_toolsets: preset.toolsets }).catch(() =>
      problems.push('工具集')
    )
  }

  for (const server of preset.mcp || []) {
    const res = await request<{ ok?: boolean; error?: string }>('mcp.servers.add', {
      profile,
      name: server.name,
      ...(server.preset ? { preset: server.preset } : {}),
      ...(server.config ? { config: server.config } : {})
    }).catch((err: unknown) => ({ ok: false, error: String(err) }))

    if (res && res.ok === false) {
      problems.push(`MCP ${server.name}`)
    }
  }

  for (const skill of preset.skills || []) {
    await request('skills.manage', { action: 'install', query: skill, profile }).catch(() =>
      problems.push(`技能 ${skill}`)
    )
  }

  const needKeys = (preset.requires || []).filter(r => r.kind === 'env')

  if (problems.length) {
    host.notify({ kind: 'warning', message: `${preset.name}：这些没装上——${problems.join('、')}` })
  }

  if (needKeys.length) {
    host.notify({
      kind: 'info',
      message: `${preset.name} 还需要 ${needKeys.map(k => k.name).join('、')}：右键 Bot → 编辑 → 高级 → 能力 → MCP 里填写`
    })
  }
}
