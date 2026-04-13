import OpenAI from 'openai'
import type { LLMProvider, ProviderSettings } from './types'

const MODEL = 'gpt-5.4-mini'
const TIMEOUT_MS = 120_000

export class OpenAIProvider implements LLMProvider {
  readonly name = 'openai' as const
  private client: OpenAI | null = null

  configure(settings: ProviderSettings): void {
    this.client = new OpenAI({
      apiKey: settings.apiKey ?? '',
      dangerouslyAllowBrowser: true,
      timeout: TIMEOUT_MS,
    })
  }

  async *execute(prompt: string, signal?: AbortSignal): AsyncIterable<string> {
    if (!this.client) {
      throw new Error('OpenAI provider is not configured — set an API key in settings')
    }

    let stream: AsyncIterable<OpenAI.Chat.Completions.ChatCompletionChunk>
    try {
      stream = await this.client.chat.completions.create(
        {
          model: MODEL,
          messages: [{ role: 'user', content: prompt }],
          stream: true,
        },
        { signal },
      )
    } catch (err) {
      throw sanitiseOpenAIError(err)
    }

    try {
      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content
        if (content) yield content
      }
    } catch (err) {
      throw sanitiseOpenAIError(err)
    }
  }
}

/**
 * Rethrows the error with the API key redacted from the message.
 * The openai SDK may include the key in certain error payloads.
 */
function sanitiseOpenAIError(err: unknown): Error {
  if (err instanceof Error) {
    const sanitised = new Error(redactKey(err.message))
    sanitised.name = err.name
    return sanitised
  }
  return new Error('An unknown OpenAI error occurred')
}

function redactKey(message: string): string {
  // Redact anything that looks like an OpenAI API key (sk-... patterns)
  return message.replace(/sk-[A-Za-z0-9_-]{10,}/g, '[REDACTED]')
}
