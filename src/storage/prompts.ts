import type { Workflow } from '../workflow/types'

const KEY = 'insightforge:prompts'

const EXPORT_VERSION = 1

interface PromptsExport {
  version: number
  workflow: string
  templates: Record<string, string>
}

export function loadPrompts(
  workflow: Workflow,
  defaults: Record<string, string>,
): Record<string, string> {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return { ...defaults }
    const parsed: unknown = JSON.parse(raw)
    if (!isRecord(parsed)) return { ...defaults }

    const result: Record<string, string> = { ...defaults }
    for (const stage of workflow.stages) {
      const stored = parsed[stage.id]
      if (typeof stored === 'string') {
        result[stage.id] = stored
      }
    }
    return result
  } catch {
    return { ...defaults }
  }
}

export function savePrompts(templates: Record<string, string>): void {
  localStorage.setItem(KEY, JSON.stringify(templates))
}

export function exportPromptsAsJSON(workflow: Workflow, templates: Record<string, string>): string {
  const payload: PromptsExport = {
    version: EXPORT_VERSION,
    workflow: workflow.id,
    templates,
  }
  return JSON.stringify(payload, null, 2)
}

export function importPromptsFromJSON(json: string): Record<string, string> {
  let parsed: unknown
  try {
    parsed = JSON.parse(json) as unknown
  } catch {
    throw new Error('Invalid JSON: could not parse file')
  }

  if (!isRecord(parsed)) {
    throw new Error('Invalid format: expected a JSON object')
  }

  if (parsed['version'] !== EXPORT_VERSION) {
    throw new Error(
      `Unsupported version: expected ${String(EXPORT_VERSION)}, got ${String(parsed['version'])}`,
    )
  }

  const templates = parsed['templates']
  if (!isRecord(templates)) {
    throw new Error('Invalid format: "templates" must be an object')
  }

  const result: Record<string, string> = {}
  for (const [key, value] of Object.entries(templates)) {
    if (typeof value !== 'string') {
      throw new Error(`Invalid format: template "${key}" must be a string`)
    }
    result[key] = value
  }

  return result
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
