import type { KoboldPromptFormat, LLMProvider, ProviderSettings } from './types'
import { wrapPrompt, stripThinkingChannel } from './prompt-formats'

const BASE_URL = 'http://localhost:5001'
const STREAM_ENDPOINT = `${BASE_URL}/api/extra/generate/stream`
const TIMEOUT_MS = 120_000
const MAX_LENGTH = 2048

interface KoboldSSEToken {
  token?: string
  finish?: boolean
}

export class KoboldProvider implements LLMProvider {
  readonly name = 'kobold' as const
  private format: KoboldPromptFormat = 'none'

  configure(settings: ProviderSettings): void {
    this.format = settings.koboldFormat ?? 'none'
  }

  async *execute(prompt: string, signal?: AbortSignal): AsyncIterable<string> {
    const wrappedPrompt = wrapPrompt(prompt, this.format)
    const timeoutController = new AbortController()
    const timeoutId = setTimeout(() => { timeoutController.abort(); }, TIMEOUT_MS)

    // Merge caller signal with our timeout signal
    const combinedSignal = signal
      ? anySignal([signal, timeoutController.signal])
      : timeoutController.signal

    let response: Response
    try {
      response = await fetch(STREAM_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: wrappedPrompt, max_length: MAX_LENGTH }),
        signal: combinedSignal,
      })
    } catch (err) {
      clearTimeout(timeoutId)
      if (isAbortError(err) && signal?.aborted) {
        // Caller cancelled — rethrow as-is
        throw err
      }
      throw new Error(
        'Cannot connect to KoboldCPP on localhost:5001 — is KoboldCPP running?',
      )
    }

    if (!response.ok) {
      clearTimeout(timeoutId)
      throw new Error(`KoboldCPP returned HTTP ${String(response.status)}: ${response.statusText}`)
    }

    if (!response.body) {
      clearTimeout(timeoutId)
      throw new Error('KoboldCPP response has no body')
    }

    try {
      const tokens = parseSSEStream(response.body, combinedSignal)
      const filtered = this.format === 'gemma4' ? stripThinkingChannel(tokens) : tokens
      yield* filtered
    } finally {
      clearTimeout(timeoutId)
    }
  }
}

async function* parseSSEStream(
  body: ReadableStream<Uint8Array>,
  signal: AbortSignal,
): AsyncGenerator<string> {
  const reader = body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  try {
    for (;;) {
      if (signal.aborted) break

      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })

      const lines = buffer.split('\n')
      // Keep the last (potentially incomplete) line in the buffer
      buffer = lines.pop() ?? ''

      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed.startsWith('data:')) continue

        const data = trimmed.slice('data:'.length).trim()
        if (!data || data === '[DONE]') continue

        let parsed: KoboldSSEToken
        try {
          parsed = JSON.parse(data) as KoboldSSEToken
        } catch {
          continue // skip malformed SSE lines
        }

        if (parsed.token) yield parsed.token
        if (parsed.finish) return
      }
    }
  } finally {
    reader.releaseLock()
  }
}

/**
 * Combines multiple AbortSignals — aborts when any of them fires.
 */
function anySignal(signals: AbortSignal[]): AbortSignal {
  const controller = new AbortController()
  for (const signal of signals) {
    if (signal.aborted) {
      controller.abort()
      return controller.signal
    }
    signal.addEventListener('abort', () => { controller.abort(); }, { once: true })
  }
  return controller.signal
}

function isAbortError(err: unknown): boolean {
  return err instanceof Error && err.name === 'AbortError'
}
