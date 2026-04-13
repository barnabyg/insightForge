import type { LLMProvider } from '../providers/types'
import type { Stage, Workflow } from './types'

/**
 * Replaces all occurrences of {{input}} in a template with the given input string.
 * Throws if the placeholder is absent.
 */
export function buildPrompt(template: string, input: string): string {
  if (!template.includes('{{input}}')) {
    throw new Error('Prompt template is missing the {{input}} placeholder')
  }
  return template.split('{{input}}').join(input)
}

/**
 * Returns the IDs of all stages whose position is >= fromPosition.
 * Used to determine which artifacts to clear on cascade.
 */
export function getCascadeIds(workflow: Workflow, fromPosition: number): string[] {
  return workflow.stages
    .filter((s) => s.position >= fromPosition)
    .map((s) => s.id)
}

/**
 * Runs a single stage, yielding text chunks from the LLM provider.
 * Stateless — callers own session state.
 */
export async function* runStage(
  _stage: Stage,
  inputContent: string,
  template: string,
  provider: LLMProvider,
  signal?: AbortSignal,
): AsyncGenerator<string> {
  const prompt = buildPrompt(template, inputContent)
  yield* provider.execute(prompt, signal)
}
