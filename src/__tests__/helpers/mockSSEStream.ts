/**
 * Creates a ReadableStream<Uint8Array> that emits SSE-formatted lines
 * in the format KoboldCPP uses: `data: {"token":"...","finish":false}\n\n`
 */
export function makeSSEStream(tokens: string[], finishSignal = true): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder()
  const lines: string[] = tokens.map(
    (token, i) =>
      `data: ${JSON.stringify({ token, finish: finishSignal && i === tokens.length - 1 })}\n\n`,
  )

  let index = 0
  return new ReadableStream<Uint8Array>({
    pull(controller) {
      if (index < lines.length) {
        controller.enqueue(encoder.encode(lines[index++]))
      } else {
        controller.close()
      }
    },
  })
}

/**
 * Creates a ReadableStream that emits a single malformed (non-JSON) SSE line,
 * then closes.
 */
export function makeMalformedSSEStream(): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder()
  return new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(encoder.encode('data: not-json\n\n'))
      controller.close()
    },
  })
}
