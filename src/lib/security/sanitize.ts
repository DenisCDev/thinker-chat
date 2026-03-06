/**
 * Security utilities for sanitizing user input and preventing prompt injection
 */

// Normalize Unicode characters that could bypass filters
// Maps confusable characters to ASCII equivalents
function normalizeUnicode(text: string): string {
  // Normalize to NFKC form (compatibility decomposition + canonical composition)
  let normalized = text.normalize('NFKC')

  // Common Unicode confusables
  const confusables: Record<string, string> = {
    '\u0456': 'i', // Cyrillic і
    '\u0435': 'e', // Cyrillic е
    '\u043E': 'o', // Cyrillic о
    '\u0430': 'a', // Cyrillic а
    '\u0440': 'p', // Cyrillic р
    '\u0441': 'c', // Cyrillic с
    '\u0443': 'y', // Cyrillic у
    '\u0445': 'x', // Cyrillic х
    '\u0422': 'T', // Cyrillic Т
    '\u041D': 'H', // Cyrillic Н
    '\u0412': 'B', // Cyrillic В
    '\u041C': 'M', // Cyrillic М
    '\u041A': 'K', // Cyrillic К
    '\u0391': 'A', // Greek Α
    '\u0392': 'B', // Greek Β
    '\u0395': 'E', // Greek Ε
    '\u0397': 'H', // Greek Η
    '\u0399': 'I', // Greek Ι
    '\u039A': 'K', // Greek Κ
    '\u039C': 'M', // Greek Μ
    '\u039D': 'N', // Greek Ν
    '\u039F': 'O', // Greek Ο
    '\u03A1': 'P', // Greek Ρ
    '\u03A4': 'T', // Greek Τ
    '\u03A7': 'X', // Greek Χ
    '\u03A5': 'Y', // Greek Υ
    '\u03A6': 'Z', // Greek Ζ
    '\uFF49': 'i', // Fullwidth i
    '\uFF47': 'g', // Fullwidth g
    '\uFF4E': 'n', // Fullwidth n
    '\uFF4F': 'o', // Fullwidth o
    '\uFF52': 'r', // Fullwidth r
    '\uFF45': 'e', // Fullwidth e
  }

  for (const [unicode, ascii] of Object.entries(confusables)) {
    normalized = normalized.replace(new RegExp(unicode, 'g'), ascii)
  }

  return normalized
}

// Decode potential base64 encoded injection attempts
function detectBase64Injection(text: string): boolean {
  // Look for base64-like patterns that might decode to injection
  const base64Pattern = /[A-Za-z0-9+/]{20,}={0,2}/g
  const matches = text.match(base64Pattern)

  if (!matches) return false

  for (const match of matches) {
    try {
      const decoded = Buffer.from(match, 'base64').toString('utf-8')
      // Check if decoded content contains injection patterns
      if (/ignore|system|instructions|override|prompt/i.test(decoded)) {
        return true
      }
    } catch {
      // Not valid base64, skip
    }
  }

  return false
}

// Patterns that could be used for prompt injection attacks
const DANGEROUS_PATTERNS = [
  // Direct injection attempts (English)
  /ignore\s+(all\s+)?previous\s+instructions?/gi,
  /ignore\s+(the\s+)?(above|system)\s+(prompt|instructions?)/gi,
  /disregard\s+(all\s+)?previous/gi,
  /forget\s+(all\s+)?previous/gi,
  /skip\s+(the\s+)?system\s+prompt/gi,

  // Direct injection attempts (Portuguese)
  /ignor[ea]\s+(todas?\s+)?(as\s+)?instru[cç][oõ]es?\s+anteriores?/gi,
  /ignor[ea]\s+(o\s+)?prompt\s+(do\s+)?sistema/gi,
  /desconsider[ea]\s+(todas?\s+)?(as\s+)?instru[cç][oõ]es?/gi,
  /esque[cç]a\s+(todas?\s+)?(as\s+)?(suas?\s+)?(regras?|instru[cç][oõ]es?)/gi,
  /n[aã]o\s+siga\s+(as\s+)?instru[cç][oõ]es/gi,
  /abandon[ea]\s+(suas?\s+)?regras/gi,

  // Role-play based injection (English)
  /you\s+are\s+now\s+(a|an|in)/gi,
  /pretend\s+(you\s+are|to\s+be)/gi,
  /act\s+as\s+(if|a|an)/gi,
  /roleplay\s+as/gi,
  /imagine\s+you\s+are/gi,
  /from\s+now\s+on\s+you\s+(are|will)/gi,
  /let'?s\s+play\s+a\s+game/gi,
  /let'?s\s+pretend/gi,

  // Role-play based injection (Portuguese)
  /voc[eê]\s+[eé]\s+agora\s+(um|uma)/gi,
  /a\s+partir\s+de\s+agora\s+voc[eê]/gi,
  /finja\s+(que\s+)?(voc[eê]\s+)?[eé]/gi,
  /atue\s+como\s+(se\s+fosse|um|uma)/gi,
  /imagine\s+que\s+voc[eê]/gi,
  /fa[cç]a\s+de\s+conta\s+que/gi,
  /vamos\s+jogar\s+um\s+jogo/gi,
  /vamos\s+fingir/gi,
  /seja\s+(um|uma)\s+\w+\s+que/gi,

  // Instruction override attempts (English)
  /new\s+instructions?:/gi,
  /\boverride\b.*\b(system|instructions?|prompt)\b/gi,
  /replace\s+(your|the)\s+(system|instructions)/gi,
  /update\s+your\s+(rules|instructions)/gi,

  // Instruction override attempts (Portuguese)
  /novas?\s+instru[cç][oõ]es?:/gi,
  /substitua\s+(suas?|as)\s+(regras?|instru[cç][oõ]es?)/gi,
  /altere\s+(suas?|as)\s+(regras?|instru[cç][oõ]es?)/gi,
  /mude\s+(suas?|as)\s+(regras?|instru[cç][oõ]es?)/gi,
  /atualize\s+(suas?|as)\s+regras/gi,

  // System prompt markers
  /system\s*:\s*$/gim,
  /\[system\]/gi,
  /\[INST\]/gi,
  /\[\/INST\]/gi,
  /<<SYS>>/gi,
  /<<\/SYS>>/gi,
  /<\|im_start\|>/gi,
  /<\|im_end\|>/gi,
  /<\|system\|>/gi,
  /<\|user\|>/gi,
  /<\|assistant\|>/gi,

  // Structure manipulation
  /---+\s*\n\s*(system|instructions?|ignore)/gi,
  /```\s*(system|prompt|instructions)/gi,

  // Developer mode / jailbreak attempts (English + Portuguese)
  /developer\s+mode/gi,
  /jailbreak/gi,
  /DAN\s+mode/gi,
  /bypass\s+(safety|filter|restriction)/gi,
  /disable\s+(safety|filter|restriction)/gi,
  /modo\s+(desenvolvedor|programador)/gi,
  /desativ[ea]\s+(filtros?|restri[cç][oõ]es?|seguran[cç]a)/gi,
  /burlar\s+(filtros?|restri[cç][oõ]es?|seguran[cç]a)/gi,

  // Output manipulation (English)
  /respond\s+only\s+with/gi,
  /output\s+only/gi,
  /print\s+your\s+(system|instructions|prompt)/gi,
  /reveal\s+your\s+(system|instructions|prompt)/gi,
  /show\s+me\s+your\s+(system|instructions|prompt)/gi,
  /what\s+are\s+your\s+(system|instructions|prompt)/gi,

  // Output manipulation (Portuguese)
  /responda\s+apenas\s+com/gi,
  /mostre\s+(seu|sua|o)\s+(prompt|instru[cç][oõ]es?)/gi,
  /revele\s+(seu|sua|o)\s+(prompt|instru[cç][oõ]es?)/gi,
  /exiba\s+(seu|sua|o)\s+(prompt|instru[cç][oõ]es?)/gi,
  /quais?\s+s[aã]o\s+(suas?|as)\s+instru[cç][oõ]es/gi,
  /qual\s+[eé]\s+(seu|o)\s+prompt/gi,
]

// Token smuggling patterns - detect split injection keywords
const TOKEN_SMUGGLING_PATTERNS = [
  // Detect "i g n o r e" or "i-g-n-o-r-e" style obfuscation
  /i\s*[-_.\s]\s*g\s*[-_.\s]\s*n\s*[-_.\s]\s*o\s*[-_.\s]\s*r\s*[-_.\s]\s*e/gi,
  /s\s*[-_.\s]\s*y\s*[-_.\s]\s*s\s*[-_.\s]\s*t\s*[-_.\s]\s*e\s*[-_.\s]\s*m/gi,
  /p\s*[-_.\s]\s*r\s*[-_.\s]\s*o\s*[-_.\s]\s*m\s*[-_.\s]\s*p\s*[-_.\s]\s*t/gi,
  // Detect concatenation attempts
  /["']\s*\+\s*["']|concat\s*\(|join\s*\(/gi,
  // Detect zero-width characters used for splitting
  /[\u200B\u200C\u200D\uFEFF]/g,
  // Detect homoglyphs mixed with regular text (suspicious patterns)
  /[\u0400-\u04FF].*[a-zA-Z]|[a-zA-Z].*[\u0400-\u04FF]/g, // Cyrillic mixed with Latin
]

// Characters that could break prompt structure
const STRUCTURAL_CHARS = /[\u0000-\u001F\u007F-\u009F]/g // Control characters

/**
 * Sanitizes text to prevent prompt injection attacks
 * Removes dangerous patterns and control characters while preserving readability
 */
export function sanitizeForPrompt(text: string | null | undefined): string {
  if (!text) return ''

  let sanitized = text

  // Normalize Unicode to catch confusable characters
  sanitized = normalizeUnicode(sanitized)

  // Remove control characters (except newlines and tabs)
  sanitized = sanitized.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/g, '')

  // Check for base64 encoded injection attempts
  if (detectBase64Injection(sanitized)) {
    // Remove suspicious base64 strings
    sanitized = sanitized.replace(/[A-Za-z0-9+/]{20,}={0,2}/g, '[conteudo codificado removido]')
  }

  // Replace dangerous patterns with safe alternatives
  for (const pattern of DANGEROUS_PATTERNS) {
    sanitized = sanitized.replace(pattern, '[conteudo removido por seguranca]')
  }

  // Detect and handle token smuggling attempts
  for (const pattern of TOKEN_SMUGGLING_PATTERNS) {
    sanitized = sanitized.replace(pattern, '[conteudo suspeito removido]')
  }

  // Limit consecutive newlines to prevent structure manipulation
  sanitized = sanitized.replace(/\n{4,}/g, '\n\n\n')

  // Limit consecutive dashes (often used to create separators)
  sanitized = sanitized.replace(/-{5,}/g, '----')

  // Limit consecutive equals signs (also used as separators)
  sanitized = sanitized.replace(/={5,}/g, '====')

  return sanitized.trim()
}

/**
 * Sanitizes assistant name for use in prompts
 * More strict than general sanitization - only allows safe characters
 */
export function sanitizeAssistantName(name: string | null | undefined): string {
  if (!name) return 'Assistente'

  // Only allow letters, numbers, spaces, and basic punctuation
  let sanitized = name.replace(/[^\p{L}\p{N}\s\-.,()]/gu, '')

  // Limit length
  sanitized = sanitized.substring(0, 100)

  // Remove excessive whitespace
  sanitized = sanitized.replace(/\s+/g, ' ').trim()

  return sanitized || 'Assistente'
}

/**
 * Sanitizes assistant description for use in prompts
 */
export function sanitizeDescription(description: string | null | undefined): string {
  if (!description) return ''

  let sanitized = sanitizeForPrompt(description)

  // Limit length for descriptions
  if (sanitized.length > 500) {
    sanitized = sanitized.substring(0, 500) + '...'
  }

  return sanitized
}

/**
 * Sanitizes conversation summary before injecting into system prompt
 */
export function sanitizeSummary(summary: string | null | undefined): string {
  if (!summary) return ''

  let sanitized = sanitizeForPrompt(summary)

  // Limit summary length
  if (sanitized.length > 2000) {
    sanitized = sanitized.substring(0, 2000) + '...'
  }

  return sanitized
}

/**
 * Sanitizes RAG/knowledge base content before injecting into prompt
 */
export function sanitizeKnowledgeContent(content: string | null | undefined): string {
  if (!content) return ''

  let sanitized = sanitizeForPrompt(content)

  // Limit knowledge content length
  if (sanitized.length > 10000) {
    sanitized = sanitized.substring(0, 10000) + '\n\n[... conteudo truncado ...]'
  }

  return sanitized
}

/**
 * Sanitizes user message content
 * Applies full sanitization to prevent prompt injection
 */
export function sanitizeUserMessage(content: string | null | undefined): string {
  if (!content) return ''

  // Apply full sanitization including dangerous pattern detection
  let sanitized = sanitizeForPrompt(content)

  // Limit length (50KB max)
  if (sanitized.length > 50000) {
    sanitized = sanitized.substring(0, 50000)
  }

  return sanitized.trim()
}

/**
 * Validates that content doesn't exceed token limits
 * Rough estimation: 1 token ~ 4 characters for Portuguese
 */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4)
}

/**
 * Truncates content to fit within token limit
 */
export function truncateToTokenLimit(text: string, maxTokens: number): string {
  const estimatedChars = maxTokens * 4
  if (text.length <= estimatedChars) return text

  return text.substring(0, estimatedChars) + '\n\n[... conteudo truncado por limite de tokens ...]'
}

/**
 * Sanitizes extracted text from file attachments
 * Wraps content in clear delimiters and removes injection attempts
 */
export function sanitizeAttachmentContent(
  content: string | null | undefined,
  fileName: string,
  fileType: string
): string {
  if (!content) return ''

  // Apply base sanitization
  let sanitized = sanitizeForPrompt(content)

  // Additional patterns specific to document injection
  const documentInjectionPatterns = [
    /assistant\s*:\s*$/gim,
    /human\s*:\s*$/gim,
    /user\s*:\s*$/gim,
    /<\/?script\b[^>]*>/gi,
    /<\/?iframe\b[^>]*>/gi,
    /javascript\s*:/gi,
    /data\s*:\s*text\/html/gi,
    /on\w+\s*=/gi, // onclick=, onerror=, etc
  ]

  for (const pattern of documentInjectionPatterns) {
    sanitized = sanitized.replace(pattern, '[removido]')
  }

  // Limit extracted content length
  const MAX_ATTACHMENT_LENGTH = 30000
  if (sanitized.length > MAX_ATTACHMENT_LENGTH) {
    sanitized = sanitized.substring(0, MAX_ATTACHMENT_LENGTH) + '\n\n[... conteudo do arquivo truncado ...]'
  }

  // Wrap in clear delimiters to prevent confusion with conversation
  const safeFileName = fileName.replace(/[^\p{L}\p{N}\s\-_.]/gu, '_').substring(0, 100)
  const safeFileType = fileType.replace(/[^a-zA-Z0-9]/g, '')

  return `
<<<INICIO_ARQUIVO: ${safeFileName} (${safeFileType})>>>
${sanitized}
<<<FIM_ARQUIVO: ${safeFileName}>>>
`.trim()
}

/**
 * Detects potential prompt injection in text and returns a warning if found
 */
export function detectPromptInjection(text: string): { hasInjection: boolean; warning?: string; severity: 'low' | 'medium' | 'high' } {
  if (!text) return { hasInjection: false, severity: 'low' }

  // Normalize for detection
  const normalized = normalizeUnicode(text)

  const suspiciousPatterns = [
    // High severity - direct injection attempts
    { pattern: /ignore\s+(all\s+)?previous/gi, name: 'ignore previous', severity: 'high' as const },
    { pattern: /disregard\s+(all\s+)?previous/gi, name: 'disregard previous', severity: 'high' as const },
    { pattern: /new\s+instructions?:/gi, name: 'new instructions', severity: 'high' as const },
    { pattern: /\[INST\]|\[\/INST\]/gi, name: 'instruction tags', severity: 'high' as const },
    { pattern: /<<SYS>>|<<\/SYS>>/gi, name: 'system tags', severity: 'high' as const },
    { pattern: /<\|im_start\|>|<\|im_end\|>/gi, name: 'ChatML tags', severity: 'high' as const },
    { pattern: /override\s+.*\s+(system|instructions|prompt)/gi, name: 'override attempt', severity: 'high' as const },
    { pattern: /jailbreak/gi, name: 'jailbreak attempt', severity: 'high' as const },
    { pattern: /DAN\s+mode/gi, name: 'DAN mode', severity: 'high' as const },

    // Medium severity - role manipulation
    { pattern: /you\s+are\s+now/gi, name: 'role override', severity: 'medium' as const },
    { pattern: /pretend\s+(you\s+are|to\s+be)/gi, name: 'pretend', severity: 'medium' as const },
    { pattern: /act\s+as\s+(if|a|an)/gi, name: 'act as', severity: 'medium' as const },
    { pattern: /from\s+now\s+on/gi, name: 'from now on', severity: 'medium' as const },
    { pattern: /\bsystem\s*:\s*$/gim, name: 'system prompt marker', severity: 'medium' as const },

    // Low severity - suspicious but might be legitimate
    { pattern: /reveal\s+your\s+(system|instructions|prompt)/gi, name: 'reveal prompt', severity: 'low' as const },
    { pattern: /show\s+me\s+your\s+(system|instructions|prompt)/gi, name: 'show prompt', severity: 'low' as const },
  ]

  let highestSeverity: 'low' | 'medium' | 'high' = 'low'
  const detectedPatterns: string[] = []

  for (const { pattern, name, severity } of suspiciousPatterns) {
    if (pattern.test(normalized)) {
      detectedPatterns.push(name)
      if (severity === 'high') highestSeverity = 'high'
      else if (severity === 'medium' && highestSeverity !== 'high') highestSeverity = 'medium'
    }
  }

  // Check for base64 injection
  if (detectBase64Injection(normalized)) {
    detectedPatterns.push('base64 encoded injection')
    highestSeverity = 'high'
  }

  if (detectedPatterns.length > 0) {
    return {
      hasInjection: true,
      warning: `Padroes suspeitos detectados: ${detectedPatterns.join(', ')}. O conteudo foi sanitizado.`,
      severity: highestSeverity,
    }
  }

  return { hasInjection: false, severity: 'low' }
}

/**
 * Validates and sanitizes system prompts for assistant creation/update
 * More strict than general sanitization
 */
export function sanitizeSystemPrompt(prompt: string | null | undefined): string {
  if (!prompt) return ''

  let sanitized = prompt

  // Normalize Unicode
  sanitized = normalizeUnicode(sanitized)

  // Remove control characters (except newlines and tabs)
  sanitized = sanitized.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/g, '')

  // Remove potential code execution patterns
  const dangerousCodePatterns = [
    /<script\b[^>]*>[\s\S]*?<\/script>/gi,
    /<iframe\b[^>]*>[\s\S]*?<\/iframe>/gi,
    /javascript\s*:/gi,
    /data\s*:\s*text\/html/gi,
    /on\w+\s*=/gi,
    /eval\s*\(/gi,
    /exec\s*\(/gi,
    /Function\s*\(/gi,
  ]

  for (const pattern of dangerousCodePatterns) {
    sanitized = sanitized.replace(pattern, '[codigo removido]')
  }

  // Remove ChatML/instruction format markers that could confuse the model
  const instructionMarkers = [
    /\[INST\]/gi,
    /\[\/INST\]/gi,
    /<<SYS>>/gi,
    /<<\/SYS>>/gi,
    /<\|im_start\|>/gi,
    /<\|im_end\|>/gi,
    /<\|system\|>/gi,
    /<\|user\|>/gi,
    /<\|assistant\|>/gi,
  ]

  for (const pattern of instructionMarkers) {
    sanitized = sanitized.replace(pattern, '')
  }

  // Limit length (system prompts shouldn't be too long)
  const MAX_SYSTEM_PROMPT_LENGTH = 10000
  if (sanitized.length > MAX_SYSTEM_PROMPT_LENGTH) {
    sanitized = sanitized.substring(0, MAX_SYSTEM_PROMPT_LENGTH)
  }

  return sanitized.trim()
}

/**
 * Checks if file content should be blocked (not just warned)
 * Returns true if the content contains high-severity injection attempts
 */
export function shouldBlockFileContent(text: string): { block: boolean; reason?: string } {
  if (!text) return { block: false }

  const result = detectPromptInjection(text)

  if (result.hasInjection && result.severity === 'high') {
    return {
      block: true,
      reason: result.warning,
    }
  }

  return { block: false }
}

/**
 * Sanitizes conversation title to prevent prompt injection via title
 * Titles can be displayed in UI and included in context
 */
export function sanitizeConversationTitle(title: string | null | undefined): string {
  if (!title) return 'Nova conversa'

  let sanitized = title

  // Normalize Unicode
  sanitized = normalizeUnicode(sanitized)

  // Remove control characters
  sanitized = sanitized.replace(/[\u0000-\u001F\u007F-\u009F]/g, '')

  // Remove zero-width characters
  sanitized = sanitized.replace(/[\u200B\u200C\u200D\uFEFF]/g, '')

  // Remove any ChatML/instruction markers
  const dangerousMarkers = [
    /\[INST\]/gi,
    /\[\/INST\]/gi,
    /<<SYS>>/gi,
    /<<\/SYS>>/gi,
    /<\|im_start\|>/gi,
    /<\|im_end\|>/gi,
    /<\|system\|>/gi,
    /<\|user\|>/gi,
    /<\|assistant\|>/gi,
    /system\s*:/gi,
    /assistant\s*:/gi,
    /user\s*:/gi,
  ]

  for (const pattern of dangerousMarkers) {
    sanitized = sanitized.replace(pattern, '')
  }

  // Only allow safe characters: letters, numbers, spaces, basic punctuation
  sanitized = sanitized.replace(/[^\p{L}\p{N}\s\-.,!?()]/gu, '')

  // Limit length (titles shouldn't be too long)
  sanitized = sanitized.substring(0, 150)

  // Remove excessive whitespace
  sanitized = sanitized.replace(/\s+/g, ' ').trim()

  return sanitized || 'Nova conversa'
}

/**
 * Sanitizes text content from images for vision model inputs
 * Images can contain text that might be used for injection
 */
export function sanitizeImageContent(extractedText: string | null | undefined): string {
  if (!extractedText) return ''

  // Apply full prompt sanitization
  let sanitized = sanitizeForPrompt(extractedText)

  // Additional patterns specific to image-based attacks
  const imageInjectionPatterns = [
    // QR code decoded instructions
    /scan\s+this\s+code\s+to/gi,
    /follow\s+these\s+instructions/gi,
    // Hidden text patterns
    /hidden\s+message\s*:/gi,
    /secret\s+instructions?\s*:/gi,
    // Steganography indicators
    /embedded\s+data\s*:/gi,
    /encoded\s+message\s*:/gi,
  ]

  for (const pattern of imageInjectionPatterns) {
    sanitized = sanitized.replace(pattern, '[conteudo de imagem removido]')
  }

  // Limit length for image-extracted text
  const MAX_IMAGE_TEXT_LENGTH = 5000
  if (sanitized.length > MAX_IMAGE_TEXT_LENGTH) {
    sanitized = sanitized.substring(0, MAX_IMAGE_TEXT_LENGTH) + '\n[... texto da imagem truncado ...]'
  }

  // Wrap in clear delimiters
  if (sanitized.trim()) {
    return `<<<TEXTO_EXTRAIDO_DA_IMAGEM>>>\n${sanitized}\n<<<FIM_TEXTO_IMAGEM>>>`
  }

  return ''
}

/**
 * Sanitizes model response output to prevent prompt leakage
 * Removes system prompts or instructions that might have leaked
 */
export function sanitizeModelResponse(response: string | null | undefined): string {
  if (!response) return ''

  let sanitized = response

  // Remove any accidentally leaked system prompt markers
  const leakPatterns = [
    // System prompt leakage indicators
    /system\s*prompt\s*:\s*/gi,
    /my\s+instructions?\s+(are|is)\s*:\s*/gi,
    /i\s+was\s+instructed\s+to\s*/gi,
    /minhas?\s+instru[cç][oõ]es?\s+(s[aã]o|[eé])\s*:\s*/gi,
    /fui\s+instruido\s+a\s*/gi,
    // Prompt structure markers that shouldn't appear in output
    /<<<SYSTEM>>>/gi,
    /<<<\/SYSTEM>>>/gi,
    /\[system\s+prompt\]/gi,
    /\[end\s+system\s+prompt\]/gi,
    // Internal context markers
    /<<<RESUMO_CONVERSA>>>/gi,
    /<<<FIM_RESUMO>>>/gi,
    /<<<INICIO_ARQUIVO:/gi,
    /<<<FIM_ARQUIVO:/gi,
    /<<<TEXTO_EXTRAIDO_DA_IMAGEM>>>/gi,
    /<<<FIM_TEXTO_IMAGEM>>>/gi,
    // Internal formatting markers
    /\[INTERNO\]/gi,
    /\[\/INTERNO\]/gi,
  ]

  for (const pattern of leakPatterns) {
    sanitized = sanitized.replace(pattern, '')
  }

  return sanitized.trim()
}

/**
 * Multi-turn attack detection - analyzes conversation history for gradual context manipulation
 * Returns severity level and warning if suspicious patterns are detected across messages
 */
export interface MultiTurnAnalysis {
  isSuspicious: boolean
  severity: 'low' | 'medium' | 'high'
  warning?: string
  suspiciousMessages: number[]
}

export function detectMultiTurnAttack(messages: Array<{ role: string; content: string }>): MultiTurnAnalysis {
  const userMessages = messages.filter(m => m.role === 'user').map(m => m.content)

  if (userMessages.length < 3) {
    return { isSuspicious: false, severity: 'low', suspiciousMessages: [] }
  }

  const suspiciousIndicators: number[] = []
  let cumulativeScore = 0

  // Patterns that might be building up across messages
  const escalationPatterns = [
    // Progressive permission seeking
    { pattern: /pode\s+me\s+ajudar/gi, score: 0.5, name: 'permission seeking' },
    { pattern: /voc[eê]\s+[eé]\s+capaz/gi, score: 0.5, name: 'capability probing' },
    { pattern: /quais?\s+s[aã]o\s+suas?\s+limita[cç][oõ]es/gi, score: 1, name: 'limitation probing' },
    { pattern: /voc[eê]\s+pode\s+ignorar/gi, score: 2, name: 'ignore capability' },

    // Building rapport before attack
    { pattern: /obrigad[oa]/gi, score: 0.2, name: 'rapport building' },
    { pattern: /voc[eê]\s+[eé]\s+muito\s+(bom|[uú]til|inteligente)/gi, score: 0.3, name: 'flattery' },
    { pattern: /confio\s+em\s+voc[eê]/gi, score: 0.5, name: 'trust building' },

    // Progressive context manipulation
    { pattern: /para\s+fins\s+(educacionais|de\s+teste)/gi, score: 1, name: 'educational framing' },
    { pattern: /apenas\s+um\s+exemplo/gi, score: 0.5, name: 'example framing' },
    { pattern: /hipoteticamente/gi, score: 0.8, name: 'hypothetical framing' },
    { pattern: /em\s+teoria/gi, score: 0.8, name: 'theoretical framing' },

    // Direct escalation indicators
    { pattern: /agora\s+que\s+voc[eê]/gi, score: 1.5, name: 'now that you' },
    { pattern: /j[aá]\s+que\s+voc[eê]\s+confirmou/gi, score: 2, name: 'since you confirmed' },
    { pattern: /como\s+voc[eê]\s+disse/gi, score: 0.5, name: 'as you said' },
    { pattern: /voc[eê]\s+concordou/gi, score: 1, name: 'you agreed' },
  ]

  // Analyze each message
  userMessages.forEach((msg, idx) => {
    let messageScore = 0
    const normalized = normalizeUnicode(msg)

    for (const { pattern, score } of escalationPatterns) {
      if (pattern.test(normalized)) {
        messageScore += score
      }
    }

    // Check for injection attempts in later messages
    const injectionResult = detectPromptInjection(msg)
    if (injectionResult.hasInjection) {
      messageScore += injectionResult.severity === 'high' ? 5 : injectionResult.severity === 'medium' ? 2 : 1
    }

    if (messageScore > 0.5) {
      suspiciousIndicators.push(idx)
    }
    cumulativeScore += messageScore
  })

  // Determine severity based on cumulative score and pattern
  let severity: 'low' | 'medium' | 'high' = 'low'
  let warning: string | undefined

  if (cumulativeScore >= 8 || suspiciousIndicators.length >= 4) {
    severity = 'high'
    warning = 'Detectado possivel ataque de multiplas mensagens. O usuario parece estar tentando manipular o contexto gradualmente.'
  } else if (cumulativeScore >= 4 || suspiciousIndicators.length >= 2) {
    severity = 'medium'
    warning = 'Padrao suspeito detectado em multiplas mensagens. Monitorando comportamento.'
  } else if (cumulativeScore >= 2) {
    severity = 'low'
    warning = 'Alguns padroes levemente suspeitos detectados.'
  }

  return {
    isSuspicious: cumulativeScore >= 2,
    severity,
    warning,
    suspiciousMessages: suspiciousIndicators,
  }
}

/**
 * Detects token smuggling attempts where keywords are split or obfuscated
 */
export function detectTokenSmuggling(text: string): { detected: boolean; patterns: string[] } {
  if (!text) return { detected: false, patterns: [] }

  const detectedPatterns: string[] = []
  const normalized = normalizeUnicode(text)

  for (const pattern of TOKEN_SMUGGLING_PATTERNS) {
    if (pattern.test(normalized)) {
      detectedPatterns.push(pattern.toString())
    }
  }

  // Check for excessive use of special spacing/formatting
  const specialSpacingCount = (text.match(/[\u00A0\u2000-\u200A\u2028\u2029\u202F\u205F\u3000]/g) || []).length
  if (specialSpacingCount > 5) {
    detectedPatterns.push('excessive special spacing')
  }

  // Check for character substitutions that look like letter swaps
  const confusableRatio = countConfusables(text) / text.length
  if (confusableRatio > 0.1) {
    detectedPatterns.push('high confusable character ratio')
  }

  return {
    detected: detectedPatterns.length > 0,
    patterns: detectedPatterns,
  }
}

// Helper function to count confusable characters
function countConfusables(text: string): number {
  let count = 0
  const confusableRanges = [
    [0x0400, 0x04FF], // Cyrillic
    [0x0370, 0x03FF], // Greek
    [0xFF00, 0xFFEF], // Fullwidth
  ]

  for (const char of text) {
    const code = char.charCodeAt(0)
    for (const [start, end] of confusableRanges) {
      if (code >= start && code <= end) {
        count++
        break
      }
    }
  }

  return count
}
