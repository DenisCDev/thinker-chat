import { createClient } from '@/lib/supabase/server'
import { generateEmbeddings } from '@/lib/embeddings'
import { chunkDocument, cleanPdfText, type Chunk } from './chunking'
import { sanitizeForPrompt, shouldBlockFileContent } from '@/lib/security/sanitize'

export interface IngestOptions {
  assistantSlug: string
  documentId: string
  documentTitle: string
  sourceType?: 'book' | 'article' | 'law' | 'manual' | 'other'
  userId: string
}

export interface IngestResult {
  success: boolean
  chunksCreated: number
  documentId: string
  error?: string
}

export interface KnowledgeStats {
  totalChunks: number
  byAssistant: Record<string, number>
  documents: Array<{
    documentId: string
    documentTitle: string
    assistantSlug: string | null
    chunks: number
  }>
}

/**
 * Ingest a document into the knowledge base
 * Handles chunking, embedding generation, and storage
 */
export async function ingestDocument(
  text: string,
  options: IngestOptions
): Promise<IngestResult> {
  const { assistantSlug, documentId, documentTitle, sourceType, userId } = options

  try {
    // Clean text if it looks like PDF extraction
    const cleanedText = text.includes('\f') ? cleanPdfText(text) : text

    // Security check: block documents with high-severity injection attempts
    const blockCheck = shouldBlockFileContent(cleanedText)
    if (blockCheck.block) {
      console.warn(`BLOCKED document ${documentId}:`, blockCheck.reason)
      return {
        success: false,
        chunksCreated: 0,
        documentId,
        error: `Documento bloqueado por segurança: ${blockCheck.reason}`,
      }
    }

    // Sanitize the entire text before chunking
    const sanitizedText = sanitizeForPrompt(cleanedText)

    // Chunk the document
    const chunks = chunkDocument(sanitizedText, documentId)

    if (chunks.length === 0) {
      return {
        success: false,
        chunksCreated: 0,
        documentId,
        error: 'No valid chunks could be extracted from the document',
      }
    }

    // Generate embeddings for all chunks
    const chunkTexts = chunks.map((c) => c.content)
    const embeddings = await generateEmbeddings(chunkTexts)

    // Prepare records for insertion
    const records = chunks.map((chunk, index) => ({
      content: chunk.content,
      metadata: {
        document_id: documentId,
        document_title: documentTitle,
        source_type: sourceType || 'other',
        chunk_index: chunk.metadata.chunkIndex,
        section: chunk.metadata.section,
        source: chunk.metadata.source,
      },
      embedding: embeddings[index],
      assistant_slug: assistantSlug,
      created_by: userId,
    }))

    // Insert into Supabase
    const supabase = await createClient()

    // Insert in batches of 50 to avoid payload limits
    const BATCH_SIZE = 50
    let totalInserted = 0

    for (let i = 0; i < records.length; i += BATCH_SIZE) {
      const batch = records.slice(i, i + BATCH_SIZE)

      const { error } = await supabase.from('knowledge_base').insert(batch)

      if (error) {
        console.error('Error inserting batch:', error)
        throw new Error(`Failed to insert chunks: ${error.message}`)
      }

      totalInserted += batch.length
    }

    return {
      success: true,
      chunksCreated: totalInserted,
      documentId,
    }
  } catch (error) {
    console.error('Ingest error:', error)
    return {
      success: false,
      chunksCreated: 0,
      documentId,
      error: error instanceof Error ? error.message : 'Unknown error during ingestion',
    }
  }
}

/**
 * Delete all knowledge entries for a specific document
 */
export async function deleteKnowledgeByDocument(
  assistantSlug: string,
  documentId: string
): Promise<{ success: boolean; deletedCount: number; error?: string }> {
  try {
    const supabase = await createClient()

    // First count how many will be deleted
    const { count } = await supabase
      .from('knowledge_base')
      .select('*', { count: 'exact', head: true })
      .eq('assistant_slug', assistantSlug)
      .eq('metadata->>document_id', documentId)

    // Delete the records
    const { error } = await supabase
      .from('knowledge_base')
      .delete()
      .eq('assistant_slug', assistantSlug)
      .eq('metadata->>document_id', documentId)

    if (error) {
      throw new Error(`Failed to delete: ${error.message}`)
    }

    return {
      success: true,
      deletedCount: count || 0,
    }
  } catch (error) {
    console.error('Delete error:', error)
    return {
      success: false,
      deletedCount: 0,
      error: error instanceof Error ? error.message : 'Unknown error during deletion',
    }
  }
}

/**
 * Get statistics about the knowledge base
 */
export async function getKnowledgeStats(assistantSlug?: string): Promise<KnowledgeStats> {
  const supabase = await createClient()

  // Get total count
  let query = supabase.from('knowledge_base').select('*', { count: 'exact', head: true })

  if (assistantSlug) {
    query = query.eq('assistant_slug', assistantSlug)
  }

  const { count: totalChunks } = await query

  // Get counts by assistant
  const { data: assistantCounts } = await supabase
    .from('knowledge_base')
    .select('assistant_slug')

  const byAssistant: Record<string, number> = {}
  if (assistantCounts) {
    assistantCounts.forEach((row) => {
      const slug = row.assistant_slug || 'global'
      byAssistant[slug] = (byAssistant[slug] || 0) + 1
    })
  }

  // Get unique documents
  const { data: docs } = await supabase
    .from('knowledge_base')
    .select('metadata, assistant_slug')

  const documentMap = new Map<
    string,
    { documentId: string; documentTitle: string; assistantSlug: string | null; chunks: number }
  >()

  if (docs) {
    docs.forEach((row) => {
      const docId = (row.metadata as Record<string, unknown>)?.document_id as string
      const docTitle = (row.metadata as Record<string, unknown>)?.document_title as string
      if (docId) {
        const key = `${row.assistant_slug || 'global'}-${docId}`
        const existing = documentMap.get(key)
        if (existing) {
          existing.chunks++
        } else {
          documentMap.set(key, {
            documentId: docId,
            documentTitle: docTitle || docId,
            assistantSlug: row.assistant_slug,
            chunks: 1,
          })
        }
      }
    })
  }

  return {
    totalChunks: totalChunks || 0,
    byAssistant,
    documents: Array.from(documentMap.values()),
  }
}

/**
 * Check if a document already exists in the knowledge base
 */
export async function documentExists(
  assistantSlug: string,
  documentId: string
): Promise<boolean> {
  const supabase = await createClient()

  const { count } = await supabase
    .from('knowledge_base')
    .select('*', { count: 'exact', head: true })
    .eq('assistant_slug', assistantSlug)
    .eq('metadata->>document_id', documentId)

  return (count || 0) > 0
}
