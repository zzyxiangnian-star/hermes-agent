// 记住哪些 Bot 是展开的（只存在本机浏览器存储里，丢了也无妨）。
const KEY = 'hermes-bots-plus.expanded'

function read(): Set<string> {
  try {
    return new Set(JSON.parse(window.localStorage.getItem(KEY) || '[]'))
  } catch {
    return new Set()
  }
}

export function isExpanded(name: string): boolean {
  return read().has(name)
}

export function setExpanded(name: string, open: boolean) {
  const set = read()

  if (open) {
    set.add(name)
  } else {
    set.delete(name)
  }

  try {
    window.localStorage.setItem(KEY, JSON.stringify([...set]))
  } catch {
    // 存不了就只在本次生效
  }
}
