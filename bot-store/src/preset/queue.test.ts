import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { StoreBot } from '../store/store-types'

const { queueAtom } = vi.hoisted(() => {
  let value: StoreBot[] = []

  return {
    queueAtom: {
      get: () => value,
      set: (next: StoreBot[]) => {
        value = next
      }
    }
  }
})

vi.mock('@hermes/plugin-sdk', () => ({
  atom: () => queueAtom
}))

import { $presetQueue, queuePresets, shiftPreset } from './queue'

function bot(id: string, category: StoreBot['category'] = 'general'): StoreBot {
  return { id, name: id, category, summary: '' }
}

beforeEach(() => {
  queueAtom.set([])
})

describe('preset queue', () => {
  it('appends presets as they are queued', () => {
    queuePresets([bot('bot-dev')])
    queuePresets([bot('bot-video')])

    expect($presetQueue.get().map(item => item.id)).toEqual(['bot-dev', 'bot-video'])
  })

  it('shifts the first preset off the queue', () => {
    queuePresets([bot('bot-dev'), bot('bot-video')])
    shiftPreset()

    expect($presetQueue.get().map(item => item.id)).toEqual(['bot-video'])
  })

  it('dequeues a kit one bot at a time', () => {
    queuePresets([bot('bot-crawler'), bot('bot-video')])

    shiftPreset()
    expect($presetQueue.get().map(item => item.id)).toEqual(['bot-video'])

    shiftPreset()
    expect($presetQueue.get()).toEqual([])
  })
})
