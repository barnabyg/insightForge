import type { KoboldPromptFormat, ProviderSettings } from '../providers/types'

const KOBOLD_FORMATS: KoboldPromptFormat[] = ['none', 'gemma4', 'chatml']

const KEY = 'insightforge:settings'

export const DEFAULT_SETTINGS: ProviderSettings = {
  provider: 'kobold',
  koboldFormat: 'none',
}

export function loadSettings(): ProviderSettings {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return { ...DEFAULT_SETTINGS }
    const parsed: unknown = JSON.parse(raw)
    if (!isProviderSettings(parsed)) return { ...DEFAULT_SETTINGS }
    return parsed
  } catch {
    return { ...DEFAULT_SETTINGS }
  }
}

export function saveSettings(settings: ProviderSettings): void {
  localStorage.setItem(KEY, JSON.stringify(settings))
}

function isProviderSettings(value: unknown): value is ProviderSettings {
  if (typeof value !== 'object' || value === null) return false
  const obj = value as Record<string, unknown>
  if (obj['provider'] !== 'openai' && obj['provider'] !== 'kobold') return false
  if (obj['koboldFormat'] !== undefined && !KOBOLD_FORMATS.includes(obj['koboldFormat'] as KoboldPromptFormat)) return false
  return true
}
