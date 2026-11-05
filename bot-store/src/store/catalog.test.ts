import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import { parseCatalog } from './catalog'

const fixturePath = resolve(dirname(fileURLToPath(import.meta.url)), 'fixtures/catalog.yaml')

describe('parseCatalog', () => {
  it('reads the store catalog as 3 bots and 1 kit', () => {
    const items = parseCatalog(readFileSync(fixturePath, 'utf8'))
    const bots = items.filter(item => item.category === 'general')
    const kits = items.filter(item => item.category === 'kit')

    expect(bots.map(item => item.id)).toEqual(['bot-crawler', 'bot-video', 'bot-dev'])
    expect(kits.map(item => item.id)).toEqual(['kit-short-video'])

    const dev = bots.find(item => item.id === 'bot-dev')

    expect(dev?.toolsets).toContain('terminal')
    expect(dev?.mcp?.map(server => server.name)).toContain('github')
  })

  it('skips invalid entries instead of failing the whole catalog', () => {
    const items = parseCatalog(`
version: 1
bots:
  - id: keep-me
    name: Keep
    summary: ok
    repo: https://github.com/zzyxiangnian-star/hermes-bot-store
    toolsets: [terminal]
    requires:
      - kind: command
        name: git
      - kind: env
        name: BAD NAME
    mcp:
      - name: github
        config:
          url: https://example.test/mcp
      - name: broken
    color: '#112233'
  - id: BadId
    name: Upper
  - id: bad id
    name: Space
  - id: bad-repo
    name: Repo
    repo: not-a-repo
  - id: bad-color
    name: Color
    color: blue
kits:
  - id: BadKit
    name: Nope
`)

    expect(items.map(item => item.id)).toEqual(['keep-me', 'bad-color'])

    const kept = items[0]

    expect(kept.toolsets).toEqual(['terminal'])
    expect(kept.requires).toEqual([{ kind: 'command', name: 'git', hint: undefined }])
    expect(kept.mcp).toEqual([{ name: 'github', preset: undefined, config: { url: 'https://example.test/mcp' } }])
    expect(kept.color).toBe('#112233')
    expect(items[1].color).toBeUndefined()
  })
})
