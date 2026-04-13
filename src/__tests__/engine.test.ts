import { describe, it, expect, beforeEach } from 'vitest'
import { buildPrompt, getCascadeIds, runStage } from '../workflow/engine'
import { MockLLMProvider } from './helpers/MockLLMProvider'
import type { Workflow } from '../workflow/types'

const WORKFLOW: Workflow = {
  id: 'test',
  name: 'Test',
  stages: [
    { id: 'stage-1', name: 'Stage 1', position: 0 },
    { id: 'stage-2', name: 'Stage 2', position: 1 },
    { id: 'stage-3', name: 'Stage 3', position: 2 },
  ],
}

// ---------------------------------------------------------------------------
// buildPrompt
// ---------------------------------------------------------------------------

describe('buildPrompt', () => {
  it('replaces {{input}} with the provided content', () => {
    expect(buildPrompt('Hello {{input}}!', 'world')).toBe('Hello world!')
  })

  it('replaces all occurrences of {{input}}', () => {
    expect(buildPrompt('{{input}} and {{input}}', 'x')).toBe('x and x')
  })

  it('throws when {{input}} placeholder is absent', () => {
    expect(() => buildPrompt('No placeholder here', 'value')).toThrow(
      'missing the {{input}} placeholder',
    )
  })

  it('handles empty input string', () => {
    expect(buildPrompt('Before {{input}} after', '')).toBe('Before  after')
  })

  it('handles input containing curly braces', () => {
    expect(buildPrompt('{{input}}', '{{input}}')).toBe('{{input}}')
  })
})

// ---------------------------------------------------------------------------
// getCascadeIds
// ---------------------------------------------------------------------------

describe('getCascadeIds', () => {
  it('returns all stage IDs when fromPosition is 0', () => {
    expect(getCascadeIds(WORKFLOW, 0)).toEqual(['stage-1', 'stage-2', 'stage-3'])
  })

  it('returns stages from position 1 onward', () => {
    expect(getCascadeIds(WORKFLOW, 1)).toEqual(['stage-2', 'stage-3'])
  })

  it('returns only the last stage when fromPosition is 2', () => {
    expect(getCascadeIds(WORKFLOW, 2)).toEqual(['stage-3'])
  })

  it('returns an empty array when fromPosition exceeds all stages', () => {
    expect(getCascadeIds(WORKFLOW, 99)).toEqual([])
  })
})

// ---------------------------------------------------------------------------
// runStage
// ---------------------------------------------------------------------------

describe('runStage', () => {
  let provider: MockLLMProvider

  beforeEach(() => {
    provider = new MockLLMProvider()
  })

  it('yields all chunks from the provider in order', async () => {
    provider.setChunks(['Hello', ' ', 'world'])
    const stage = WORKFLOW.stages[0]
    const chunks: string[] = []
    for await (const chunk of runStage(stage, 'my insight', 'Analyse: {{input}}', provider)) {
      chunks.push(chunk)
    }
    expect(chunks).toEqual(['Hello', ' ', 'world'])
  })

  it('passes the built prompt (with input substituted) to the provider', async () => {
    provider.setChunks([])
    const stage = WORKFLOW.stages[0]
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    for await (const _ of runStage(stage, 'test input', 'Template: {{input}}', provider)) {
      // drain
    }
    expect(provider.lastPrompt).toBe('Template: test input')
  })

  it('propagates provider errors', async () => {
    provider.setError(new Error('LLM unavailable'))
    const stage = WORKFLOW.stages[0]
    await expect(async () => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      for await (const _ of runStage(stage, 'input', 'Template: {{input}}', provider)) {
        // drain
      }
    }).rejects.toThrow('LLM unavailable')
  })

  it('passes the AbortSignal through to the provider', async () => {
    provider.setChunks(['a', 'b'])
    const controller = new AbortController()
    const stage = WORKFLOW.stages[0]
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    for await (const _ of runStage(stage, 'in', 'T: {{input}}', provider, controller.signal)) {
      break // consume one chunk then stop iterating
    }
    expect(provider.lastSignal).toBe(controller.signal)
  })

  it('stops yielding chunks when AbortSignal is aborted', async () => {
    const controller = new AbortController()
    // Abort before iteration
    controller.abort()
    provider.setChunks(['a', 'b', 'c'])
    const stage = WORKFLOW.stages[0]
    const chunks: string[] = []
    for await (const chunk of runStage(stage, 'in', 'T: {{input}}', provider, controller.signal)) {
      chunks.push(chunk)
    }
    expect(chunks).toEqual([])
  })

  it('throws when the template has no {{input}} placeholder', async () => {
    provider.setChunks([])
    const stage = WORKFLOW.stages[0]
    await expect(async () => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      for await (const _ of runStage(stage, 'in', 'no placeholder', provider)) {
        // drain
      }
    }).rejects.toThrow('missing the {{input}} placeholder')
  })
})
