import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { KoboldProvider } from '../providers/kobold.provider'
import { makeSSEStream, makeMalformedSSEStream } from './helpers/mockSSEStream'

function makeFetchMock(stream: ReadableStream<Uint8Array>, status = 200) {
  return vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? 'OK' : 'Error',
    body: stream,
  } as unknown as Response)
}

async function collectChunks(provider: KoboldProvider, prompt = 'test'): Promise<string[]> {
  const chunks: string[] = []
  for await (const chunk of provider.execute(prompt)) {
    chunks.push(chunk)
  }
  return chunks
}

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn())
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('KoboldProvider.execute', () => {
  it('yields tokens from a valid SSE stream', async () => {
    vi.stubGlobal('fetch', makeFetchMock(makeSSEStream(['Hello', ' ', 'world'])))
    const provider = new KoboldProvider()
    expect(await collectChunks(provider)).toEqual(['Hello', ' ', 'world'])
  })

  it('stops yielding when finish:true is received', async () => {
    // makeSSEStream sets finish:true on the last token by default
    vi.stubGlobal('fetch', makeFetchMock(makeSSEStream(['tok1', 'tok2'])))
    const provider = new KoboldProvider()
    expect(await collectChunks(provider)).toEqual(['tok1', 'tok2'])
  })

  it('silently skips malformed SSE lines', async () => {
    vi.stubGlobal('fetch', makeFetchMock(makeMalformedSSEStream()))
    const provider = new KoboldProvider()
    expect(await collectChunks(provider)).toEqual([])
  })

  it('throws the KoboldCPP connection message on network error', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockRejectedValue(new TypeError('Failed to fetch')),
    )
    const provider = new KoboldProvider()
    await expect(collectChunks(provider)).rejects.toThrow(
      'Cannot connect to KoboldCPP on localhost:5001 — is KoboldCPP running?',
    )
  })

  it('throws on non-OK HTTP response', async () => {
    vi.stubGlobal('fetch', makeFetchMock(makeSSEStream([]), 500))
    const provider = new KoboldProvider()
    await expect(collectChunks(provider)).rejects.toThrow('KoboldCPP returned HTTP 500')
  })

  it('passes the prompt in the request body', async () => {
    const mockFetch = makeFetchMock(makeSSEStream([]))
    vi.stubGlobal('fetch', mockFetch)
    const provider = new KoboldProvider()
    await collectChunks(provider, 'my prompt')

    const [, init] = mockFetch.mock.calls[0] as [string, RequestInit]
    const body = JSON.parse(init.body as string) as { prompt: string }
    expect(body.prompt).toBe('my prompt')
  })

  it('stops iteration when caller AbortSignal fires', async () => {
    const controller = new AbortController()
    // Abort before we even start
    controller.abort()

    const abortError = new Error('AbortError')
    abortError.name = 'AbortError'
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(abortError))

    const provider = new KoboldProvider()
    // Should rethrow the abort error, not the KoboldCPP connection message
    await expect(async () => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      for await (const _ of provider.execute('p', controller.signal)) {
        // drain
      }
    }).rejects.toThrow('AbortError')
  })

  it('configure does not throw', () => {
    const provider = new KoboldProvider()
    expect(() => { provider.configure({ provider: 'kobold' }); }).not.toThrow()
  })
})

// ---------------------------------------------------------------------------
// Prompt format wrapping
// ---------------------------------------------------------------------------

describe('KoboldProvider — prompt format', () => {
  afterEach(() => { vi.unstubAllGlobals() })

  function sentPrompt(mockFetch: ReturnType<typeof vi.fn>): string {
    const [, init] = mockFetch.mock.calls[0] as [string, RequestInit]
    const body = JSON.parse(init.body as string) as { prompt: string }
    return body.prompt
  }

  it('sends raw prompt when format is "none"', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true, status: 200, statusText: 'OK',
      body: makeSSEStream([]),
    } as unknown as Response)
    vi.stubGlobal('fetch', mockFetch)

    const provider = new KoboldProvider()
    provider.configure({ provider: 'kobold', koboldFormat: 'none' })
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    for await (const _ of provider.execute('my prompt')) { /* drain */ }

    expect(sentPrompt(mockFetch)).toBe('my prompt')
  })

  it('wraps prompt in Gemma 4 format when koboldFormat is "gemma4"', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true, status: 200, statusText: 'OK',
      body: makeSSEStream(['response text']),
    } as unknown as Response)
    vi.stubGlobal('fetch', mockFetch)

    const provider = new KoboldProvider()
    provider.configure({ provider: 'kobold', koboldFormat: 'gemma4' })
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    for await (const _ of provider.execute('my prompt')) { /* drain */ }

    const sent = sentPrompt(mockFetch)
    expect(sent).toBe('<bos><|turn>user\nmy prompt<turn|>\n<|turn>model\n')
  })

  it('wraps prompt in ChatML format when koboldFormat is "chatml"', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true, status: 200, statusText: 'OK',
      body: makeSSEStream([]),
    } as unknown as Response)
    vi.stubGlobal('fetch', mockFetch)

    const provider = new KoboldProvider()
    provider.configure({ provider: 'kobold', koboldFormat: 'chatml' })
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    for await (const _ of provider.execute('my prompt')) { /* drain */ }

    const sent = sentPrompt(mockFetch)
    expect(sent).toBe('<|im_start|>user\nmy prompt<|im_end|>\n<|im_start|>assistant\n')
  })

  it('defaults to no wrapping when koboldFormat is not set', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true, status: 200, statusText: 'OK',
      body: makeSSEStream([]),
    } as unknown as Response)
    vi.stubGlobal('fetch', mockFetch)

    const provider = new KoboldProvider()
    provider.configure({ provider: 'kobold' })
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    for await (const _ of provider.execute('my prompt')) { /* drain */ }

    expect(sentPrompt(mockFetch)).toBe('my prompt')
  })
})
