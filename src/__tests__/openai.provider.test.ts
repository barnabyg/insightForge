import { describe, it, expect, vi, beforeEach } from 'vitest'
import { OpenAIProvider } from '../providers/openai.provider'

// ---------------------------------------------------------------------------
// Mock the openai module
// ---------------------------------------------------------------------------

const mockCreate = vi.fn()

vi.mock('openai', () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      chat: {
        completions: {
          create: mockCreate,
        },
      },
    })),
  }
})

// eslint-disable-next-line @typescript-eslint/require-await
async function* makeChunkStream(contents: string[]) {
  for (const content of contents) {
    yield { choices: [{ delta: { content } }] }
  }
}

async function collectChunks(provider: OpenAIProvider, prompt = 'test'): Promise<string[]> {
  const chunks: string[] = []
  for await (const chunk of provider.execute(prompt)) {
    chunks.push(chunk)
  }
  return chunks
}

beforeEach(() => {
  mockCreate.mockReset()
})

describe('OpenAIProvider.execute', () => {
  it('throws when not configured', async () => {
    const provider = new OpenAIProvider()
    await expect(collectChunks(provider)).rejects.toThrow('not configured')
  })

  it('yields tokens from the stream', async () => {
    mockCreate.mockResolvedValue(makeChunkStream(['Hello', ' ', 'world']))
    const provider = new OpenAIProvider()
    provider.configure({ provider: 'openai', apiKey: 'sk-test' })
    expect(await collectChunks(provider)).toEqual(['Hello', ' ', 'world'])
  })

  it('skips chunks with no delta content', async () => {
    // eslint-disable-next-line @typescript-eslint/require-await
    async function* stream() {
      yield { choices: [{ delta: { content: 'a' } }] }
      yield { choices: [{ delta: {} }] } // no content
      yield { choices: [{ delta: { content: 'b' } }] }
    }
    mockCreate.mockResolvedValue(stream())
    const provider = new OpenAIProvider()
    provider.configure({ provider: 'openai', apiKey: 'sk-test' })
    expect(await collectChunks(provider)).toEqual(['a', 'b'])
  })

  it('does not expose API key in error messages', async () => {
    const apiKey = 'sk-supersecretkey12345'
    mockCreate.mockRejectedValue(
      new Error(`Authentication failed with key ${apiKey}: invalid_api_key`),
    )
    const provider = new OpenAIProvider()
    provider.configure({ provider: 'openai', apiKey })

    let errorMessage = ''
    try {
      await collectChunks(provider)
    } catch (err) {
      errorMessage = err instanceof Error ? err.message : ''
    }

    expect(errorMessage).not.toContain(apiKey)
    expect(errorMessage).toContain('[REDACTED]')
  })

  it('re-configures the client when configure is called again', async () => {
    mockCreate.mockResolvedValue(makeChunkStream(['ok']))
    const provider = new OpenAIProvider()
    provider.configure({ provider: 'openai', apiKey: 'sk-key1' })
    provider.configure({ provider: 'openai', apiKey: 'sk-key2' })
    await expect(collectChunks(provider)).resolves.toEqual(['ok'])
  })

  it('passes the AbortSignal to the API call', async () => {
    mockCreate.mockResolvedValue(makeChunkStream([]))
    const provider = new OpenAIProvider()
    provider.configure({ provider: 'openai', apiKey: 'sk-test' })

    const controller = new AbortController()
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    for await (const _ of provider.execute('prompt', controller.signal)) {
      // drain
    }

    const [, options] = mockCreate.mock.calls[0] as [unknown, { signal: AbortSignal }]
    expect(options.signal).toBe(controller.signal)
  })
})
