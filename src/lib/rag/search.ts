import { createClient } from '@/lib/supabase/server'
import { generateEmbedding } from '@/lib/embeddings'

export interface KnowledgeResult {
  id: string
  content: string
  metadata: {
    document_id?: string
    document_title?: string
    page?: number
    source_type?: string
    chunk_index?: number
    section?: string
    source?: string
  }
  assistant_slug: string | null
  similarity: number
}

export interface SearchOptions {
  matchThreshold?: number
  matchCount?: number
}

const DEFAULT_THRESHOLD = 0.5
const DEFAULT_MATCH_COUNT = 10

/**
 * Search knowledge base for relevant content
 * Uses semantic similarity via pgvector
 */
export async function searchKnowledge(
  query: string,
  assistantSlug?: string | null,
  options?: SearchOptions
): Promise<KnowledgeResult[]> {
  const threshold = options?.matchThreshold ?? DEFAULT_THRESHOLD
  const count = options?.matchCount ?? DEFAULT_MATCH_COUNT

  // Generate embedding for the query
  const queryEmbedding = await generateEmbedding(query)

  // Call Supabase RPC function
  const supabase = await createClient()

  const { data, error } = await supabase.rpc('match_knowledge', {
    query_embedding: queryEmbedding,
    match_threshold: threshold,
    match_count: count,
    filter_assistant: assistantSlug ?? null,
  })

  if (error) {
    console.error('Knowledge search error:', error)
    throw new Error(`Failed to search knowledge base: ${error.message}`)
  }

  return (data || []) as KnowledgeResult[]
}

/**
 * Format search results as context for the LLM
 * Returns a structured block to inject into system prompt
 */
export function formatSearchResultsForContext(results: KnowledgeResult[]): string {
  if (results.length === 0) return ''

  const formattedChunks = results.map((result, index) => {
    const source = result.metadata.document_title || result.metadata.source || 'Documento'
    const section = result.metadata.section || ''
    const page = result.metadata.page ? ` (p. ${result.metadata.page})` : ''

    const header = section ? `[${source} - ${section}${page}]` : `[${source}${page}]`

    return `### Trecho ${index + 1}\n${header}\n${result.content}`
  })

  return `
<conhecimento_base>
Use o conhecimento abaixo para fundamentar suas respostas quando relevante.
Cite as fontes quando apropriado.

${formattedChunks.join('\n\n---\n\n')}
</conhecimento_base>

IMPORTANTE: Baseie suas respostas no conhecimento fornecido acima quando relevante para a pergunta do usuário.`
}

/**
 * Quick check if there's any knowledge for an assistant
 */
export async function hasKnowledge(assistantSlug: string): Promise<boolean> {
  const supabase = await createClient()

  const { count, error } = await supabase
    .from('knowledge_base')
    .select('*', { count: 'exact', head: true })
    .eq('assistant_slug', assistantSlug)

  if (error) {
    console.error('Error checking knowledge:', error)
    return false
  }

  return (count ?? 0) > 0
}
