import type { KoboldPromptFormat } from './types'

/**
 * Wraps a raw prompt in the instruction format expected by the model.
 * The format must match whatever the model was fine-tuned on.
 *
 * Note: <bos> is included in the template strings below. If KoboldCPP is
 * configured to prepend BOS automatically (via --nobos or similar), remove
 * it from the relevant branch.
 */
export function wrapPrompt(prompt: string, format: KoboldPromptFormat): string {
  switch (format) {
    case 'gemma4':
      // Gemma 4 instruct format (Google, 2025)
      // https://ai.google.dev/gemma/docs/core/prompt-formatting-gemma4
      return `<bos><|turn>user\n${prompt}<turn|>\n<|turn>model\n`

    case 'chatml':
      // ChatML format — used by Mistral, Qwen, and many others
      return `<|im_start|>user\n${prompt}<|im_end|>\n<|im_start|>assistant\n`

    case 'none':
      return prompt
  }
}

const THINKING_OPEN = '<|channel>'
const THINKING_CLOSE = '<channel|>'

/**
 * Strips Gemma 4's thinking channel from a streamed token sequence.
 *
 * When Gemma 4 thinking is enabled the model opens its response with:
 *   <|channel>thought\n...internal reasoning...\n<channel|>\n
 * followed by the actual response. This generator discards everything up to
 * and including the close tag, then yields the remaining tokens unchanged.
 *
 * If no thinking channel is present the tokens are yielded as-is.
 */
export async function* stripThinkingChannel(
  source: AsyncIterable<string>,
): AsyncGenerator<string> {
  type State = 'detecting' | 'skipping' | 'yielding'
  let state: State = 'detecting'
  let buffer = ''

  for await (const chunk of source) {
    if (state === 'yielding') {
      yield chunk
      continue
    }

    buffer += chunk

    if (state === 'detecting') {
      if (buffer.startsWith(THINKING_OPEN)) {
        // Confirmed we're in a thinking block — switch to skipping
        state = 'skipping'
      } else if (buffer.length >= THINKING_OPEN.length || !THINKING_OPEN.startsWith(buffer)) {
        // Buffer is longer than the open tag and doesn't match — no thinking channel
        state = 'yielding'
        yield buffer
        buffer = ''
        continue
      }
      // else: buffer is still a valid prefix of THINKING_OPEN — keep buffering
    }

    if (state === 'skipping') {
      const closeIdx = buffer.indexOf(THINKING_CLOSE)
      if (closeIdx !== -1) {
        // Found the end of the thinking block — discard it and yield the rest
        const after = buffer.slice(closeIdx + THINKING_CLOSE.length)
        buffer = ''
        state = 'yielding'
        // Trim the single newline that typically follows the close tag
        const trimmed = after.startsWith('\n') ? after.slice(1) : after
        if (trimmed) yield trimmed
      }
    }
  }

  // If we were still detecting when the stream ended, the buffer is probably a
  // partial response with no thinking block — yield it.
  // If we were skipping, the thinking block never closed — discard silently.
  if (state === 'detecting' && buffer) yield buffer
}
