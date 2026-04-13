export type ProviderName = 'openai' | 'kobold'

export type KoboldPromptFormat = 'none' | 'gemma4' | 'chatml'

export interface ProviderSettings {
  provider: ProviderName
  apiKey?: string
  koboldFormat?: KoboldPromptFormat
}

export interface LLMProvider {
  readonly name: ProviderName
  configure(settings: ProviderSettings): void
  execute(prompt: string, signal?: AbortSignal): AsyncIterable<string>
}
