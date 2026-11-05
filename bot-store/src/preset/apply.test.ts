import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { StoreBot } from '../store/store-types'

const { hostMock } = vi.hoisted(() => ({
  hostMock: {
    request: vi.fn(),
    notify: vi.fn()
  }
}))

vi.mock('@hermes/plugin-sdk', () => ({
  host: hostMock
}))

import { applyPreset } from './apply'

type HostRequest = NonNullable<Parameters<typeof applyPreset>[2]>

function preset(overrides: Partial<StoreBot> = {}): StoreBot {
  return {
    id: 'bot-dev',
    name: '代码开发',
    category: 'general',
    summary: '',
    toolsets: ['terminal', 'file'],
    mcp: [{ name: 'github', config: { url: 'https://api.githubcopilot.com/mcp/' } }],
    skills: ['github-pr'],
    ...overrides
  }
}

beforeEach(() => {
  hostMock.request.mockReset()
  hostMock.notify.mockReset()
})

describe('applyPreset', () => {
  it('configures toolsets, adds mcp with config, then installs skills', async () => {
    const calls: { method: string; params?: Record<string, unknown> }[] = []
    const request: HostRequest = async <T,>(method: string, params?: Record<string, unknown>) => {
      calls.push({ method, params })

      return { ok: true } as T
    }

    await applyPreset(preset(), 'bot-dev', request)

    expect(calls.map(call => call.method)).toEqual(['profiles.configure', 'mcp.servers.add', 'skills.manage'])
    expect(calls[0].params).toEqual({ name: 'bot-dev', enabled_toolsets: ['terminal', 'file'] })
    expect(calls[1].params).toEqual({
      profile: 'bot-dev',
      name: 'github',
      config: { url: 'https://api.githubcopilot.com/mcp/' }
    })
    expect(calls[2].params).toEqual({ action: 'install', query: 'github-pr', profile: 'bot-dev' })
    expect(hostMock.notify).not.toHaveBeenCalled()
  })

  it('continues after a failed step and notifies the failures', async () => {
    const calls: string[] = []
    const request: HostRequest = async <T,>(method: string) => {
      calls.push(method)

      if (method === 'profiles.configure') {
        throw new Error('toolsets down')
      }

      if (method === 'mcp.servers.add') {
        return { ok: false, error: 'mcp down' } as T
      }

      return { ok: true } as T
    }

    await applyPreset(preset({ skills: ['review', 'debug'] }), 'bot-dev', request)

    expect(calls).toEqual(['profiles.configure', 'mcp.servers.add', 'skills.manage', 'skills.manage'])
    expect(hostMock.notify).toHaveBeenCalledWith({
      kind: 'warning',
      message: '代码开发：这些没装上——工具集、MCP github'
    })
  })
})
