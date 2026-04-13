import { describe, it, expect, beforeEach } from 'vitest'
import { MockLocalStorage } from './helpers/mockLocalStorage'
import {
  loadPrompts,
  savePrompts,
  exportPromptsAsJSON,
  importPromptsFromJSON,
} from '../storage/prompts'
import type { Workflow } from '../workflow/types'

const WORKFLOW: Workflow = {
  id: 'test-workflow',
  name: 'Test Workflow',
  stages: [
    { id: 'stage-1', name: 'Stage 1', position: 0 },
    { id: 'stage-2', name: 'Stage 2', position: 1 },
  ],
}

const DEFAULTS: Record<string, string> = {
  'stage-1': 'default prompt 1 {{input}}',
  'stage-2': 'default prompt 2 {{input}}',
}

let mockStorage: MockLocalStorage

beforeEach(() => {
  mockStorage = new MockLocalStorage()
  Object.defineProperty(globalThis, 'localStorage', {
    value: mockStorage,
    writable: true,
    configurable: true,
  })
})

describe('loadPrompts', () => {
  it('returns defaults when localStorage is empty', () => {
    expect(loadPrompts(WORKFLOW, DEFAULTS)).toEqual(DEFAULTS)
  })

  it('returns stored prompts after save', () => {
    const templates = { 'stage-1': 'custom 1 {{input}}', 'stage-2': 'custom 2 {{input}}' }
    savePrompts(templates)
    expect(loadPrompts(WORKFLOW, DEFAULTS)).toEqual(templates)
  })

  it('falls back to default for a missing stage', () => {
    savePrompts({ 'stage-1': 'custom 1 {{input}}' })
    const result = loadPrompts(WORKFLOW, DEFAULTS)
    expect(result['stage-1']).toBe('custom 1 {{input}}')
    expect(result['stage-2']).toBe(DEFAULTS['stage-2'])
  })

  it('returns defaults when stored JSON is malformed', () => {
    mockStorage.setItem('insightforge:prompts', 'bad json{{')
    expect(loadPrompts(WORKFLOW, DEFAULTS)).toEqual(DEFAULTS)
  })

  it('returns defaults when stored value is not an object', () => {
    mockStorage.setItem('insightforge:prompts', JSON.stringify([1, 2]))
    expect(loadPrompts(WORKFLOW, DEFAULTS)).toEqual(DEFAULTS)
  })
})

describe('savePrompts', () => {
  it('persists templates that survive a reload', () => {
    const templates = { 'stage-1': 'saved {{input}}', 'stage-2': 'saved 2 {{input}}' }
    savePrompts(templates)
    expect(loadPrompts(WORKFLOW, DEFAULTS)).toEqual(templates)
  })
})

describe('exportPromptsAsJSON', () => {
  it('produces valid JSON', () => {
    const json = exportPromptsAsJSON(WORKFLOW, DEFAULTS)
    expect(() => { JSON.parse(json) }).not.toThrow()
  })

  it('includes version, workflow id, and templates', () => {
    const json = exportPromptsAsJSON(WORKFLOW, DEFAULTS)
    const parsed = JSON.parse(json) as { version: number; workflow: string; templates: unknown }
    expect(parsed.version).toBe(1)
    expect(parsed.workflow).toBe('test-workflow')
    expect(parsed.templates).toEqual(DEFAULTS)
  })
})

describe('importPromptsFromJSON', () => {
  it('correctly imports a valid export', () => {
    const json = exportPromptsAsJSON(WORKFLOW, DEFAULTS)
    expect(importPromptsFromJSON(json)).toEqual(DEFAULTS)
  })

  it('throws on malformed JSON', () => {
    expect(() => importPromptsFromJSON('not json{{{')).toThrow('Invalid JSON')
  })

  it('throws when root is not an object', () => {
    expect(() => importPromptsFromJSON(JSON.stringify([1, 2, 3]))).toThrow('Invalid format')
  })

  it('throws when version is wrong', () => {
    const json = JSON.stringify({ version: 99, workflow: 'x', templates: {} })
    expect(() => importPromptsFromJSON(json)).toThrow('Unsupported version')
  })

  it('throws when templates is not an object', () => {
    const json = JSON.stringify({ version: 1, workflow: 'x', templates: 'oops' })
    expect(() => importPromptsFromJSON(json)).toThrow('"templates" must be an object')
  })

  it('throws when a template value is not a string', () => {
    const json = JSON.stringify({ version: 1, workflow: 'x', templates: { 'stage-1': 42 } })
    expect(() => importPromptsFromJSON(json)).toThrow('must be a string')
  })

  it('round-trips custom templates correctly', () => {
    const templates = { 'stage-1': 'my prompt {{input}}', 'stage-2': 'my other {{input}}' }
    const json = exportPromptsAsJSON(WORKFLOW, templates)
    expect(importPromptsFromJSON(json)).toEqual(templates)
  })
})
