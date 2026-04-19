import OpenAI from 'openai'

const MODEL = 'gpt-image-1'
const SIZE = '1024x1024'
const QUALITY = 'medium'
const TIMEOUT_MS = 120_000

export interface GeneratedImage {
  dataUrl: string
}

export async function generateOpenAIImage(
  apiKey: string,
  prompt: string,
  signal?: AbortSignal,
): Promise<GeneratedImage> {
  if (!apiKey.trim()) {
    throw new Error('OpenAI image generation is not configured — set an API key in settings')
  }

  const client = new OpenAI({
    apiKey,
    dangerouslyAllowBrowser: true,
    timeout: TIMEOUT_MS,
  })

  try {
    const response = await client.images.generate({
      model: MODEL,
      prompt,
      size: SIZE,
      quality: QUALITY,
    }, { signal })

    const imageBase64 = response.data?.[0]?.b64_json
    if (!imageBase64) {
      throw new Error('OpenAI image generation returned no image data')
    }

    return {
      dataUrl: `data:image/png;base64,${imageBase64}`,
    }
  } catch (err) {
    throw sanitiseOpenAIError(err)
  }
}

function sanitiseOpenAIError(err: unknown): Error {
  if (err instanceof Error) {
    const sanitised = new Error(redactKey(err.message))
    sanitised.name = err.name
    return sanitised
  }
  return new Error('An unknown OpenAI image generation error occurred')
}

function redactKey(message: string): string {
  return message.replace(/sk-[A-Za-z0-9_-]{10,}/g, '[REDACTED]')
}
