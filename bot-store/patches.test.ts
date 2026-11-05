import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import { applyTextPatch, CREATE_DIALOG_ANCHORS, patchCreateDialog, TEXT_PATCHES } from './patches.mjs'

const official = resolve(dirname(fileURLToPath(import.meta.url)), '../apps/desktop/src/plugins/hermes-bots')

function count(src: string, needle: string) {
  let found = 0
  let from = 0

  while (from <= src.length) {
    const at = src.indexOf(needle, from)

    if (at < 0) {
      return found
    }

    found += 1
    from = at + needle.length
  }

  return found
}

describe('official source patches', () => {
  it('create-dialog anchors each appear once and the patch inserts the preset hooks', () => {
    const src = readFileSync(resolve(official, 'create-dialog.tsx'), 'utf8')

    for (const anchor of CREATE_DIALOG_ANCHORS) {
      expect(count(src, anchor), JSON.stringify(anchor.trim().slice(0, 48))).toBe(1)
    }

    const patched = patchCreateDialog(src)

    expect(patched).toContain('$presetQueue as __bsQueue')
    expect(patched).toContain('shiftPreset as __bsShift')
    expect(patched).toContain('applyPreset as __bsApply')
    expect(patched).toContain('商店预设：打开时预填，关闭时出队')
    expect(patched).toContain('setName(__bsPreset.id)')
    expect(patched).toContain('__bsShift()')
    expect(patched).toContain('套用商店预设里的工具集、技能、MCP')
    expect(patched).toContain('await __bsApply(__bsPreset, slugCreated, requestForTarget)')
  })

  it('replaces each text-patch anchor and keeps the inserted text', () => {
    // i18n 的锚点只有一处。profile-ops 的花名册 queryKey 在头像两处各写了一次，
    // 文本补丁用 split/join，两处都会换。次数变成 0 说明锚点丢了。
    const expected = new Map<string, number>([
      ['i18n.ts', 1],
      ['profile-ops.ts', 2]
    ])

    for (const [file, from, to] of TEXT_PATCHES) {
      const src = readFileSync(resolve(official, file), 'utf8')
      const times = expected.get(file) ?? 1

      expect(count(src, from), file).toBe(times)

      const patched = applyTextPatch(src, from, to, file)

      expect(patched).toContain(to)
      expect(count(patched, to), file).toBe(times)
      expect(patched).not.toContain(from)
    }
  })
})
