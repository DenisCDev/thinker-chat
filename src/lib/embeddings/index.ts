export const EMBEDDING_MODEL = 'gemini-embedding-001'
export const EMBEDDING_DIMENSIONS = 768

const GOOGLE_EMBED_URL = `https://generativelanguage.googleapis.com/v1beta/models/${EMBEDDING_MODEL}`

async function callEmbedApi(endpoint: string, body: object): Promise<Response> {
  const apiKey = process.env.GOOGLE_AI_API_KEY!
  const res = await fetch(`${GOOGLE_EMBED_URL}:${endpoint}?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Google Embedding API error (${res.status}): ${err}`)
  }
  return res
}

export async function generateEmbedding(text: string): Promise<number[]> {
  const res = await callEmbedApi('embedContent', {
    content: { parts: [{ text }] },
    outputDimensionality: EMBEDDING_DIMENSIONS,
  })
  const data = await res.json()
  return data.embedding.values
}

export async function generateEmbeddings(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return []

  const BATCH_SIZE = 100
  const embeddings: number[][] = []

  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const batch = texts.slice(i, i + BATCH_SIZE)

    const res = await callEmbedApi('batchEmbedContents', {
      requests: batch.map((text) => ({
        model: `models/${EMBEDDING_MODEL}`,
        content: { parts: [{ text }] },
        outputDimensionality: EMBEDDING_DIMENSIONS,
      })),
    })
    const data = await res.json()
    embeddings.push(...data.embeddings.map((e: { values: number[] }) => e.values))
  }

  return embeddings
}

export function estimateTokenCount(text: string): number {
  return Math.ceil(text.length / 4)
}
