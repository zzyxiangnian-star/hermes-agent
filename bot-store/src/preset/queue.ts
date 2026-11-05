// 商店点“添加”后要打开的预设队列。套装会一次排进多个，新建窗口每关一次取下一个。
import { atom } from '@hermes/plugin-sdk'

import type { StoreBot } from '../store/store-types'

export const $presetQueue = atom<StoreBot[]>([])

export function queuePresets(items: StoreBot[]) {
  $presetQueue.set([...$presetQueue.get(), ...items])
}

export function shiftPreset() {
  $presetQueue.set($presetQueue.get().slice(1))
}
