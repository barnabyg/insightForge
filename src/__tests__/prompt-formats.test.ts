import { describe, it, expect } from 'vitest'
import { wrapPrompt, stripThinkingChannel } from '../providers/prompt-formats'

// Helper: collect all chunks from an AsyncIterable into a single string
async function collect(source: AsyncIterable<string>): Promise<string> {
  let result = ''
  for await (const chunk of source) result += chunk
  return result
}

// Helper: create an AsyncIterable from an array of string chunks
// eslint-disable-next-line @typescript-eslint/require-await
async function* chunked(...chunks: string[]): AsyncIterable<string> {
  for (const chunk of chunks) yield chunk
}

const SAMPLE_PROMPT = 'You are a strategist. Analyse this idea:\n\nA tourist app that shows historical facts.'

describe('wrapPrompt — none', () => {
  it('returns the prompt unchanged', () => {
    expect(wrapPrompt(SAMPLE_PROMPT, 'none')).toBe(SAMPLE_PROMPT)
  })

  it('handles empty prompt', () => {
    expect(wrapPrompt('', 'none')).toBe('')
  })
})

describe('wrapPrompt — gemma4', () => {
  it('wraps the prompt in Gemma 4 turn tokens', () => {
    const result = wrapPrompt(SAMPLE_PROMPT, 'gemma4')
    expect(result).toBe(`<bos><|turn>user\n${SAMPLE_PROMPT}<turn|>\n<|turn>model\n`)
  })

  it('starts with <bos><|turn>user', () => {
    expect(wrapPrompt(SAMPLE_PROMPT, 'gemma4')).toMatch(/^<bos><\|turn>user\n/)
  })

  it('ends with the model turn token and trailing newline', () => {
    expect(wrapPrompt(SAMPLE_PROMPT, 'gemma4')).toMatch(/<turn\|>\n<\|turn>model\n$/)
  })

  it('contains the original prompt text unchanged', () => {
    expect(wrapPrompt(SAMPLE_PROMPT, 'gemma4')).toContain(SAMPLE_PROMPT)
  })

  it('handles a prompt containing special characters', () => {
    const prompt = 'Hello <world> & "quotes" | pipes'
    const result = wrapPrompt(prompt, 'gemma4')
    expect(result).toContain(prompt)
  })

  it('handles an empty prompt', () => {
    const result = wrapPrompt('', 'gemma4')
    expect(result).toBe('<bos><|turn>user\n<turn|>\n<|turn>model\n')
  })

  it('does not double-wrap if called twice', () => {
    const once = wrapPrompt(SAMPLE_PROMPT, 'gemma4')
    const twice = wrapPrompt(once, 'gemma4')
    // Wrapping twice produces a different (wrong) string — this verifies the
    // function does not strip existing wrapping (wrapping is the caller's responsibility)
    expect(twice).not.toBe(once)
    expect(twice.startsWith('<bos><|turn>user\n<bos>')).toBe(true)
  })
})

describe('wrapPrompt — chatml', () => {
  it('wraps the prompt in ChatML tokens', () => {
    const result = wrapPrompt(SAMPLE_PROMPT, 'chatml')
    expect(result).toBe(`<|im_start|>user\n${SAMPLE_PROMPT}<|im_end|>\n<|im_start|>assistant\n`)
  })

  it('starts with <|im_start|>user', () => {
    expect(wrapPrompt(SAMPLE_PROMPT, 'chatml')).toMatch(/^<\|im_start\|>user\n/)
  })

  it('ends with the assistant turn opener', () => {
    expect(wrapPrompt(SAMPLE_PROMPT, 'chatml')).toMatch(/<\|im_end\|>\n<\|im_start\|>assistant\n$/)
  })

  it('contains the original prompt text unchanged', () => {
    expect(wrapPrompt(SAMPLE_PROMPT, 'chatml')).toContain(SAMPLE_PROMPT)
  })
})

// ---------------------------------------------------------------------------
// stripThinkingChannel
// ---------------------------------------------------------------------------

describe('stripThinkingChannel — no thinking block', () => {
  it('passes through a plain response unchanged', async () => {
    const result = await collect(stripThinkingChannel(chunked('Hello ', 'world')))
    expect(result).toBe('Hello world')
  })

  it('passes through an empty stream', async () => {
    const result = await collect(stripThinkingChannel(chunked()))
    expect(result).toBe('')
  })

  it('passes through a single-chunk response', async () => {
    const result = await collect(stripThinkingChannel(chunked('Just a response.')))
    expect(result).toBe('Just a response.')
  })
})

describe('stripThinkingChannel — thinking block present', () => {
  it('strips the thinking block and yields only the response', async () => {
    const stream = chunked(
      '<|channel>thought\nI need to think about this carefully.\n<channel|>\n',
      'Here is my actual response.',
    )
    expect(await collect(stripThinkingChannel(stream))).toBe('Here is my actual response.')
  })

  it('strips a multi-chunk thinking block', async () => {
    const stream = chunked(
      '<|channel>thought\n',
      'chunk one of thinking\n',
      'chunk two of thinking\n',
      '<channel|>\n',
      'The real answer.',
    )
    expect(await collect(stripThinkingChannel(stream))).toBe('The real answer.')
  })

  it('handles the close tag split across chunk boundaries', async () => {
    // <channel|> split as "<chan" + "nel|>"
    const stream = chunked(
      '<|channel>thought\nsome reasoning<chan',
      'nel|>\nActual response.',
    )
    expect(await collect(stripThinkingChannel(stream))).toBe('Actual response.')
  })

  it('handles the open tag split across chunk boundaries', async () => {
    // <|channel> split as "<|chan" + "nel>thought\n..."
    const stream = chunked(
      '<|chan',
      'nel>thought\nsome thinking\n<channel|>\nResponse.',
    )
    expect(await collect(stripThinkingChannel(stream))).toBe('Response.')
  })

  it('strips the newline immediately after the close tag', async () => {
    const stream = chunked('<|channel>thought\nthinking<channel|>\nResponse text.')
    expect(await collect(stripThinkingChannel(stream))).toBe('Response text.')
  })

  it('yields response content that arrives in the same chunk as the close tag', async () => {
    const stream = chunked('<|channel>thought\nthinking<channel|>\nImmediate response.')
    expect(await collect(stripThinkingChannel(stream))).toBe('Immediate response.')
  })

  it('yields nothing if the stream ends inside a thinking block', async () => {
    const stream = chunked('<|channel>thought\nnever finished thinking')
    expect(await collect(stripThinkingChannel(stream))).toBe('')
  })
})
