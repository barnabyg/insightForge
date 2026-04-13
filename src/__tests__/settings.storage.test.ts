import { describe, it, expect, beforeEach } from 'vitest'
import { MockLocalStorage } from './helpers/mockLocalStorage'
import { loadSettings, saveSettings, DEFAULT_SETTINGS } from '../storage/settings'

let mockStorage: MockLocalStorage

beforeEach(() => {
  mockStorage = new MockLocalStorage()
  Object.defineProperty(globalThis, 'localStorage', {
    value: mockStorage,
    writable: true,
    configurable: true,
  })
})

describe('loadSettings', () => {
  it('returns default settings when localStorage is empty', () => {
    expect(loadSettings()).toEqual(DEFAULT_SETTINGS)
  })

  it('returns kobold as default provider', () => {
    expect(loadSettings().provider).toBe('kobold')
  })

  it('returns stored settings after a save', () => {
    saveSettings({ provider: 'openai', apiKey: 'sk-test' })
    const loaded = loadSettings()
    expect(loaded.provider).toBe('openai')
    expect(loaded.apiKey).toBe('sk-test')
  })

  it('falls back to defaults when stored JSON is malformed', () => {
    mockStorage.setItem('insightforge:settings', 'not-json{{{')
    expect(loadSettings()).toEqual(DEFAULT_SETTINGS)
  })

  it('falls back to defaults when stored value has unknown provider', () => {
    mockStorage.setItem('insightforge:settings', JSON.stringify({ provider: 'unknown' }))
    expect(loadSettings()).toEqual(DEFAULT_SETTINGS)
  })

  it('falls back to defaults when stored value is not an object', () => {
    mockStorage.setItem('insightforge:settings', JSON.stringify(42))
    expect(loadSettings()).toEqual(DEFAULT_SETTINGS)
  })
})

describe('saveSettings', () => {
  it('persists settings that can be reloaded', () => {
    saveSettings({ provider: 'kobold' })
    expect(loadSettings().provider).toBe('kobold')
  })

  it('overwrites previously saved settings', () => {
    saveSettings({ provider: 'kobold' })
    saveSettings({ provider: 'openai', apiKey: 'key2' })
    expect(loadSettings().provider).toBe('openai')
  })
})
