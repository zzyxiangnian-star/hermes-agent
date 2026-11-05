import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

const here = dirname(fileURLToPath(import.meta.url))
const desktopSrc = resolve(here, '../apps/desktop/src')
const officialBots = resolve(desktopSrc, 'plugins/hermes-bots')

export default defineConfig({
  root: here,
  resolve: {
    alias: [
      { find: '@hermes/plugin-sdk', replacement: resolve(desktopSrc, 'sdk/index.ts') },
      {
        find: /^@official-bots\/(.*)$/,
        replacement: (_match, subpath: string) => resolve(officialBots, subpath)
      }
    ]
  },
  test: {
    name: 'bot-store',
    environment: 'node',
    include: ['src/**/*.test.ts', 'patches.test.ts', 'sdk-map.test.ts']
  }
})
