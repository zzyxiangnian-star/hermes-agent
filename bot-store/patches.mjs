// 打包时打到官方 hermes-bots 源码上的文本补丁。官方文件本身不改，锚点对不上就报错。
// build-bots-plus.mjs 和测试都从这里拿，避免两处各写一份锚点。
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ours = resolve(dirname(fileURLToPath(import.meta.url)), 'src')

// [文件, 锚点, 替换后的文本]。出现几次就换几次。
export const TEXT_PATCHES = [
  ['i18n.ts', "usePluginI18n('hermes-bots')", "usePluginI18n('hermes-bots-plus')"],
  ['profile-ops.ts', "queryKey: ['hermes-bots', 'roster']", "queryKey: ['hermes-bots-plus', 'roster']"]
]

export function applyTextPatch(src, from, to, file) {
  if (!src.includes(from)) {
    throw new Error(`${file} 里找不到：${from}（官方代码变了，检查补丁）`)
  }

  return src.split(from).join(to)
}

// create-dialog.tsx 的插入点。不唯一就抛错（插错位置比漏打更难发现）。
export const CREATE_DIALOG_ANCHORS = [
  "import { useEffect, useRef, useState } from 'react'\n",
  "  const [advTab, setAdvTab] = useState('general')\n",
  '      // The intro turn is a real model call.'
]

function insertAt(src, anchor, text, where = 'after') {
  const i = src.indexOf(anchor)

  if (i < 0 || src.indexOf(anchor, i + 1) >= 0) {
    throw new Error(`create-dialog.tsx 补丁锚点没找到或不唯一：${anchor.trim().slice(0, 60)}`)
  }

  const at = where === 'after' ? i + anchor.length : i

  return src.slice(0, at) + text + src.slice(at)
}

export function patchCreateDialog(src) {
  let out = insertAt(
    src,
    CREATE_DIALOG_ANCHORS[0],
    `import { $presetQueue as __bsQueue, shiftPreset as __bsShift } from ${JSON.stringify(resolve(ours, 'preset/queue'))}\n` +
      `import { applyPreset as __bsApply } from ${JSON.stringify(resolve(ours, 'preset/apply'))}\n`
  )
  out = insertAt(
    out,
    CREATE_DIALOG_ANCHORS[1],
    `  // [bots-plus] 商店预设：打开时预填，关闭时出队
  const __bsPreset = useValue(__bsQueue)[0] || null
  const __bsSeeded = useRef<null | string>(null)
  useEffect(() => {
    if (open && __bsPreset && __bsSeeded.current !== __bsPreset.id) {
      __bsSeeded.current = __bsPreset.id
      setName(__bsPreset.id)
      setTitle(__bsPreset.name)
      setDescription(__bsPreset.summary || '')
      setSoul(__bsPreset.soul || '')
      if (__bsPreset.color) setColor(__bsPreset.color)
      setCloneFrom('default')
      setAdvanced(true)
    }
    if (!open && __bsSeeded.current) {
      __bsSeeded.current = null
      __bsShift()
    }
  }, [open, __bsPreset])
`
  )
  out = insertAt(
    out,
    CREATE_DIALOG_ANCHORS[2],
    `      // [bots-plus] 套用商店预设里的工具集、技能、MCP
      if (__bsPreset && __bsSeeded.current === __bsPreset.id) {
        await __bsApply(__bsPreset, slugCreated, requestForTarget)
      }

`,
    'before'
  )

  return out
}
