import type { LLMProvider, ProviderSettings } from '../../providers/types'

export class MockLLMProvider implements LLMProvider {
  readonly name = 'kobold' as const

  private chunks: string[] = []
  private shouldThrow: Error | null = null
  lastPrompt: string | null = null
  lastSignal: AbortSignal | undefined = undefined

  setChunks(chunks: string[]): void {
    this.chunks = chunks
    this.shouldThrow = null
  }

  setError(error: Error): void {
    this.shouldThrow = error
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  configure(_: ProviderSettings): void {
    // no-op in mock
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  async *execute(prompt: string, signal?: AbortSignal): AsyncIterable<string> {
    this.lastPrompt = prompt
    this.lastSignal = signal

    if (this.shouldThrow) {
      throw this.shouldThrow
    }

    for (const chunk of this.chunks) {
      if (signal?.aborted) return
      yield chunk
    }
  }
}
