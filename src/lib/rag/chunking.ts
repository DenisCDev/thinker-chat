export interface Chunk {
  content: string
  metadata: {
    source: string
    chunkIndex: number
    section?: string
  }
  tokenCount: number
}

export interface ChunkOptions {
  maxTokens?: number
  overlapTokens?: number
  separators?: string[]
}

// Document separators for hierarchical chunking
// Includes legal document patterns (useful for structured docs) and generic separators
export const LEGAL_SEPARATORS = [
  '\n# ',       // Markdown H1
  '\n## ',      // Markdown H2
  '\n### ',     // Markdown H3
  '\n#### ',    // Markdown H4
  '\nArt. ',    // Artigos de lei
  '\nArtigo ',  // Artigo por extenso
  '\n§ ',       // Paragrafos legais
  '\n---',      // Horizontal rules / section breaks
  '\n\n',       // Paragrafos de texto
  '\n',         // Quebras de linha
  '. ',         // Sentencas
]

// Chunking configuration
const DEFAULT_MAX_TOKENS = 600
const DEFAULT_OVERLAP_TOKENS = 80
const CHARS_PER_TOKEN = 4 // Approximate for Portuguese

/**
 * Split text into chunks using hierarchical approach
 * Prioritizes legal document structure
 */
export function chunkDocument(
  text: string,
  source: string,
  options?: ChunkOptions
): Chunk[] {
  const maxTokens = options?.maxTokens || DEFAULT_MAX_TOKENS
  const overlapTokens = options?.overlapTokens || DEFAULT_OVERLAP_TOKENS
  const separators = options?.separators || LEGAL_SEPARATORS

  const maxChars = maxTokens * CHARS_PER_TOKEN
  const overlapChars = overlapTokens * CHARS_PER_TOKEN

  const chunks: Chunk[] = []

  // First, try to split by major legal separators
  const segments = splitByLegalSeparators(text, separators)

  // Process each segment
  segments.forEach((segment) => {
    const segmentChunks = splitIntoChunks(segment.text, maxChars, overlapChars)

    segmentChunks.forEach((chunkText) => {
      const trimmedChunk = chunkText.trim()
      if (trimmedChunk.length > 50) {
        // Filter tiny chunks
        chunks.push({
          content: trimmedChunk,
          metadata: {
            source,
            chunkIndex: chunks.length,
            section: segment.section,
          },
          tokenCount: Math.ceil(trimmedChunk.length / CHARS_PER_TOKEN),
        })
      }
    })
  })

  return chunks
}

interface Segment {
  text: string
  section?: string
}

function splitByLegalSeparators(
  text: string,
  separators: string[]
): Segment[] {
  // Find section headers using common legal patterns
  const sectionRegex = /(?:Art(?:igo)?\.?\s*\d+|§\s*\d+|Cap[ií]tulo\s+\d+)/gi
  const segments: Segment[] = []

  let lastIndex = 0
  let currentSection = ''

  const matches = [...text.matchAll(sectionRegex)]

  if (matches.length === 0) {
    // No legal structure found, split by paragraphs
    return splitByParagraphs(text)
  }

  matches.forEach((match) => {
    if (match.index !== undefined && match.index > lastIndex) {
      const segmentText = text.slice(lastIndex, match.index)
      if (segmentText.trim().length > 0) {
        segments.push({
          text: segmentText,
          section: currentSection || undefined,
        })
      }
    }
    currentSection = match[0].trim()
    lastIndex = match.index || 0
  })

  // Add remaining text
  if (lastIndex < text.length) {
    const remainingText = text.slice(lastIndex)
    if (remainingText.trim().length > 0) {
      segments.push({
        text: remainingText,
        section: currentSection || undefined,
      })
    }
  }

  return segments
}

function splitByParagraphs(text: string): Segment[] {
  const paragraphs = text.split(/\n\n+/)
  return paragraphs
    .filter((p) => p.trim().length > 0)
    .map((p) => ({ text: p.trim() }))
}

function splitIntoChunks(
  text: string,
  maxChars: number,
  overlapChars: number
): string[] {
  if (text.length <= maxChars) {
    return [text]
  }

  const chunks: string[] = []
  let start = 0

  while (start < text.length) {
    let end = start + maxChars

    // Try to break at sentence or paragraph boundary
    if (end < text.length) {
      const breakPoint = findBreakPoint(text, start, end)
      if (breakPoint > start) {
        end = breakPoint
      }
    } else {
      end = text.length
    }

    chunks.push(text.slice(start, end))

    // Move start with overlap
    start = Math.max(start + 1, end - overlapChars)
  }

  return chunks
}

function findBreakPoint(text: string, start: number, end: number): number {
  // Minimum position for break (at least half the chunk)
  const minPosition = start + (end - start) / 2

  // Look for paragraph break first
  const paragraphBreak = text.lastIndexOf('\n\n', end)
  if (paragraphBreak > minPosition) {
    return paragraphBreak + 2
  }

  // Then sentence break
  const sentenceBreaks = ['. ', '! ', '? ', '.\n', ';\n']
  for (const br of sentenceBreaks) {
    const sentenceBreak = text.lastIndexOf(br, end)
    if (sentenceBreak > minPosition) {
      return sentenceBreak + br.length
    }
  }

  // Then any newline
  const lineBreak = text.lastIndexOf('\n', end)
  if (lineBreak > minPosition) {
    return lineBreak + 1
  }

  return end
}

/**
 * Process PDF text extracted by pdf-parse/unpdf
 * Cleans up common issues including Brazilian document patterns
 */
export function cleanPdfText(text: string): string {
  if (!text) return ''

  return (
    text
      // Remove null bytes and other problematic characters
      .replace(/\0/g, '')
      // Form feeds to paragraphs
      .replace(/\f/g, '\n\n')
      // Normalize line endings
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      // Fix common PDF extraction issues with hyphens at line breaks
      .replace(/([a-záàâãéèêíìîóòôõúùûç])-\n([a-záàâãéèêíìîóòôõúùûç])/gi, '$1$2')
      // Fix words split across lines (common in PDF column layouts)
      .replace(/([a-záàâãéèêíìîóòôõúùûç])\n([a-záàâãéèêíìîóòôõúùûç])/gi, '$1 $2')
      // Multiple spaces to single (preserving newlines)
      .replace(/[ \t]+/g, ' ')
      // Remove spaces around newlines
      .replace(/\n +/g, '\n')
      .replace(/ +\n/g, '\n')
      // Max 2 consecutive newlines
      .replace(/\n{3,}/g, '\n\n')
      // Fix common OCR/extraction errors in numbers
      .replace(/(\d)\s+(\d)/g, '$1$2')
      // Fix R$ currency formatting
      .replace(/R\s*\$\s*/g, 'R$ ')
      // Clean up bullet points and list markers
      .replace(/[•●○]\s*/g, '- ')
      .trim()
  )
}
