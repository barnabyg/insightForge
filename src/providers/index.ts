import type { LLMProvider, ProviderSettings } from './types'
import { OpenAIProvider } from './openai.provider'
import { KoboldProvider } from './kobold.provider'

export function getProvider(settings: ProviderSettings): LLMProvider {
  switch (settings.provider) {
    case 'openai': {
      const p = new OpenAIProvider()
      p.configure(settings)
      return p
    }
    case 'kobold': {
      const p = new KoboldProvider()
      p.configure(settings)
      return p
    }
    default: {
      const _exhaustive: never = settings.provider
      throw new Error(`Unknown provider: ${String(_exhaustive)}`)
    }
  }
}

export type { LLMProvider, ProviderSettings }
export { OpenAIProvider } from './openai.provider'
export { KoboldProvider } from './kobold.provider'
