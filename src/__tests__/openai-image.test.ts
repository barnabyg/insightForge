import { describe, it, expect, vi, beforeEach } from 'vitest'
import { generateOpenAIImage } from '../providers/openai-image'

const mockGenerate = vi.fn()

vi.mock('openai', () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      images: {
        generate: mockGenerate,
      },
    })),
  }
})

beforeEach(() => {
  mockGenerate.mockReset()
})

describe('generateOpenAIImage', () => {
  it('throws when no API key is provided', async () => {
    await expect(generateOpenAIImage('', 'prompt')).rejects.toThrow('not configured')
  })

  it('returns a PNG data URL from base64 image output', async () => {
    mockGenerate.mockResolvedValue({
      data: [{ b64_json: 'ZmFrZS1pbWFnZQ==' }],
    })

    const result = await generateOpenAIImage('sk-test', 'A mockup prompt')
    expect(result.dataUrl).toBe('data:image/png;base64,ZmFrZS1pbWFnZQ==')
  })

  it('passes the AbortSignal to the API call', async () => {
    mockGenerate.mockResolvedValue({
      data: [{ b64_json: 'ZmFrZS1pbWFnZQ==' }],
    })

    const controller = new AbortController()
    await generateOpenAIImage('sk-test', 'Prompt', controller.signal)

    const [, options] = mockGenerate.mock.calls[0] as [unknown, { signal: AbortSignal }]
    expect(options.signal).toBe(controller.signal)
  })

  it('redacts API keys from thrown errors', async () => {
    const apiKey = 'sk-supersecretkey12345'
    mockGenerate.mockRejectedValue(
      new Error(`Request failed for key ${apiKey}`),
    )

    await expect(generateOpenAIImage(apiKey, 'Prompt')).rejects.toThrow('[REDACTED]')
  })

  it('throws when no image data is returned', async () => {
    mockGenerate.mockResolvedValue({ data: [{}] })
    await expect(generateOpenAIImage('sk-test', 'Prompt')).rejects.toThrow('no image data')
  })
})
